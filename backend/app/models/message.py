from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime
from .database import Base

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("features.id"), nullable=False)
    sender = Column(String, nullable=False)
    content = Column(String, nullable=False)
    mentions = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
