from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from .database import Base

class Feature(Base):
    __tablename__ = "features"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
