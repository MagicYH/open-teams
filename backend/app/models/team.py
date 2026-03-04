from sqlalchemy import Column, Integer, String, ForeignKey
from .database import Base
from app.core.config import settings

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

class TeamMember(Base):
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    name = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    color = Column(String, nullable=True)
    role = Column(String, nullable=False)
    prompt = Column(String, nullable=False)
    acp_start_command = Column(String, default=lambda: settings.acp_start_command)
    acp_process_id = Column(Integer, nullable=True)
