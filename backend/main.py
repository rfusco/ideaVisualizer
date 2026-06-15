from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import storage
import pipeline
from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer

import os
from huggingface_hub import login

login(token=os.getenv("HF_TOKEN"))

model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    print("Loading model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded.")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Project(BaseModel):
    id: str
    name: str
    description: str
    tools: List[str]
    timeframe: str
    url: Optional[str] = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/projects")
def get_projects():
    """
    Return all projects with their current coordinates and cluster labels.
    Called on page load to restore state.
    """
    projects = storage.load_projects()
    if not projects:
        return {"projects": []}
    enriched = pipeline.run_pipeline(projects, model)
    return {"projects": enriched}


@app.post("/api/projects")
def add_project(project: Project):
    """
    Accept a new project, store it, re-run the full pipeline on all projects,
    and return the enriched full list so the frontend can redraw the graph.
    """
    # Convert pydantic model to plain dict for storage
    project_dict = project.model_dump()

    # Save to disk and get updated full list
    all_projects = storage.add_project(project_dict)

    # Run ML pipeline on everything
    try:
        enriched = pipeline.run_pipeline(all_projects, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    return {"projects": enriched}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    """
    Remove a project by id, re-run pipeline, return updated list.
    """
    projects = storage.load_projects()
    projects = [p for p in projects if p["id"] != project_id]
    storage.save_projects(projects)

    if not projects:
        return {"projects": []}

    enriched = pipeline.run_pipeline(projects, model)
    return {"projects": enriched}