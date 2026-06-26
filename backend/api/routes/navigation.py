"""
Navigation API routes.

Prefix: /api/navigation
Auth:   Supabase JWT via get_current_user dependency (same as other routes).

Phase 1 endpoints
-----------------
GET    /locations              list saved locations for current user
POST   /locations              create a new saved location
PATCH  /locations/{id}         update label / notes / pin
DELETE /locations/{id}         delete a location (cascades visits)
POST   /visits                 record a proximity visit (called by frontend)
GET    /visits/{location_id}   visit history for one location
"""

from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, get_db
from backend.models.navigation import LocationVisit, SavedLocation

router = APIRouter(prefix="/navigation", tags=["navigation"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"home", "medical", "social", "shopping", "other"}


class SavedLocationCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    notes: Optional[str] = None
    latitude: float
    longitude: float
    category: str = "other"
    is_pinned: bool = False


class SavedLocationUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=120)
    notes: Optional[str] = None
    category: Optional[str] = None
    is_pinned: Optional[bool] = None


class VisitCreate(BaseModel):
    saved_location_id: str
    latitude: float
    longitude: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius in metres
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ = radians(lat2 - lat1)
    Δλ = radians(lon2 - lon1)
    a = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2
    return R * 2 * asin(sqrt(a))


def _get_location_or_404(
    location_id: str, user_id: str, db: Session
) -> SavedLocation:
    loc = (
        db.query(SavedLocation)
        .filter(
            SavedLocation.id == location_id,
            SavedLocation.user_id == user_id,
        )
        .first()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")
    return loc


# ---------------------------------------------------------------------------
# Saved locations CRUD
# ---------------------------------------------------------------------------

@router.get("/locations")
def list_locations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all saved locations for the authenticated user, pinned first."""
    locations = (
        db.query(SavedLocation)
        .filter(SavedLocation.user_id == current_user.id)
        .order_by(SavedLocation.is_pinned.desc(), SavedLocation.label)
        .all()
    )
    return [loc.to_dict() for loc in locations]


@router.post("/locations", status_code=status.HTTP_201_CREATED)
def create_location(
    body: SavedLocationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"category must be one of {sorted(VALID_CATEGORIES)}",
        )

    loc = SavedLocation(
        user_id=current_user.id,
        label=body.label,
        notes=body.notes,
        latitude=body.latitude,
        longitude=body.longitude,
        category=body.category,
        is_pinned=body.is_pinned,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc.to_dict()


@router.patch("/locations/{location_id}")
def update_location(
    location_id: str,
    body: SavedLocationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    loc = _get_location_or_404(location_id, current_user.id, db)

    if body.label is not None:
        loc.label = body.label
    if body.notes is not None:
        loc.notes = body.notes
    if body.category is not None:
        if body.category not in VALID_CATEGORIES:
            raise HTTPException(status_code=422, detail="Invalid category.")
        loc.category = body.category
    if body.is_pinned is not None:
        loc.is_pinned = body.is_pinned

    loc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(loc)
    return loc.to_dict()


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    loc = _get_location_or_404(location_id, current_user.id, db)
    db.delete(loc)
    db.commit()


# ---------------------------------------------------------------------------
# Visit recording
# ---------------------------------------------------------------------------

@router.post("/visits", status_code=status.HTTP_201_CREATED)
def record_visit(
    body: VisitCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Called by the frontend when the device is detected near a saved location.
    Computes distance automatically from the saved location's coordinates.
    """
    loc = _get_location_or_404(body.saved_location_id, current_user.id, db)

    distance = _haversine_metres(
        body.latitude, body.longitude, loc.latitude, loc.longitude
    )

    visit = LocationVisit(
        user_id=current_user.id,
        saved_location_id=loc.id,
        latitude=body.latitude,
        longitude=body.longitude,
        distance_metres=round(distance, 1),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit.to_dict()


@router.get("/visits/{location_id}")
def get_visits(
    location_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the most recent visits for a saved location."""
    # Verify the location belongs to the user first.
    _get_location_or_404(location_id, current_user.id, db)

    visits = (
        db.query(LocationVisit)
        .filter(
            LocationVisit.saved_location_id == location_id,
            LocationVisit.user_id == current_user.id,
        )
        .order_by(LocationVisit.visited_at.desc())
        .limit(limit)
        .all()
    )
    return [v.to_dict() for v in visits]