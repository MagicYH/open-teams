from pydantic import BaseModel
from datetime import datetime

class FeatureCreate(BaseModel):
    name: str

class FeatureResponse(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: datetime
    
    class Config:
        from_attributes = True
