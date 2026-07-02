"""
One-shot script: assigns all projects with no user_id to the first registered user.
Run this once locally after registering your account to claim existing projects.
"""
from database import SessionLocal, Project, User

db = SessionLocal()
first_user = db.query(User).first()
if first_user:
    updated = db.query(Project).filter(Project.user_id == None).update(
        {"user_id": first_user.id}
    )
    db.commit()
    print(f"Reassigned {updated} project(s) to {first_user.email}")
else:
    print("No users found. Register an account first, then re-run this script.")
db.close()
