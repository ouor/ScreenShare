from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    JANUS_ADMIN_URL: str = "http://localhost:7088/admin"
    JANUS_ADMIN_SECRET: str = "janusoverlord"

    class Config:
        case_sensitive = True

settings = Settings()
