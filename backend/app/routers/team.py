import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.team import Team, TeamMember
from app.schemas.team import TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse, TeamResponse
from app.utils import get_log_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/team", tags=["team"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=TeamResponse)
def get_team(project_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
    
    from app.services.acp_client import acp_manager
    member_responses = []
    for m in members:
        mr = TeamMemberResponse.model_validate(m)
        mr.status = acp_manager.get_member_status(m.id)
        member_responses.append(mr)
        
    return TeamResponse(id=team.id, project_id=team.project_id, members=member_responses)

@router.post("/members", response_model=TeamMemberResponse)
def create_member(project_id: int, member: TeamMemberCreate, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db_member = TeamMember(team_id=team.id, **member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    logger.info("创建成员", extra={
        "log_id": log_id,
        "project_id": project_id,
        "member_id": db_member.id,
        "member_name": db_member.name
    })
    return db_member

@router.put("/members/{member_id}", response_model=TeamMemberResponse)
def update_member(project_id: int, member_id: int, member: TeamMemberUpdate, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db_member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.team_id == team.id
    ).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    for key, value in member.model_dump(exclude_unset=True).items():
        setattr(db_member, key, value)
    db.commit()
    db.refresh(db_member)
    return db_member

@router.delete("/members/{member_id}")
def delete_member(project_id: int, member_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db_member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.team_id == team.id
    ).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(db_member)
    db.commit()
    logger.info("删除成员", extra={
        "log_id": log_id,
        "project_id": project_id,
        "member_id": member_id
    })
    return {"status": "deleted"}
