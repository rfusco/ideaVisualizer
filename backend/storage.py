import json
import os
from typing import List, Dict

STORAGE_FILE = "projects.json"

def load_projects() -> List[dict]:
    if not os.path.exists(STORAGE_FILE):
        return []
    with open(STORAGE_FILE, "r") as f:
        content = f.read().strip()
        if not content:
            return []
        return json.loads(content)

def save_projects(projects: List[Dict]):
    """Write the full project list to disk, overwriting what was there."""
    with open(STORAGE_FILE, "w") as f:
        json.dump(projects, f, indent=2)

def add_project(project: Dict) -> List[Dict]:
    """Add a single project and persist. Returns the updated full list."""
    projects = load_projects()
    # Avoid duplicates if the same id is submitted twice
    projects = [p for p in projects if p["id"] != project["id"]]
    projects.append(project)
    save_projects(projects)
    return projects