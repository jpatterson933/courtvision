from fastapi import APIRouter
from sqlalchemy import text

from server.cache.redis_client import get_redis
from server.db.engine import async_session

router = APIRouter()


@router.get("/health")
async def health_check():
    db_ok = False
    redis_ok = False

    # Check database
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass

    # Check Redis
    try:
        r = get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    status = "ok" if (db_ok and redis_ok) else "degraded"
    return {"status": status, "db": db_ok, "redis": redis_ok}
