from fastapi import APIRouter, HTTPException
import auth
from fastapi import Depends
from github import fetch_repo_info
import database

router = APIRouter(prefix="/api/github", tags=["github"])


@router.get("/repo-info")
def repo_info(
    url: str,
    current_user: database.User = Depends(auth.get_current_user),
):
    data = fetch_repo_info(url)
    if data is None:
        raise HTTPException(status_code=404, detail="Not a valid GitHub repo URL or repo not found")
    return data
