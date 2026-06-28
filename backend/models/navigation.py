"""
Navigation models — Phase 1 + Phase 2.

Tables
------
  saved_locations   Named places a user saves (home, clinic, park …)
  location_visits   Every proximity detection — feeds familiarity scorer
  active_routes     One row per in-progress navigation session; deleted on arrival/cancel
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float,
    ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship

from backend.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())

def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── SavedLocation ─────────────────────────────────────────────────────────────

class SavedLocation(Base):
    __tablename__ = "saved_locations"

    id         = Column(String, primary_key=True, default=_uuid)
    user_id    = Column(String, nullable=False, index=True)
    label      = Column(String(120), nullable=False)
    notes      = Column(Text, nullable=True)
    latitude   = Column(Float, nullable=False)
    longitude  = Column(Float, nullable=False)
    # "home" | "medical" | "social" | "shopping" | "other"
    category   = Column(String(32), nullable=False, default="other")
    is_pinned  = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    visits = relationship(
        "LocationVisit",
        back_populates="saved_location",
        cascade="all, delete-orphan",
    )


# ── LocationVisit ─────────────────────────────────────────────────────────────

class LocationVisit(Base):
    """
    Records when the device was near a saved location.
    Phase 2 uses visited_at hour + visit_count for familiarity scoring.
    """
    __tablename__ = "location_visits"

    id                = Column(String, primary_key=True, default=_uuid)
    user_id           = Column(String, nullable=False, index=True)
    saved_location_id = Column(
        String, ForeignKey("saved_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    latitude         = Column(Float, nullable=False)
    longitude        = Column(Float, nullable=False)
    distance_metres  = Column(Float, nullable=True)
    visited_at       = Column(DateTime(timezone=True), nullable=False, default=_now)

    saved_location = relationship("SavedLocation", back_populates="visits")


# ── ActiveRoute ───────────────────────────────────────────────────────────────

class ActiveRoute(Base):
    """
    One row per in-progress navigation session.

    geometry        GeoJSON LineString coordinates [[lng, lat], …] for the
                    chosen route — stored as JSON so we can do point-to-polyline
                    checks in Python without a PostGIS dependency.

    score_breakdown JSON snapshot of the scorer output:
                    { "total": 0.82, "time": 0.9, "distance": 0.85,
                      "familiarity": 0.7, "crowd": 0.8 }

    deviation_level  0 = on track
                     1 = first warning (amber banner)
                     2 = caregiver notified
                     escalates over time if user stays off route.

    osrm_summary    Raw OSRM summary { "duration": 420, "distance": 1200 }
    """
    __tablename__ = "active_routes"

    id          = Column(String, primary_key=True, default=_uuid)
    user_id     = Column(String, nullable=False, index=True)

    origin_lat  = Column(Float, nullable=False)
    origin_lng  = Column(Float, nullable=False)
    dest_lat    = Column(Float, nullable=False)
    dest_lng    = Column(Float, nullable=False)

    # ID of the SavedLocation used as destination (nullable — could be ad-hoc)
    destination_id = Column(
        String, ForeignKey("saved_locations.id", ondelete="SET NULL"),
        nullable=True,
    )

    geometry        = Column(JSON, nullable=False)   # [[lng, lat], …]
    score_breakdown = Column(JSON, nullable=False, default=dict)
    osrm_summary    = Column(JSON, nullable=False, default=dict)

    deviation_level      = Column(Integer, nullable=False, default=0)
    deviation_started_at = Column(DateTime(timezone=True), nullable=True)

    started_at   = Column(DateTime(timezone=True), nullable=False, default=_now)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled    = Column(Boolean, nullable=False, default=False)

    destination = relationship("SavedLocation", foreign_keys=[destination_id])

    def to_dict(self) -> dict:
        return {
            "id":               self.id,
            "user_id":          self.user_id,
            "origin":           {"latitude": self.origin_lat, "longitude": self.origin_lng},
            "destination":      {"latitude": self.dest_lat,   "longitude": self.dest_lng},
            "destination_id":   self.destination_id,
            "geometry":         self.geometry,
            "score_breakdown":  self.score_breakdown,
            "osrm_summary":     self.osrm_summary,
            "deviation_level":  self.deviation_level,
            "started_at":       self.started_at.isoformat(),
        }