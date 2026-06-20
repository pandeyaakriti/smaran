from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.services.face.manager import FaceManager
from backend.core.exceptions import FaceNotDetectedError, PersonNotFoundError
from backend.core.auth import get_current_user
import numpy as np
import cv2

from pathlib import Path
from uuid import uuid4

router = APIRouter(prefix="/faces", tags=["faces"])

# backend/uploads/faces
BASE_DIR = Path(__file__).resolve().parents[2]
FACES_UPLOAD_DIR = BASE_DIR / "uploads" / "faces"

FACES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/enroll/{person_id}")
async def enroll_face(
    person_id: int,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Upload a photo to enroll a person's face embedding."""

    from backend.models.person import Person

    person = await db.get(Person, person_id)

    if not person:
        raise PersonNotFoundError(person_id)

    # Read uploaded file
    contents = await image.read()

    # Save image to disk
    file_extension = Path(image.filename).suffix or ".jpg"

    filename = f"person_{person_id}_{uuid4().hex}{file_extension}"

    file_path = FACES_UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    # Store public URL path in database
    person.photo_path = f"/uploads/faces/{filename}"

    await db.commit()
    await db.refresh(person)

    # Convert image for OpenCV
    arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise FaceNotDetectedError()

    # Detect face
    manager = FaceManager.get()
    faces = manager.detect(frame)

    if not faces:
        raise FaceNotDetectedError()

    # Use highest confidence face
    best = max(faces, key=lambda f: f["det_score"])

    manager.enroll(
        person_id,
        person.name,
        np.array(best["embedding"])
    )

    return {
        "status": "enrolled",
        "person_id": person_id,
        "name": person.name,
        "photo_path": person.photo_path
    }