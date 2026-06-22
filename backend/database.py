from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import json

DATABASE_URL = "sqlite:///./ideavisualizer.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"

    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tools       = Column(Text, nullable=False)   # stored as JSON string
    timeframe   = Column(String, nullable=False)
    url         = Column(String, nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_tables():
    """Create all tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)


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