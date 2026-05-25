from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from backend.db.database import Base

class ConversationLog(Base):
    __tablename__ = "conversation_logs"

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(String(64), index=True)
    person_id   = Column(Integer, ForeignKey("persons.id"), nullable=True)
    speaker     = Column(String(60), default="unknown")   # "user" | person name
    transcript  = Column(Text, nullable=False)
    confidence  = Column(Float, nullable=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now())
