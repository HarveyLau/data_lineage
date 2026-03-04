from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Data Lineage"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/lineage_app_db"
    
    # Gravitino
    GRAVITINO_URL: str = "http://localhost:8090"
    
    # Ollama
    OLLAMA_URL: str = "http://localhost:11434"
    
    # Security
    ENCRYPTION_KEY: str = "change_this_to_a_secure_key_in_production"
    GEMINI_API_KEY: Optional[str] = None
    
    # Marquez / OpenLineage
    MARQUEZ_URL: str = "http://marquez:5000"

    # OpenLineage Read API Security
    OPENLINEAGE_REQUIRE_API_KEY: bool = True
    OPENLINEAGE_API_KEYS: Optional[str] = None
    OPENLINEAGE_ADMIN_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()

