import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict
import hdbscan
import umap

# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------
# This runs ONCE when the backend starts, not on every request.
# The model (~80MB) is downloaded automatically on first run and cached locally.
# Subsequent starts load from cache and are fast.
print("Loading sentence transformer model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Model loaded.")


# ---------------------------------------------------------------------------
# Text preparation
# ---------------------------------------------------------------------------
def build_text(project: Dict) -> str:
    """
    Combine a project's fields into a single string for embedding.
    
    We weight important fields by repeating them. The name and description
    carry the most semantic meaning, so they appear first and the description
    is included as-is. Tools are joined as a comma-separated list.
    Timeframe is included for context but matters least.
    """
    tools_str = ", ".join(project.get("tools", []))
    return (
        f"{project['name']}. "
        f"{project['description']} "
        f"Tools: {tools_str}. "
        f"Timeframe: {project.get('timeframe', '')}."
    )


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
def embed_projects(projects: List[Dict]) -> np.ndarray:
    """
    Convert a list of projects into a 2D numpy array of embeddings.
    Shape: (num_projects, 384)
    Each row is the embedding vector for one project.
    """
    texts = [build_text(p) for p in projects]
    embeddings = model.encode(texts, show_progress_bar=False)
    return np.array(embeddings)


# ---------------------------------------------------------------------------
# Dimensionality reduction (UMAP)
# ---------------------------------------------------------------------------
def reduce_dimensions(embeddings: np.ndarray) -> np.ndarray:
    """
    Reduce 384-dimensional embeddings to 2D for visualization.
    Returns array of shape (num_projects, 2) — the x,y coords for each node.

    n_neighbors: how many nearby points UMAP considers when learning structure.
                 Lower = more local detail, higher = more global structure.
                 15 is a good default for small datasets.
    min_dist:    how tightly UMAP packs points together in 2D.
                 0.1 gives compact but distinguishable clusters.
    metric:      cosine similarity works best for text embeddings.
    random_state: fixed seed so the layout doesn't randomly change each run.
    """
    if len(embeddings) < 2:
        # UMAP needs at least 2 points — return zeros for a single project
        return np.zeros((len(embeddings), 2))

    n_neighbors = min(15, len(embeddings) - 1)

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )
    return reducer.fit_transform(embeddings)


# ---------------------------------------------------------------------------
# Clustering (HDBSCAN)
# ---------------------------------------------------------------------------
def cluster_projects(embeddings: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Assign cluster labels and confidence scores to each project.

    Returns:
        labels: array of ints, one per project. -1 means 'noise' (no cluster).
        probabilities: array of floats 0-1, one per project. This is your
                       confidence score — how strongly a point belongs to
                       its assigned cluster.

    min_cluster_size: minimum number of projects to form a cluster.
                      2 means even a pair of similar projects clusters together.
    metric:           we cluster on the raw high-dim embeddings, not the 2D
                      UMAP output, because more dimensions = more information.
    """
    if len(embeddings) < 2:
        return np.array([0]), np.array([1.0])

    min_cluster_size = max(2, len(embeddings) // 10)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        metric="euclidean",
        preDiction_data=True,
    )
    clusterer.fit(embeddings)

    labels = clusterer.labels_
    probabilities = clusterer.probabilities_

    return labels, probabilities


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------
def run_pipeline(projects: List[Dict]) -> List[Dict]:
    """
    Run the full pipeline on the current project list.
    Attaches x, y, cluster_id, and confidence to each project Dict.
    Returns the enriched project list.
    """
    if not projects:
        return []

    # Step 1: embed all projects
    embeddings = embed_projects(projects)

    # Step 2: reduce to 2D
    coords_2d = reduce_dimensions(embeddings)

    # Step 3: cluster on full-dim embeddings
    labels, probabilities = cluster_projects(embeddings)

    # Step 4: attach results back to each project Dict
    enriched = []
    for i, project in enumerate(projects):
        enriched.append({
            **project,                         # all original fields preserved
            "x": float(coords_2d[i][0]),       # 2D x coordinate
            "y": float(coords_2d[i][1]),       # 2D y coordinate
            "cluster_id": int(labels[i]),      # cluster assignment (-1 = noise)
            "confidence": float(probabilities[i]),  # 0.0 to 1.0
        })

    return enriched