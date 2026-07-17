from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from backend.core.config import get_settings
import os

settings = get_settings()

if settings.using_postgres:
    db_url = settings.database_url
else:
    os.makedirs(os.path.dirname(settings.sqlite_db_path), exist_ok=True)
    db_url = f"sqlite+aiosqlite:///{settings.sqlite_db_path}"

print(db_url)
engine = create_async_engine(
    db_url,
    echo=settings.app_env == "development",
    connect_args={
        "statement_cache_size": 0,
    },
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session