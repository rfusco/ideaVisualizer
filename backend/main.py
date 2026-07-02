from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
import json
import os

import database
import pipeline
import auth
from routers.auth_router import router as auth_router

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
):
    rows = db.query(database.Project).filter(
        database.Project.user_id == current_user.id
    ).all()
    if not rows:
        return {"projects": []}
    projects = [database.row_to_dict(r) for r in rows]
    enriched = pipeline.run_pipeline(projects, model)
    return {"projects": enriched}


@app.post("/api/projects")
def add_project(
    project: ProjectRequest,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
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
        enriched = pipeline.run_pipeline(projects, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    return {"projects": enriched}


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: str,
    current_user: database.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
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
    enriched = pipeline.run_pipeline(projects, model)
    return {"projects": enriched}
