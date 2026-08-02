from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
import json
import os
import uuid

import database
import pipeline
import auth
import github as github_api
from routers.auth_router import router as auth_router
from routers.github_router import router as github_router

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    database.create_tables()
    print("Loading model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded.")
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(auth_router)
app.include_router(github_router)

allow_origins = ["http://localhost:5173"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allow_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# GitHub enrichment
# ---------------------------------------------------------------------------
def enrich_with_github(projects: list) -> list:
    """Attach GitHub metadata to each project that has a GitHub URL.
    Runs after the ML pipeline so it never blocks clustering."""
    for p in projects:
        info = github_api.fetch_repo_info(p.get("url") or "")
        if info:
            p.update(info)
        else:
            # No GitHub URL — mark as idea so the frontend always has a status
            p["github_status"] = "idea"
    return projects


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------
class ProjectRequest(BaseModel):
    id: str
    name: str
    description: str
    tools: List[str]
    timeframe: str
    url: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/projects")
def get_projects(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    dims: int = Query(default=2, ge=2, le=3),
):
    rows = db.query(database.Project).filter(
        database.Project.user_id == current_user.id
    ).all()
    if not rows:
        return {"projects": []}
    projects = [database.row_to_dict(r) for r in rows]
    enriched = pipeline.run_pipeline(projects, model, dims=dims)
    enrich_with_github(enriched)
    return {"projects": enriched}


@app.post("/api/projects")
def add_project(
    project: ProjectRequest,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    dims: int = Query(default=2, ge=2, le=3),
):
    existing = db.query(database.Project).filter(
        database.Project.id == project.id,
        database.Project.user_id == current_user.id,
    ).first()

    if existing:
        existing.name        = project.name
        existing.description = project.description
        existing.tools       = json.dumps(project.tools)
        existing.timeframe   = project.timeframe
        existing.url         = project.url
    else:
        db.add(database.Project(
            id          = project.id,
            name        = project.name,
            description = project.description,
            tools       = json.dumps(project.tools),
            timeframe   = project.timeframe,
            url         = project.url,
            user_id     = current_user.id,
        ))

    db.commit()

    rows = db.query(database.Project).filter(
        database.Project.user_id == current_user.id
    ).all()
    projects = [database.row_to_dict(r) for r in rows]

    try:
        enriched = pipeline.run_pipeline(projects, model, dims=dims)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    enrich_with_github(enriched)
    return {"projects": enriched}


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: str,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    dims: int = Query(default=2, ge=2, le=3),
):
    db.query(database.Project).filter(
        database.Project.id == project_id,
        database.Project.user_id == current_user.id,
    ).delete()
    db.commit()

    rows = db.query(database.Project).filter(
        database.Project.user_id == current_user.id
    ).all()
    if not rows:
        return {"projects": []}

    projects = [database.row_to_dict(r) for r in rows]
    enriched = pipeline.run_pipeline(projects, model, dims=dims)
    enrich_with_github(enriched)
    return {"projects": enriched}


# ---------------------------------------------------------------------------
# Share routes
# ---------------------------------------------------------------------------
@app.get("/api/share/status")
def get_share_status(
    current_user: database.User = Depends(auth.get_current_user),
):
    """Returns the current user's share token, or None if not sharing."""
    return {"share_token": current_user.share_token}


@app.post("/api/share/token")
def generate_share_token(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """Generate a new share token for the current user."""
    user = db.query(database.User).filter(database.User.id == current_user.id).first()
    user.share_token = str(uuid.uuid4())
    db.commit()
    db.refresh(user)
    return {"share_token": user.share_token}


@app.delete("/api/share/token")
def revoke_share_token(
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    """Revoke the current user's share token."""
    user = db.query(database.User).filter(database.User.id == current_user.id).first()
    user.share_token = None
    db.commit()
    return {"share_token": None}


@app.get("/api/share/{token}")
def get_shared_graph(
    token: str,
    db: Session = Depends(database.get_db),
    dims: int = Query(default=2, ge=2, le=3),
):
    """Public endpoint — no auth. Returns the owner's enriched projects."""
    owner = db.query(database.User).filter(database.User.share_token == token).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Share link not found or revoked.")

    rows = db.query(database.Project).filter(
        database.Project.user_id == owner.id
    ).all()
    if not rows:
        return {"projects": [], "owner_email": owner.email}

    projects = [database.row_to_dict(r) for r in rows]
    enriched = pipeline.run_pipeline(projects, model, dims=dims)
    enrich_with_github(enriched)
    return {"projects": enriched, "owner_email": owner.email}
