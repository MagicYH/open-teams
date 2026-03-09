import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.message import Message
from app.models.work_log import WorkLog
from app.schemas.message import MessageCreate, MessageResponse, WorkLogResponse
from app.utils import get_log_id
from app.services.acp_client import acp_manager
from app.websocket import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/features/{feature_id}", tags=["messages", "logs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/messages", response_model=list[MessageResponse])
def get_messages(feature_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    messages = db.query(Message).filter(Message.feature_id == feature_id).all()
    logger.debug("获取群聊消息", extra={"log_id": log_id, "feature_id": feature_id, "count": len(messages)})
    return messages

@router.post("/messages", response_model=MessageResponse)
async def create_message(feature_id: int, message: MessageCreate, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    # Enforce feature_id from URL path
    message_data = message.model_dump()
    message_data["feature_id"] = feature_id
    db_message = Message(**message_data)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    logger.info("发送消息", extra={
        "log_id": log_id,
        "feature_id": feature_id,
        "sender": db_message.sender,
        "message_id": db_message.id
    })
    
    msg_dump = MessageResponse.model_validate(db_message).model_dump()
    msg_dump["created_at"] = msg_dump["created_at"].isoformat()
    await ws_manager.broadcast(feature_id, msg_dump)
    
    for mention in message.mentions:
        member_id = acp_manager.get_member_id_by_name(mention, feature_id)
        logger.info(f"Resolved mention '{mention}' to member_id: {member_id} for feature_id: {feature_id}")
        if member_id:
            logger.info(f"Triggering start for member_id: {member_id}")
            await acp_manager.send_to_member(feature_id, member_id, message.content)
            
    return db_message

@router.get("/members/{member_id}/logs", response_model=list[WorkLogResponse])
def get_work_logs(feature_id: int, member_id: int, request: Request, db: Session = Depends(get_db)):
    log_id = get_log_id(request)
    logs = db.query(WorkLog).filter(
        WorkLog.feature_id == feature_id,
        WorkLog.member_id == member_id
    ).order_by(WorkLog.created_at.asc()).all()
    logger.debug("获取工作日志", extra={"log_id": log_id, "feature_id": feature_id, "member_id": member_id, "count": len(logs)})
    return logs
