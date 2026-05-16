"""
FaceManager — central service for face detection, embedding, and identification.
Uses InsightFace for embeddings and ChromaDB for vector similarity search.
"""
from __future__ import annotations
import numpy as np
from loguru import logger
from backend.core.config import get_settings
from backend.core.exceptions import ModelNotLoadedError

settings = get_settings()

class FaceManager:
    _instance: "FaceManager | None" = None

    def __init__(self):
        self._app = None           # insightface.app.FaceAnalysis
        self._chroma = None        # chromadb collection

    @classmethod
    def get(cls) -> "FaceManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self):
        """Load InsightFace model and connect to ChromaDB. Call once at startup."""
        import insightface
        import chromadb

        logger.info("Loading InsightFace model: {}", settings.face_detection_model)
        self._app = insightface.app.FaceAnalysis(name=settings.face_detection_model)
        self._app.prepare(ctx_id=0, det_size=(640, 640))

        client = chromadb.PersistentClient(path=settings.chroma_db_path)
        self._chroma = client.get_or_create_collection(
            name=settings.chroma_collection_faces,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("FaceManager ready. {} faces enrolled.", self._chroma.count())

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Return list of detected faces with bounding boxes and embeddings."""
        if self._app is None:
            raise ModelNotLoadedError("FaceManager not loaded — call load() first")
        faces = self._app.get(frame)
        return [
            {
                "bbox": face.bbox.tolist(),
                "embedding": face.embedding,
                "det_score": float(face.det_score),
            }
            for face in faces
        ]

    def identify(self, embedding: np.ndarray) -> dict | None:
        """
        Query ChromaDB for nearest face. Returns person metadata or None
        if similarity is below threshold.
        """
        results = self._chroma.query(
            query_embeddings=[embedding.tolist()],
            n_results=1,
            include=["metadatas", "distances"],
        )
        if not results["ids"][0]:
            return None
        distance = results["distances"][0][0]
        similarity = 1 - distance          # cosine distance → similarity
        if similarity < settings.face_similarity_threshold:
            return None
        return {
            **results["metadatas"][0][0],
            "similarity": round(similarity, 4),
        }

    def enroll(self, person_id: int, name: str, embedding: np.ndarray):
        """Store a face embedding for a known person."""
        self._chroma.upsert(
            ids=[f"person_{person_id}"],
            embeddings=[embedding.tolist()],
            metadatas=[{"person_id": person_id, "name": name}],
        )
        logger.info("Enrolled face for {} (id={})", name, person_id)
