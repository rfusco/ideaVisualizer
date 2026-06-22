import json
from database import SessionLocal, Project, create_tables

create_tables()
db = SessionLocal()

with open("projects.json", "r") as f:
    projects = json.load(f)

for p in projects:
    existing = db.query(Project).filter(Project.id == p["id"]).first()
    if not existing:
        db.add(Project(
            id          = p["id"],
            name        = p["name"],
            description = p["description"],
            tools       = json.dumps(p["tools"]),
            timeframe   = p["timeframe"],
            url         = p.get("url"),
        ))

db.commit()
db.close()
print(f"Migrated {len(projects)} projects.")