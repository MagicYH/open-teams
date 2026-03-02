import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.feature import Feature
from app.models.project import Project
from app.models.message import Message
from app.models.work_log import WorkLog
from app.models.acp_session import ACPSession
from app.schemas.feature import FeatureCreate, FeatureResponse
from app.utils import get_log_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/features", tags=["features"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=FeatureResponse)
def create_feature(project_id: int, feature: FeatureCreate, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_feature = Feature(project_id=project_id, **feature.model_dump())
    db.add(db_feature)
    db.commit()
    db.refresh(db_feature)
    
    logger.info("创建 Feature 成功", extra={
        "log_id": log_id,
        "project_id": project_id,
        "feature_id": db_feature.id,
        "feature_name": db_feature.name
    })
    return db_feature

@router.get("/", response_model=list[FeatureResponse])
def list_features(project_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    features = db.query(Feature).filter(Feature.project_id == project_id).all()
    logger.debug("获取 Feature 列表", extra={"log_id": log_id, "project_id": project_id, "count": len(features)})
    return features

@router.delete("/{feature_id}")
def delete_feature(project_id: int, feature_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    feature = db.query(Feature).filter(
        Feature.id == feature_id, 
        Feature.project_id == project_id
    ).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
        
    db.query(Message).filter(Message.feature_id == feature_id).delete()
    db.query(WorkLog).filter(WorkLog.feature_id == feature_id).delete()
    db.query(ACPSession).filter(ACPSession.feature_id == feature_id).delete()
    
    db.delete(feature)
    db.commit()
    logger.info("删除 Feature", extra={
        "log_id": log_id,
        "project_id": project_id,
        "feature_id": feature_id
    })
    return {"status": "deleted"}
