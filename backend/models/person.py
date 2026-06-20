from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from backend.db.database import Base

class Person(Base):
    __tablename__ = "persons"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(String(64), nullable=False, index=True) # for a specific user
    name       = Column(String(120), nullable=False)
    nickname   = Column(String(60), nullable=True)
    relation   = Column(String(60), nullable=True)   
    notes      = Column(Text, nullable=True)          # freeform memory notes
    photo_path = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
