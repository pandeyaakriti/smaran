"""
Navigation API routes — Phase 1 + Phase 2.

Prefix: /navigation   (registered in main.py without extra prefix)

Phase 1 (unchanged)
--------------------
GET    /locations
POST   /locations
PATCH  /locations/{location_id}
DELETE /locations/{location_id}
POST   /visits
GET    /visits/{location_id}

Phase 2 (new)
-------------
POST   /route                          Calculate + score routes, start session
GET    /route/active                   Get current active route for user
POST   /route/{route_id}/deviation     Frontend pings with GPS; returns new level
DELETE /route/{route_id}               Cancel navigation session
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
from backend.models.navigation import ActiveRoute, LocationVisit, SavedLocation
from backend.services.navigation.deviation import compute_deviation
from backend.services.navigation.osrm import get_routes
from backend.services.navigation.scorer import score_routes

router = APIRouter(prefix="/navigation", tags=["navigation"])

VALID_CATEGORIES = {"home", "medical", "social", "shopping", "other"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SavedLocationCreate(BaseModel):
    label:     str           = Field(..., min_length=1, max_length=120)
    notes:     Optional[str] = None
    latitude:  float
    longitude: float
    category:  str           = "other"
    is_pinned: bool          = False


class SavedLocationUpdate(BaseModel):
    label:     Optional[str]  = Field(None, min_length=1, max_length=120)
    notes:     Optional[str]  = None
    category:  Optional[str]  = None
    is_pinned: Optional[bool] = None


class VisitCreate(BaseModel):
    saved_location_id: str
    latitude:          float
    longitude:         float


class RouteRequest(BaseModel):
    origin_lat:     float
    origin_lng:     float
    dest_lat:       float
    dest_lng:       float
    destination_id: Optional[str] = None   # SavedLocation id if applicable


class DeviationPing(BaseModel):
    latitude:  float
    longitude: float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ, Δλ = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2
    return R * 2 * asin(sqrt(a))


async def _get_own_location(
    location_id: str, user_id: str, db: AsyncSession
) -> SavedLocation:
    loc = await db.get(SavedLocation, location_id)
    if not loc or loc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Location not found.")
    return loc


async def _get_own_route(
    route_id: str, user_id: str, db: AsyncSession
) -> ActiveRoute:
    route = await db.get(ActiveRoute, route_id)
    if not route or route.user_id != user_id:
        raise HTTPException(status_code=404, detail="Route not found.")
    return route


# ── Phase 1: Saved locations ──────────────────────────────────────────────────

@router.get("/locations")
async def list_locations(
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
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


@router.post("/visits", status_code=status.HTTP_201_CREATED)
async def record_visit(
    body:    VisitCreate,
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
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
    await _get_own_location(location_id, user_id, db)
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


# ── Phase 2: Route planning ───────────────────────────────────────────────────

@router.post("/route", status_code=status.HTTP_201_CREATED)
async def start_route(
    body:    RouteRequest,
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
    """
    1. Fetch up to 3 candidate routes from OSRM.
    2. Score each on time, distance, familiarity, crowd.
    3. Persist the best route as an ActiveRoute session.
    4. Return all scored candidates + the chosen route id.
    """
    # Cancel any existing active route for this user first.
    existing = await db.execute(
        select(ActiveRoute).where(
            ActiveRoute.user_id   == user_id,
            ActiveRoute.cancelled == False,
            ActiveRoute.completed_at == None,
        )
    )
    for old in existing.scalars().all():
        old.cancelled = True
    await db.flush()

    # Fetch + score routes.
    try:
        raw_routes = await get_routes(
            body.origin_lat, body.origin_lng,
            body.dest_lat,   body.dest_lng,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Routing service error: {exc}")

    if not raw_routes:
        raise HTTPException(status_code=404, detail="No route found between these points.")

    scored = await score_routes(raw_routes, user_id, db)
    best   = scored[0]

    active = ActiveRoute(
        user_id        = user_id,
        origin_lat     = body.origin_lat,
        origin_lng     = body.origin_lng,
        dest_lat       = body.dest_lat,
        dest_lng       = body.dest_lng,
        destination_id = body.destination_id,
        geometry       = best["geometry"],
        score_breakdown= best["score_breakdown"],
        osrm_summary   = {
            "duration": best["duration"],
            "distance": best["distance"],
        },
    )
    db.add(active)
    await db.commit()
    await db.refresh(active)

    return {
        "active_route":   active.to_dict(),
        "all_candidates": [
            {
                "geometry":       r["geometry"],
                "duration":       r["duration"],
                "distance":       r["distance"],
                "score_breakdown":r["score_breakdown"],
            }
            for r in scored
        ],
    }


@router.get("/route/active")
async def get_active_route(
    db:      AsyncSession = Depends(get_db),
    user_id: str          = Depends(get_current_user),
):
    """Return the user's current active route, or null if none."""
    result = await db.execute(
        select(ActiveRoute).where(
            ActiveRoute.user_id      == user_id,
            ActiveRoute.cancelled    == False,
            ActiveRoute.completed_at == None,
        )
    )
    route = result.scalars().first()
    return route.to_dict() if route else None


@router.post("/route/{route_id}/deviation")
async def check_deviation(
    route_id: str,
    body:     DeviationPing,
    db:       AsyncSession = Depends(get_db),
    user_id:  str          = Depends(get_current_user),
):
    """
    Called by the frontend every ~5 seconds while navigating.
    Returns the new deviation level and whether to notify the caregiver.
    """
    route = await _get_own_route(route_id, user_id, db)

    result = compute_deviation(
        lat                  = body.latitude,
        lng                  = body.longitude,
        geometry             = route.geometry,
        current_level        = route.deviation_level,
        deviation_started_at = route.deviation_started_at,
    )

    # Persist updated deviation state.
    route.deviation_level      = result["new_level"]
    route.deviation_started_at = result["deviation_started_at"]

    # Mark complete if user reached destination (within 30 m).
    dest_dist = _haversine_metres(
        body.latitude, body.longitude, route.dest_lat, route.dest_lng
    )
    arrived = dest_dist < 30
    if arrived:
        route.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        **result,
        "arrived":           arrived,
        "dest_distance_m":   round(dest_dist, 1),
    }


@router.delete("/route/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_route(
    route_id: str,
    db:       AsyncSession = Depends(get_db),
    user_id:  str          = Depends(get_current_user),
):
    route = await _get_own_route(route_id, user_id, db)
    route.cancelled = True
    await db.commit()