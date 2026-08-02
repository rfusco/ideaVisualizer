# ideaVisualizer

A full-stack web app that maps your project ideas as an interactive graph. Add projects with a name, description, tech stack, and timeframe — the ML pipeline embeds them semantically, clusters similar ones with HDBSCAN, and lays them out spatially with UMAP. Toggle between 2D (ReactFlow) and 3D (Three.js) views. Share your graph publicly with a single link.

---

## Features

- **Semantic graph** — projects positioned by meaning, not manually. Similar ideas cluster together and connect automatically.
- **ML pipeline** — SentenceTransformers → UMAP (2D or 3D) → HDBSCAN clustering, all running server-side on every change.
- **2D / 3D toggle** — switch between a flat ReactFlow canvas and an orbitable Three.js force graph. Both use real UMAP coordinates.
- **GitHub enrichment** — paste a GitHub URL and the form auto-fills name, description, and tech stack. Each project shows live activity status (active / stale / dormant / completed).
- **Share links** — generate a public URL for your graph. Viewers get a read-only version with the same 2D/3D toggle. Revoke at any time.
- **Multi-user auth** — JWT-based registration and login. Each user's projects are isolated.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router v7 |
| Graph (2D) | ReactFlow + D3 force simulation |
| Graph (3D) | react-force-graph-3d (Three.js) |
| HTTP client | Axios |
| Backend | FastAPI, Uvicorn |
| Database | SQLite (local) / PostgreSQL (production) via SQLAlchemy |
| Auth | JWT (python-jose, HS256), bcrypt |
| ML — Embed | `sentence-transformers` · `all-MiniLM-L6-v2` (384-dim) |
| ML — Reduce | UMAP (`umap-learn`) — 2D or 3D |
| ML — Cluster | HDBSCAN (`hdbscan`) on full 384-dim embeddings |
| GitHub API | `httpx`, 10-min in-memory cache |

---

## How the pipeline works

Every time a project is added, edited, or deleted, the backend re-runs the full pipeline on all of the user's projects:

1. **Embed** — each project's name, description, tools, and timeframe are concatenated into a single string and encoded by `all-MiniLM-L6-v2` into a 384-dimensional vector.
2. **Reduce** — UMAP reduces the embedding matrix to 2D or 3D (depending on the `?dims=` query param). Cosine metric, `n_neighbors = min(15, n−1)`.
3. **Cluster** — HDBSCAN clusters the original 384-dim vectors (not the reduced output), so cluster assignments are identical regardless of which view you're in. Returns a `cluster_id` and a `confidence` score (0–1) per project.

Projects are returned with `x`, `y`, `z`, `cluster_id`, and `confidence` attached. The frontend uses these directly — no client-side ML.

---

## Running locally

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
```

The SQLite database (`ideavisualizer.db`) is created automatically on first run. No environment variables are required for local development — `SECRET_KEY` defaults to a dev string.

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The CORS config in `backend/main.py` already allows `http://localhost:5173`, so no proxy setup is needed.

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `SECRET_KEY` | Backend | JWT signing secret. Defaults to a dev string — **set this in production**. |
| `DATABASE_URL` | Backend | PostgreSQL connection string. Omit to use SQLite locally. |
| `FRONTEND_URL` | Backend | Added to CORS allow-list. Set to your deployed frontend URL. |

---

## Project structure

```
ideaVisualizer/
├── backend/
│   ├── main.py          # FastAPI app, all routes
│   ├── pipeline.py      # Embed → UMAP → HDBSCAN
│   ├── database.py      # SQLAlchemy models + migrations
│   ├── auth.py          # JWT helpers
│   ├── github.py        # GitHub API client + cache
│   └── routers/
│       ├── auth_router.py
│       └── github_router.py
└── frontend/
    └── src/
        ├── App.jsx              # Root router + MainApp
        ├── api/axios.js         # Axios instance with JWT interceptor
        ├── context/AuthContext.jsx
        └── components/
            ├── GraphView.jsx    # 2D (ReactFlow) + 3D (ForceGraph3D)
            ├── ProjectForm.jsx  # Add / edit form with GitHub auto-fill
            ├── ProjectNode.jsx  # Custom ReactFlow node
            ├── SharedView.jsx   # Public read-only graph
            └── TagInput.jsx     # Tag input for tools field
```