import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.person import Person
from backend.services.face.manager import FaceManager
from backend.models.conversation import ConversationLog
from backend.core.exceptions import PersonNotFoundError
from backend.core.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select

router = APIRouter(prefix="/persons", tags=["persons"])

BASE_DIR         = Path(__file__).resolve().parents[2]
FACES_UPLOAD_DIR = BASE_DIR / "uploads" / "faces"


class PersonCreate(BaseModel):
    name:     str
    nickname: Optional[str] = None
    relation: Optional[str] = None
    notes:    Optional[str] = None


@router.post("", status_code=201)
async def create_person(
    payload: PersonCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    person = Person(**payload.model_dump(), user_id=user_id)
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person


@router.get("")
async def list_persons(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    result = await db.execute(select(Person).where(Person.user_id == user_id))
    return result.scalars().all()


@router.get("/{person_id}")
async def get_person(
    person_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    person = await db.get(Person, person_id)
    if not person or person.user_id != user_id:
        raise PersonNotFoundError(person_id)
    return person


@router.patch("/{person_id}")
#async def update_person(person_id: int, payload: PersonCreate, db: AsyncSession = Depends(get_db)): 
async def update_person(person_id: int, payload: PersonCreate, db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user)):
    person = await db.get(Person, person_id)
    if not person or person.user_id != user_id:
        raise PersonNotFoundError(person_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    await db.commit()
    await db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=204)
async def delete_person(
    person_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    person = await db.get(Person, person_id)
    if not person or person.user_id != user_id:
        raise PersonNotFoundError(person_id)

    # 1. Delete all conversation logs for this person
    await db.execute(
        delete(ConversationLog).where(
            ConversationLog.person_id == person_id,
            ConversationLog.user_id == user_id,
        )
    )

    # 2. Remove face embedding from ChromaDB
    try:
        FaceManager.get()._chroma.delete(
            ids=[f"user_{user_id}_person_{person_id}"]
        )
    except Exception:
        pass

    # 3. Delete photo file from disk
    if person.photo_path:
        photo_file = FACES_UPLOAD_DIR / os.path.basename(person.photo_path)
        if photo_file.is_file():
            photo_file.unlink()

    # 4. Delete the person
    await db.delete(person)
    await db.commit()