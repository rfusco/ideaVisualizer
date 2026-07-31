import re
import time
from datetime import datetime, timezone
from typing import Optional
import httpx

# In-memory cache: {repo_url: {"data": {...}, "fetched_at": timestamp}}
_cache: dict = {}
CACHE_TTL_SECONDS = 600  # 10 minutes


def _parse_github_url(url: str) -> Optional[tuple[str, str]]:
    """Extract (owner, repo) from a GitHub URL. Returns None if not a GitHub URL."""
    if not url:
        return None
    match = re.match(
        r"https?://github\.com/([^/]+)/([^/?\s#]+)", url.strip().rstrip("/")
    )
    if not match:
        return None
    return match.group(1), match.group(2)


def _days_since(iso_timestamp: Optional[str]) -> Optional[int]:
    if not iso_timestamp:
        return None
    pushed = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - pushed).days


def _derive_status(archived: bool, days_since_push: Optional[int]) -> str:
    if archived:
        return "completed"
    if days_since_push is None:
        return "idea"
    if days_since_push <= 30:
        return "active"
    if days_since_push <= 180:
        return "stale"
    return "dormant"


def fetch_repo_info(url: str) -> Optional[dict]:
    """
    Fetch GitHub repo metadata for a given URL.
    Returns None if the URL is not a valid GitHub repo URL or the request fails.
    Result is cached for CACHE_TTL_SECONDS.
    """
    parsed = _parse_github_url(url)
    if not parsed:
        return None

    owner, repo = parsed
    cache_key = f"{owner}/{repo}"

    # Return cached result if still fresh
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["fetched_at"]) < CACHE_TTL_SECONDS:
        return cached["data"]

    try:
        response = httpx.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=5.0,
        )
        if response.status_code != 200:
            return None

        raw = response.json()
        days = _days_since(raw.get("pushed_at"))
        data = {
            "github_status":      _derive_status(raw.get("archived", False), days),
            "github_days_since":  days,
            "github_stars":       raw.get("stargazers_count", 0),
            "github_language":    raw.get("language"),
            "github_topics":      raw.get("topics", []),
            "github_description": raw.get("description"),
            "github_name":        raw.get("name"),
            "github_archived":    raw.get("archived", False),
        }
        _cache[cache_key] = {"data": data, "fetched_at": time.time()}
        return data

    except Exception:
        return None
