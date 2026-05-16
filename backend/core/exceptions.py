from fastapi import HTTPException, status

class PersonNotFoundError(HTTPException):
    def __init__(self, person_id: int):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND,
                         detail=f"Person {person_id} not found")

class FaceNotDetectedError(HTTPException):
    def __init__(self):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                         detail="No face detected in the provided image")

class ModelNotLoadedError(RuntimeError):
    pass
