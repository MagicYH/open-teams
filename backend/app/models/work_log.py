from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from .database import Base

class WorkLog(Base):
    __tablename__ = "member_work_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("features.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("team_members.id"), nullable=False)
    log_type = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
