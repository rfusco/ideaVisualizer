from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import json
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ideavisualizer.db")
# Render provides postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    email        = Column(String, unique=True, index=True, nullable=False)
    hashed_pw    = Column(String, nullable=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    share_token  = Column(String, unique=True, nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tools       = Column(Text, nullable=False)
    timeframe   = Column(String, nullable=False)
    url         = Column(String, nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)


def create_tables():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE projects ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id)"))
            conn.commit()
        except Exception:
            pass  # column already exists
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN share_token TEXT"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_share_token ON users (share_token)"))
            conn.commit()
        except Exception:
            pass  # column already exists


def get_db():
    """
    Yields a database session and guarantees it closes afterward.
    Used as a FastAPI dependency.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def row_to_dict(row: Project) -> dict:
    """Convert a SQLAlchemy Project row to a plain dict matching your existing shape."""
    return {
        "id":          row.id,
        "name":        row.name,
        "description": row.description,
        "tools":       json.loads(row.tools),
        "timeframe":   row.timeframe,
        "url":         row.url,
    }