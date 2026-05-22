from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    #database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str ="HS256"
    JWT_EXPIRE_HOURS:int = 24

    #Environment

    ENVIRONMENT: str = "development"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    EXTENSION_ORGIN: str = "chrome-extension://*"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

settings = Settings()
