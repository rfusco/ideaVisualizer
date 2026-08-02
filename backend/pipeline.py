import numpy as np
from typing import List, Dict
import hdbscan
import umap


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
def embed_projects(projects: List[Dict], model) -> np.ndarray:
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
def reduce_dimensions(embeddings: np.ndarray, dims: int = 2) -> np.ndarray:
    """
    Reduce 384-dimensional embeddings to `dims` dimensions (2 or 3).
    Returns array of shape (num_projects, dims).

    dims=2 produces x,y for the 2D ReactFlow graph.
    dims=3 produces x,y,z for the 3D force graph.

    HDBSCAN runs on the original 384-dim embeddings separately, so clustering
    quality is the same regardless of what dims is set to here.
    """
    if len(embeddings) < 2:
        return np.zeros((len(embeddings), dims))

    # Spread tiny datasets manually — UMAP's eigensolver breaks when
    # n_neighbors approaches the dataset size
    if len(embeddings) < 4:
        if dims == 2:
            angles = np.linspace(0, 2 * np.pi, len(embeddings), endpoint=False)
            return np.column_stack([np.cos(angles), np.sin(angles)])
        else:
            # Distribute on a sphere surface for 3D tiny datasets
            angles = np.linspace(0, 2 * np.pi, len(embeddings), endpoint=False)
            return np.column_stack([np.cos(angles), np.sin(angles), np.zeros(len(embeddings))])

    n_neighbors = min(15, len(embeddings) - 1)

    reducer = umap.UMAP(
        n_components=dims,
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

    min_cluster_size = max(3, len(embeddings) // 10)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=2,
        min_samples=1,
        metric="euclidean",
        cluster_selection_epsilon=0.5,  # max distance for points to be in the same cluster
    )
    clusterer.fit(embeddings)

    labels = clusterer.labels_
    probabilities = clusterer.probabilities_

    return labels, probabilities


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------
def run_pipeline(projects: List[Dict], model, dims: int = 2) -> List[Dict]:
    """
    Run the full pipeline on the current project list.
    Attaches x, y, z, cluster_id, and confidence to each project dict.

    dims=2: z is always 0.0 (UMAP runs in 2D)
    dims=3: z is the real third UMAP coordinate
    """
    if not projects:
        return []

    embeddings = embed_projects(projects, model)

    print("Number of embeddings:", len(embeddings))

    # Reduce to 2D or 3D depending on the requested view
    coords = reduce_dimensions(embeddings, dims=dims)

    # Clustering always runs on the full 384-dim embeddings — dims doesn't affect it
    labels, probabilities = cluster_projects(embeddings)

    enriched = []
    for i, project in enumerate(projects):
        enriched.append({
            **project,
            "x": float(coords[i][0]),
            "y": float(coords[i][1]),
            "z": float(coords[i][2]) if dims == 3 else 0.0,
            "cluster_id": int(labels[i]),
            "confidence": float(probabilities[i]),
        })

    return enriched