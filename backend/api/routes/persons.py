from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.models.person import Person
from backend.core.exceptions import PersonNotFoundError
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select

router = APIRouter(prefix="/persons", tags=["persons"])

class PersonCreate(BaseModel):
    name: str
    nickname: Optional[str] = None
    relation: Optional[str] = None
    notes: Optional[str] = None

@router.post("", status_code=201)
async def create_person(payload: PersonCreate, db: AsyncSession = Depends(get_db)):
    person = Person(**payload.model_dump())
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person

@router.get("")
async def list_persons(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Person))
    return result.scalars().all()

@router.get("/{person_id}")
async def get_person(person_id: int, db: AsyncSession = Depends(get_db)):
    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)
    return person

@router.patch("/{person_id}")
async def update_person(person_id: int, payload: PersonCreate, db: AsyncSession = Depends(get_db)):
    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    await db.commit()
    await db.refresh(person)
    return person

@router.delete("/{person_id}", status_code=204)
async def delete_person(person_id: int, db: AsyncSession = Depends(get_db)):
    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)
    await db.delete(person)
    await db.commit()