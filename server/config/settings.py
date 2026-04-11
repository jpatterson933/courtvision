from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://courtvision:courtvision@localhost:5432/courtvision"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # API Keys (populated via .env)
    sportradar_api_key: str = ""
    second_spectrum_api_key: str = ""
    synergy_api_key: str = ""
    stats_perform_api_key: str = ""

    model_config = {"env_prefix": "CV_", "env_file": ".env"}


settings = Settings()
