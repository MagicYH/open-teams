from pydantic import BaseModel, Field
from app.core.config import settings

class TeamMemberCreate(BaseModel):
    name: str
    display_name: str | None = None
    color: str | None = None
    role: str
    prompt: str
    acp_start_command: str = Field(default_factory=lambda: settings.acp_start_command)

class TeamMemberUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    color: str | None = None
    role: str | None = None
    prompt: str | None = None
    acp_start_command: str | None = None

class TeamMemberResponse(BaseModel):
    id: int
    team_id: int
    name: str
    display_name: str | None = None
    color: str | None = None
    role: str
    prompt: str
    acp_start_command: str
    
    class Config:
        from_attributes = True

class TeamResponse(BaseModel):
    id: int
    project_id: int
    members: list[TeamMemberResponse] = []
    
    class Config:
        from_attributes = True
