"""
backend/services/navigation/deviation.py

Point-to-polyline distance + escalation logic.

Escalation levels
-----------------
  0  on track
  1  first warning  — amber banner in UI
  2  caregiver notified — WebSocket push (handled in the route handler)
     triggered when user stays at level 1 for > ESCALATE_TO_2_SECONDS

Thresholds (tunable)
--------------------
  OFF_ROUTE_METRES     = 50   — distance from polyline to count as "off route"
  ESCALATE_TO_2_SECONDS = 30  — seconds at level 1 before escalating to level 2
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

OFF_ROUTE_METRES      = 50
ESCALATE_TO_2_SECONDS = 30


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _point_to_segment_distance(
    px: float, py: float,   # point (lng, lat in radians)
    ax: float, ay: float,   # segment start
    bx: float, by: float,   # segment end
) -> float:
    """
    Approximate shortest distance (metres) from a point to a line segment,
    using equirectangular projection (accurate enough for <5 km segments).
    """
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        # Degenerate segment — just distance to point a.
        return _haversine(py, px, ay, ax)

    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    cx = ax + t * dx
    cy = ay + t * dy
    return _haversine(py, px, cy, cx)


def distance_to_polyline(
    lat: float,
    lng: float,
    geometry: list[list[float]],  # [[lng, lat], …] from OSRM
) -> float:
    """Return metres from (lat, lng) to the nearest point on the route polyline."""
    if not geometry or len(geometry) < 2:
        return 0.0

    min_dist = math.inf
    for i in range(len(geometry) - 1):
        a_lng, a_lat = geometry[i]
        b_lng, b_lat = geometry[i + 1]
        d = _point_to_segment_distance(lng, lat, a_lng, a_lat, b_lng, b_lat)
        if d < min_dist:
            min_dist = d

    return min_dist


# ── Escalation logic ──────────────────────────────────────────────────────────

def compute_deviation(
    lat:                  float,
    lng:                  float,
    geometry:             list[list[float]],
    current_level:        int,
    deviation_started_at: Optional[datetime],
    now:                  Optional[datetime] = None,
) -> dict:
    """
    Given the user's current GPS position and the active route, return:
    {
        "off_route":             bool,
        "distance_from_route":   float,   # metres
        "new_level":             int,     # 0 | 1 | 2
        "deviation_started_at":  datetime | None,
        "notify_caregiver":      bool,
    }
    """
    now    = now or datetime.now(timezone.utc)
    dist   = distance_to_polyline(lat, lng, geometry)
    off    = dist > OFF_ROUTE_METRES

    new_level             = current_level
    new_deviation_started = deviation_started_at
    notify_caregiver      = False

    if not off:
        # Back on track — reset.
        new_level             = 0
        new_deviation_started = None

    elif current_level == 0:
        # First detection.
        new_level             = 1
        new_deviation_started = now

    elif current_level == 1:
        # Already warned — check how long they've been off route.
        started = deviation_started_at or now
        seconds_off = (now - started).total_seconds()
        if seconds_off >= ESCALATE_TO_2_SECONDS:
            new_level        = 2
            notify_caregiver = True

    # Level 2 stays at 2 until they get back on track.

    return {
        "off_route":            off,
        "distance_from_route":  round(dist, 1),
        "new_level":            new_level,
        "deviation_started_at": new_deviation_started,
        "notify_caregiver":     notify_caregiver,
    }