from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    feature_id: int
    sender: str
    content: str
    mentions: list[str] = []

class MessageResponse(BaseModel):
    id: int
    feature_id: int
    sender: str
    content: str
    mentions: list[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class WorkLogResponse(BaseModel):
    id: int
    feature_id: int
    member_id: int
    log_type: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True
