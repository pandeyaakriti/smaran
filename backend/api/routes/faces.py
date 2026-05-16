from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.services.face.manager import FaceManager
from backend.core.exceptions import FaceNotDetectedError, PersonNotFoundError
import numpy as np
import cv2

router = APIRouter(prefix="/faces", tags=["faces"])

@router.post("/enroll/{person_id}")
async def enroll_face(person_id: int, image: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Upload a photo to enroll a person's face embedding."""
    from backend.models.person import Person
    person = await db.get(Person, person_id)
    if not person:
        raise PersonNotFoundError(person_id)

    contents = await image.read()
    arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    manager = FaceManager.get()
    faces = manager.detect(frame)
    if not faces:
        raise FaceNotDetectedError()

    # Use the highest-confidence face
    best = max(faces, key=lambda f: f["det_score"])
    manager.enroll(person_id, person.name, np.array(best["embedding"]))
    return {"status": "enrolled", "person_id": person_id, "name": person.name}
