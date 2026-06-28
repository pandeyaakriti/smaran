"""
backend/services/navigation/osrm.py

Fetches up to 3 alternative routes from the public OSRM demo server.
Each route includes:
  - geometry as a list of [lng, lat] coordinate pairs
  - duration (seconds) and distance (metres) from OSRM's summary
  - per-step OSM highway tags fetched from the Overpass API so the
    scorer can compute a quiet-road ratio without a paid API key.

In production you should self-host OSRM:
  https://github.com/Project-OSRM/osrm-backend
"""

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Public OSRM demo — fine for development; swap base URL for self-hosted.
OSRM_BASE = "https://router.project-osrm.org"

# Overpass API for OSM highway tag lookup.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# OSM highway values ordered quiet → busy.
# Score = 1.0 for most quiet, 0.0 for motorway.
HIGHWAY_QUIET_SCORE: dict[str, float] = {
    "footway":       1.0,
    "path":          1.0,
    "pedestrian":    1.0,
    "living_street": 0.95,
    "residential":   0.85,
    "unclassified":  0.75,
    "service":       0.70,
    "tertiary":      0.55,
    "secondary":     0.40,
    "primary":       0.25,
    "trunk":         0.10,
    "motorway":      0.00,
}
DEFAULT_QUIET_SCORE = 0.60   # fallback for unknown highway types


async def _fetch_osrm_routes(
    origin_lat: float, origin_lng: float,
    dest_lat:   float, dest_lng:   float,
    max_alternatives: int = 2,
) -> list[dict[str, Any]]:
    """
    Call OSRM route API and return raw route objects.
    alternatives=2 asks for up to 2 extra routes (3 total).
    """
    url = (
        f"{OSRM_BASE}/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?alternatives={max_alternatives}"
        f"&geometries=geojson"
        f"&overview=full"
        f"&steps=true"
        f"&annotations=false"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM error: {data.get('message', 'unknown')}")

    return data["routes"]


async def _highway_quiet_ratio(way_ids: list[int]) -> float:
    """
    Query Overpass for highway tags of the given OSM way IDs.
    Returns a 0–1 score where 1 = entirely quiet roads.
    """
    if not way_ids:
        return DEFAULT_QUIET_SCORE

    ids_str = "".join(f"way({wid});" for wid in way_ids[:60])  # cap at 60 ways
    query = f"[out:json][timeout:10];({ids_str});out tags;"

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
    except Exception as exc:
        logger.warning("Overpass query failed: %s — using default quiet score", exc)
        return DEFAULT_QUIET_SCORE

    scores = []
    for el in elements:
        hw = el.get("tags", {}).get("highway", "")
        scores.append(HIGHWAY_QUIET_SCORE.get(hw, DEFAULT_QUIET_SCORE))

    return sum(scores) / len(scores) if scores else DEFAULT_QUIET_SCORE


def _extract_way_ids(route: dict) -> list[int]:
    """Pull OSM way IDs from OSRM step annotations (present when steps=true)."""
    way_ids = []
    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            wid = step.get("way_id")
            if wid:
                way_ids.append(int(wid))
    return way_ids


async def get_routes(
    origin_lat: float, origin_lng: float,
    dest_lat:   float, dest_lng:   float,
) -> list[dict[str, Any]]:
    """
    Return up to 3 candidate routes, each shaped as:
    {
        "geometry":     [[lng, lat], …],
        "duration":     420,          # seconds
        "distance":     1200,         # metres
        "quiet_ratio":  0.82,         # 0–1, higher = quieter roads
    }
    """
    raw_routes = await _fetch_osrm_routes(origin_lat, origin_lng, dest_lat, dest_lng)

    # Fetch quiet ratios for all routes concurrently.
    quiet_tasks = [
        _highway_quiet_ratio(_extract_way_ids(r))
        for r in raw_routes
    ]
    quiet_ratios = await asyncio.gather(*quiet_tasks)

    results = []
    for route, quiet_ratio in zip(raw_routes, quiet_ratios):
        coords = route["geometry"]["coordinates"]   # already [lng, lat] pairs
        leg    = route["legs"][0] if route.get("legs") else {}
        results.append({
            "geometry":    coords,
            "duration":    route.get("duration", leg.get("duration", 0)),
            "distance":    route.get("distance", leg.get("distance", 0)),
            "quiet_ratio": quiet_ratio,
        })

    return results