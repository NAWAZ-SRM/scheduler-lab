from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "your-super-secret-key-minimum-32-characters-change-in-production"
    
    DATABASE_URL: str = "postgresql+asyncpg://workbench:workbench@postgres:5432/workbench_db"
    
    JWT_SECRET_KEY: str = "your-jwt-secret-key-minimum-32-characters-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30
    
    FRONTEND_URL: str = "http://localhost:5173"
    
    MAX_CUSTOM_JOBS: int = 500
    JS_SANDBOX_TIMEOUT_MS: int = 50
    MAX_CONCURRENT_SIMULATIONS: int = 5
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
