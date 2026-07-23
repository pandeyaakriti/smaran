from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.core.auth import get_current_user
from backend.models.user_settings import UserSettings
from backend.models.person import Person
from backend.services.face.manager import FaceManager

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    face_similarity_threshold: Optional[float] = None
    face_frame_skip: Optional[int] = None
    whisper_model_size: Optional[str] = None
    whisper_language: Optional[str] = None
    ollama_model: Optional[str] = None


async def _get_or_create_settings(db: AsyncSession, user_id: str) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return await _get_or_create_settings(db, user_id)


@router.patch("")
async def update_settings(
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    settings = await _get_or_create_settings(db, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return settings


@router.get("/stats")
async def get_data_stats(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Returns counts of what's stored for this user — shown in Data & Privacy section."""
    result = await db.execute(
        select(func.count()).select_from(Person).where(Person.user_id == user_id)
    )
    person_count = result.scalar() or 0

    # Count enrolled face embeddings for this user via ChromaDB metadata
    try:
        manager = FaceManager.get()
        all_faces = manager._chroma.get(where={"user_id": user_id}) if manager._chroma else None
        face_count = len(all_faces["ids"]) if all_faces else 0
    except Exception:
        face_count = 0

    return {"person_count": person_count, "face_embedding_count": face_count}


@router.delete("/data")
async def delete_all_data(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    Deletes all user data:
    - Persons
    - FaceEmbedding rows (cascade)
    - Face images on disk
    - ChromaDB embeddings
    - User settings
    """

    import os
    from pathlib import Path

    BASE_DIR = Path(__file__).resolve().parents[2]
    FACES_UPLOAD_DIR = BASE_DIR / "uploads" / "faces"

    # Get all persons for this user
    result = await db.execute(
        select(Person).where(Person.user_id == user_id)
    )
    persons = result.scalars().all()

    # Delete each person's image file
    for person in persons:
        if person.photo_path:
            photo_file = FACES_UPLOAD_DIR / os.path.basename(person.photo_path)
            if photo_file.exists():
                photo_file.unlink()

    # Delete all Chroma embeddings for this user
    try:
        manager = FaceManager.get()
        if manager._chroma:
            existing = manager._chroma.get(where={"user_id": user_id})
            if existing and existing["ids"]:
                manager._chroma.delete(ids=existing["ids"])
    except Exception as e:
        print(f"Failed deleting Chroma embeddings: {e}")

    # Delete all persons
    for person in persons:
        await db.delete(person)

    # Delete user settings
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        await db.delete(settings)

    await db.commit()

    return {"status": "deleted"}