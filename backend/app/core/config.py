from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    acp_start_command: str = "opencode acp"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
