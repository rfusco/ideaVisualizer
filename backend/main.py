from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# for development, allow CORS from localhost:5173 (Vite dev server)
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

@app.post("/api/projects")
def add_project(project: Project):
    # Embedding + clustering logic will go here
    return {"message": "received", "project": project}