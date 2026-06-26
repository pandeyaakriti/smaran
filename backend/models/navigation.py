"""
Navigation models for the Alzheimer's assistant.

Tables:
  saved_locations  – named places a user saves (home, clinic, park …)
  location_visits  – every time the device records being near a saved location;
                     used later by Phase 2 to score familiarity.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

# Re-use the same declarative Base the rest of the project uses.
from backend.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class SavedLocation(Base):
    """A named place saved by (or for) a user."""

    __tablename__ = "saved_locations"

    id = Column(String, primary_key=True, default=_uuid)

    # Every user-owned table scopes by user_id (string, matches Supabase UID).
    user_id = Column(String, nullable=False, index=True)

    # Human-readable label shown in the UI ("Home", "Dr. Sharma's clinic" …)
    label = Column(String(120), nullable=False)

    # Optional longer note for the caregiver ("Turn left at the blue gate")
    notes = Column(Text, nullable=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # "home" | "medical" | "social" | "shopping" | "other"
    category = Column(String(32), nullable=False, default="other")

    # Pinned locations always appear at the top of the list.
    is_pinned = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    visits = relationship(
        "LocationVisit",
        back_populates="saved_location",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "label": self.label,
            "notes": self.notes,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "category": self.category,
            "is_pinned": self.is_pinned,
            "visit_count": len(self.visits),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class LocationVisit(Base):
    """
    Records when a user was detected near a saved location.

    Phase 1: written when the frontend pings /navigation/visits.
    Phase 2: used to compute a familiarity score for route weighting.
    """

    __tablename__ = "location_visits"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)

    saved_location_id = Column(
        String,
        ForeignKey("saved_locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Raw GPS snapshot at time of visit.
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Metres from the saved location centre at time of detection.
    distance_metres = Column(Float, nullable=True)

    visited_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    saved_location = relationship("SavedLocation", back_populates="visits")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "saved_location_id": self.saved_location_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "distance_metres": self.distance_metres,
            "visited_at": self.visited_at.isoformat(),
        }