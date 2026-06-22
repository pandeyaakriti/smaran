import cv2
import numpy as np
from insightface.app import FaceAnalysis

# load model once
app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0, det_size=(640, 640))


def get_embedding(image_bytes: bytes):
    """
    Convert image → face embedding vector
    """

    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    faces = app.get(img)

    if not faces:
        return None, None

    face = faces[0]

    return face.embedding, face.bbox