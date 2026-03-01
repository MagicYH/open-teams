from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from .database import Base

class ACPSession(Base):
    __tablename__ = "acp_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("features.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("team_members.id"), nullable=False)
    session_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
