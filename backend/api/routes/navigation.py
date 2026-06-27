"""
Navigation API routes.

Prefix: /api/navigation
Auth:   Supabase JWT via get_current_user (backend.core.auth) — same as persons.py.

Phase 1 endpoints
-----------------
GET    /locations                  list saved locations for current user
POST   /locations                  create a new saved location
PATCH  /locations/{location_id}    update label / notes / pin / category
DELETE /locations/{location_id}    delete a location (visits cascade)
POST   /visits                     record a proximity visit (called by frontend)
GET    /visits/{location_id}       visit history for one location
"""

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import get_current_user
from backend.db.database import get_db
from backend.models.navigation import LocationVisit, SavedLocation

router = APIRouter(prefix="/navigation", tags=["navigation"])

VALID_CATEGORIES = {"home", "medical", "social", "shopping", "other"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SavedLocationCreate(BaseModel):
    label:     str            = Field(..., min_length=1, max_length=120)
    notes:     Optional[str]  = None
    latitude:  float
    longitude: float
    category:  str            = "other"
    is_pinned: bool           = False


class SavedLocationUpdate(BaseModel):
    label:     Optional[str]  = Field(None, min_length=1, max_length=120)
    notes:     Optional[str]  = None
    category:  Optional[str]  = None
    is_pinned: Optional[bool] = None


class VisitCreate(BaseModel):
    saved_location_id: str
    latitude:          float
    longitude:         float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two GPS coordinates."""
    R = 6_371_000
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ, Δλ = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2
    return R * 2 * asin(sqrt(a))


async def _get_own_location(
    location_id: str,
    user_id:     str,
    db:          AsyncSession,
) -> SavedLocation:
    """Fetch a SavedLocation row, raising 404 if missing or owned by another user."""
    loc = await db.get(SavedLocation, location_id)
    if not loc or loc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Location not found.")
    return loc


# ── Saved locations CRUD ──────────────────────────────────────────────────────

@router.get("/locations")
async def list_locations(
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
    """Return all saved locations for the current user, pinned first."""
    result = await db.execute(
        select(SavedLocation)
        .where(SavedLocation.user_id == user_id)
        .order_by(SavedLocation.is_pinned.desc(), SavedLocation.label)
    )
    return result.scalars().all()


@router.post("/locations", status_code=status.HTTP_201_CREATED)
async def create_location(
    body:    SavedLocationCreate,
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"category must be one of {sorted(VALID_CATEGORIES)}",
        )
    loc = SavedLocation(**body.model_dump(), user_id=user_id)
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc


@router.patch("/locations/{location_id}")
async def update_location(
    location_id: str,
    body:        SavedLocationUpdate,
    db:          AsyncSession = Depends(get_db),
    user_id:     str          = Depends(get_current_user),
):
    loc = await _get_own_location(location_id, user_id, db)

    updates = body.model_dump(exclude_unset=True)
    if "category" in updates and updates["category"] not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category.")

    for field, value in updates.items():
        setattr(loc, field, value)

    loc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(loc)
    return loc


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    db:          AsyncSession = Depends(get_db),
    user_id:     str          = Depends(get_current_user),
):
    loc = await _get_own_location(location_id, user_id, db)
    await db.delete(loc)
    await db.commit()


# ── Visit recording ───────────────────────────────────────────────────────────

@router.post("/visits", status_code=status.HTTP_201_CREATED)
async def record_visit(
    body:    VisitCreate,
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
    """
    Called by the frontend when the device is near a saved location.
    Computes distance from the saved location's coordinates automatically.
    """
    loc = await _get_own_location(body.saved_location_id, user_id, db)

    visit = LocationVisit(
        user_id           = user_id,
        saved_location_id = loc.id,
        latitude          = body.latitude,
        longitude         = body.longitude,
        distance_metres   = round(
            _haversine_metres(body.latitude, body.longitude, loc.latitude, loc.longitude), 1
        ),
    )
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    return visit


@router.get("/visits/{location_id}")
async def get_visits(
    location_id: str,
    limit:       int          = 50,
    db:          AsyncSession = Depends(get_db),
    user_id:     str          = Depends(get_current_user),
):
    """Return the most recent visits for one saved location."""
    await _get_own_location(location_id, user_id, db)   # ownership check

    result = await db.execute(
        select(LocationVisit)
        .where(
            LocationVisit.saved_location_id == location_id,
            LocationVisit.user_id           == user_id,
        )
        .order_by(LocationVisit.visited_at.desc())
        .limit(limit)
    )
    return result.scalars().all()