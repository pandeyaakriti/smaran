from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from backend.db.database import Base

class UserSettings(Base):
    __tablename__ = "user_settings"

    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(String(64), nullable=False, unique=True, index=True)

    # Face recognition
    face_similarity_threshold = Column(Float, default=0.6)
    face_frame_skip            = Column(Integer, default=3)

    # Speech
    whisper_model_size        = Column(String(20), default="base")
    whisper_language          = Column(String(10), default="en")

    # Memory / LLM
    ollama_model              = Column(String(60), default="llama3.2")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())