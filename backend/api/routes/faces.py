import os
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.services.face.manager import FaceManager
from backend.core.exceptions import FaceNotDetectedError, PersonNotFoundError

router = APIRouter(prefix="/faces", tags=["faces"])

BASE_DIR         = Path(__file__).resolve().parents[2]   # smaran/backend/
FACES_UPLOAD_DIR = BASE_DIR / "uploads" / "faces"
FACES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/enroll/{person_id}")
async def enroll_face(
    person_id: int,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    from backend.models.person import Person
    from backend.models.face_embedding import FaceEmbedding

    # 1. Verify person exists
    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)

    # 2. Read file bytes
    contents = await image.read()

    # 3. Save image to disk first (same as your current code)
    file_extension = Path(image.filename).suffix or ".jpg"
    filename       = f"person_{person_id}_{uuid4().hex}{file_extension}"
    file_path      = FACES_UPLOAD_DIR / filename

    # Delete old photo file if re-enrolling
    if person.photo_path:
        old = FACES_UPLOAD_DIR / os.path.basename(person.photo_path)
        if old.is_file():
            old.unlink()

    with open(file_path, "wb") as f:
        f.write(contents)

    # 4. Decode for OpenCV
    arr   = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise FaceNotDetectedError()

    # 5. Detect faces
    manager  = FaceManager.get()
    detected = manager.detect(frame)
    if not detected:
        raise FaceNotDetectedError()

    # 6. Enroll best face into ChromaDB
    best = max(detected, key=lambda f: f["det_score"])
    manager.enroll(person_id, person.name, np.array(best["embedding"]))

    # 7. Update photo_path on Person
    public_path       = f"/uploads/faces/{filename}"
    person.photo_path = public_path

    # 8. Upsert FaceEmbedding row
    await db.refresh(person, ["face_embedding"])
    if person.face_embedding is None:
        db.add(FaceEmbedding(
            person_id  = person_id,
            photo_path = public_path,
            det_score  = round(float(best["det_score"]), 4),
        ))
    else:
        person.face_embedding.photo_path = public_path
        person.face_embedding.det_score  = round(float(best["det_score"]), 4)

    await db.commit()
    await db.refresh(person)

    return {
        "status":     "enrolled",
        "person_id":  person_id,
        "name":       person.name,
        "photo_path": person.photo_path,
        "det_score":  round(float(best["det_score"]), 4),
    }


@router.delete("/enroll/{person_id}", status_code=204)
async def unenroll_face(
    person_id: int,
    db: AsyncSession = Depends(get_db),
):
    from backend.models.person import Person

    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)

    # Remove from ChromaDB
    try:
        FaceManager.get()._chroma.delete(ids=[f"person_{person_id}"])
    except Exception:
        pass

    # Delete photo file
    if person.photo_path:
        old = FACES_UPLOAD_DIR / os.path.basename(person.photo_path)
        if old.is_file():
            old.unlink()
        person.photo_path = None

    # Delete FaceEmbedding row (cascade would also catch this on person delete,
    # but here the person is staying — only the face is being removed)
    await db.refresh(person, ["face_embedding"])
    if person.face_embedding is not None:
        await db.delete(person.face_embedding)

    await db.commit()


@router.get("/enrollment/{person_id}")
async def get_enrollment(
    person_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Check enrollment status for a person without hitting ChromaDB."""
    from backend.models.person import Person

    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)

    await db.refresh(person, ["face_embedding"])
    if person.face_embedding is None:
        return {"enrolled": False, "person_id": person_id}

    fe = person.face_embedding
    return {
        "enrolled":    True,
        "person_id":   person_id,
        "photo_path":  fe.photo_path,
        "det_score":   fe.det_score,
        "enrolled_at": fe.enrolled_at,
        "updated_at":  fe.updated_at,
    }