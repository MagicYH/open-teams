from pydantic import BaseModel
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    directory: str

class ProjectResponse(BaseModel):
    id: int
    name: str
    directory: str
    created_at: datetime
    updated_at: datetime
    log_id: str | None = None
    
    class Config:
        from_attributes = True
