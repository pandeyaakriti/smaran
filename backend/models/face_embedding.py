from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.db.database import Base


class FaceEmbedding(Base):
    """
    Tracks that a face embedding exists in ChromaDB for a given person.

    We don't store the raw embedding vector here (ChromaDB owns that),
    but we record enough metadata to:
      - know which persons are enrolled
      - clean up ChromaDB / disk when a person is deleted
      - surface enrollment info via the API without hitting ChromaDB
    """
    __tablename__ = "face_embeddings"

    id          = Column(Integer, primary_key=True, index=True)
    person_id   = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, unique=True)
    photo_path  = Column(String(512), nullable=True)   # relative URL: /uploads/faces/<filename>
    det_score   = Column(Float, nullable=True)          # InsightFace detection confidence
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    # Back-reference so you can do  person.face_embedding
    person = relationship("Person", back_populates="face_embedding")