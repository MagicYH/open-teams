import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse
from app.utils import get_log_id
import yaml
from pathlib import Path
from app.models.team import Team, TeamMember
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_default_team(db: Session, project_id: int):
    config_path = Path("config/default_team.yaml")
    if not config_path.exists():
        return
    with open(config_path) as f:
        config = yaml.safe_load(f)
    team = Team(project_id=project_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    for member in config.get("members", []):
        db_member = TeamMember(
            team_id=team.id,
            name=member["name"],
            display_name=member.get("display_name"),
            color=member.get("color"),
            role=member["role"],
            prompt=member["prompt"],
            acp_start_command=member.get("acp_start_command", settings.acp_start_command)
        )
        db.add(db_member)
    db.commit()

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    logger.info(
        "创建项目",
        extra={
            "log_id": log_id,
            "project_id": None,
            "project_name": project.name,
            "directory": project.directory,
        }
    )
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    create_default_team(db, db_project.id)
    
    logger.info(
        "项目创建成功",
        extra={
            "log_id": log_id,
            "project_id": db_project.id,
            "project_name": db_project.name,
        }
    )
    
    ret = db_project.__dict__.copy()
    ret["log_id"] = log_id
    return ret

@router.get("/", response_model=list[ProjectResponse])
def list_projects(request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    projects = db.query(Project).all()
    logger.debug("获取项目列表", extra={"log_id": log_id, "count": len(projects)})
    
    res = []
    for p in projects:
        d = p.__dict__.copy()
        d["log_id"] = log_id
        res.append(d)
    return res

@router.delete("/{project_id}")
def delete_project(project_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        logger.warning("删除项目，项目不存在", extra={"log_id": log_id, "project_id": project_id})
        raise HTTPException(status_code=404, detail="Project not found")
    logger.info("删除项目", extra={"log_id": log_id, "project_id": project_id})
    db.delete(project)
    db.commit()
    return {"status": "deleted", "log_id": log_id}
