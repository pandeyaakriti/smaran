"""
backend/services/navigation/scorer.py

Scores each candidate route on four dimensions and returns a weighted total.

Dimensions
----------
1. time        — prefer faster routes          (OSRM duration)
2. distance    — prefer shorter routes         (OSRM distance)
3. familiarity — prefer routes near frequently
                 visited + time-of-day matched
                 saved locations               (LocationVisit history)
4. crowd       — prefer quieter road types     (OSM highway tags via Overpass)

Each dimension is normalised to [0, 1] across the candidate set so no single
axis dominates purely because of unit differences (seconds vs metres).

Weights (default, tunable per user in a later phase):
  time=0.25  distance=0.20  familiarity=0.35  crowd=0.20

The familiarity scorer rewards routes that pass near saved locations the user
has visited often AND at a similar time of day (morning vs afternoon vs evening).
"""

import math
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.navigation import LocationVisit, SavedLocation

# ── Weights ───────────────────────────────────────────────────────────────────

WEIGHTS = {
    "time":        0.25,
    "distance":    0.20,
    "familiarity": 0.35,
    "crowd":       0.20,
}

# A route waypoint is "near" a saved location if within this many metres.
FAMILIARITY_RADIUS_M = 150

# Time-of-day buckets (hour ranges, inclusive start exclusive end).
TIME_BUCKETS = [
    (5,  12, "morning"),
    (12, 17, "afternoon"),
    (17, 21, "evening"),
    (21, 24, "night"),
    (0,   5, "night"),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _time_bucket(dt: datetime) -> str:
    h = dt.hour
    for start, end, label in TIME_BUCKETS:
        if start <= h < end:
            return label
    return "night"


def _normalise(values: list[float]) -> list[float]:
    """Min-max normalise a list to [0, 1]. Returns [0.5, …] if all equal."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return [0.5] * len(values)
    return [(v - lo) / (hi - lo) for v in values]


# ── Familiarity scorer ────────────────────────────────────────────────────────

async def _familiarity_score(
    geometry:  list[list[float]],   # [[lng, lat], …]
    user_id:   str,
    db:        AsyncSession,
    now:       datetime,
) -> float:
    """
    0–1 score: how familiar is this route for this user right now?

    Algorithm
    ---------
    1. Load all saved locations + their visits for the user.
    2. For each geometry waypoint, check if any saved location is within
       FAMILIARITY_RADIUS_M metres.
    3. For each match, compute a visit score:
           base  = log(1 + visit_count)           — rewards frequent places
           tod   = fraction of visits in the same time-of-day bucket as now
           score = base * (0.5 + 0.5 * tod)      — time-of-day bonus up to 50%
    4. Sum scores, normalise by route length.
    """
    # Eagerly load visits in the same query — avoids lazy-load in async context.
    result = await db.execute(
        select(SavedLocation)
        .where(SavedLocation.user_id == user_id)
        .options(selectinload(SavedLocation.visits))
    )
    locations = result.scalars().all()

    if not locations:
        return 0.0

    # Build visit stats per location.
    current_bucket = _time_bucket(now)
    loc_stats: dict[str, dict] = {}
    for loc in locations:
        visits = loc.visits  # already loaded via relationship
        total  = len(visits)
        in_bucket = sum(
            1 for v in visits
            if _time_bucket(v.visited_at.astimezone(timezone.utc)) == current_bucket
        )
        loc_stats[loc.id] = {
            "lat":        loc.latitude,
            "lng":        loc.longitude,
            "visit_count": total,
            "tod_ratio":   in_bucket / total if total else 0.0,
        }

    # Sample waypoints (every 5th to keep it fast on long routes).
    waypoints = geometry[::5] or geometry

    total_score = 0.0
    for lng, lat in waypoints:
        best = 0.0
        for stats in loc_stats.values():
            dist = _haversine(lat, lng, stats["lat"], stats["lng"])
            if dist <= FAMILIARITY_RADIUS_M:
                base  = math.log(1 + stats["visit_count"])
                tod   = stats["tod_ratio"]
                score = base * (0.5 + 0.5 * tod)
                best  = max(best, score)
        total_score += best

    # Normalise: divide by max possible (log(1+100)=4.6 per waypoint).
    max_possible = math.log(1 + 100) * len(waypoints)
    return min(total_score / max_possible, 1.0) if max_possible else 0.0


# ── Main scorer ───────────────────────────────────────────────────────────────

async def score_routes(
    routes:  list[dict[str, Any]],   # from osrm.get_routes()
    user_id: str,
    db:      AsyncSession,
    now:     datetime | None = None,
) -> list[dict[str, Any]]:
    """
    Attach a score_breakdown and total_score to each route.
    Returns routes sorted best → worst.

    Each route gains:
        score_breakdown: {
            "time":        0–1,
            "distance":    0–1,
            "familiarity": 0–1,
            "crowd":       0–1,
            "total":       0–1,
        }
    """
    if not routes:
        return []

    now = now or datetime.now(timezone.utc)

    # ── Raw dimension values ──────────────────────────────────────────────────
    durations  = [r["duration"]    for r in routes]
    distances  = [r["distance"]    for r in routes]
    crowds     = [r["quiet_ratio"] for r in routes]

    fam_scores = []
    for r in routes:
        fam = await _familiarity_score(r["geometry"], user_id, db, now)
        fam_scores.append(fam)

    # ── Normalise time + distance (lower is better → invert after normalise) ─
    norm_time  = _normalise(durations)
    norm_dist  = _normalise(distances)
    norm_crowd = _normalise(crowds)
    # familiarity is already 0–1; normalise across candidates anyway
    norm_fam   = _normalise(fam_scores) if len(fam_scores) > 1 else fam_scores

    # ── Compose scores ────────────────────────────────────────────────────────
    scored = []
    for i, route in enumerate(routes):
        t_score   = 1.0 - norm_time[i]    # lower duration → higher score
        d_score   = 1.0 - norm_dist[i]    # shorter distance → higher score
        f_score   = norm_fam[i]
        c_score   = norm_crowd[i]

        total = (
            WEIGHTS["time"]        * t_score +
            WEIGHTS["distance"]    * d_score +
            WEIGHTS["familiarity"] * f_score +
            WEIGHTS["crowd"]       * c_score
        )

        scored.append({
            **route,
            "score_breakdown": {
                "time":        round(t_score, 3),
                "distance":    round(d_score, 3),
                "familiarity": round(f_score, 3),
                "crowd":       round(c_score, 3),
                "total":       round(total,   3),
            },
        })

    scored.sort(key=lambda r: r["score_breakdown"]["total"], reverse=True)
    return scored