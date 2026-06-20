from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    app_secret_key: str = "change-me"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Database
    sqlite_db_path: str = "./data/smaran.db"
    chroma_db_path: str = "./data/chroma_db"
    chroma_collection_faces: str = "faces"
    chroma_collection_memory: str = "memory"
    database_url: str = "DATABASE_URL"

    # Face Recognition
    face_similarity_threshold: float = 0.6
    face_detection_model: str = "buffalo_l"
    face_frame_skip: int = 3

    # Whisper
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_language: str = "en"

    # Ollama / LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ollama_context_window: int = 4096

    # WebSocket
    ws_max_connections: int = 10
    ws_heartbeat_interval: int = 30

    #supabase 
    supabase_url: str = "SUPABASE_URL"
    supabase_service_key: str = "SUPABASE_SERVICE_KEY"
    @property
    def data_dir(self) -> Path:
        return Path(self.sqlite_db_path).parent
    @property
    def using_postgres(self) -> bool:
        return bool(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
