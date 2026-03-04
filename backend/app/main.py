import logging
import sys
from logging.handlers import TimedRotatingFileHandler
from pythonjsonlogger import jsonlogger

# 配置 JSON 日志格式
class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["extra"] = {
            "log_id": getattr(record, "log_id", None),
            "project_id": getattr(record, "project_id", None),
            "feature_id": getattr(record, "feature_id", None),
            "member_id": getattr(record, "member_id", None),
        }

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # 文件输出（JSON 格式，方便解析）
    file_handler = TimedRotatingFileHandler(
        "logs/app.log", when="midnight", interval=1
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = CustomJsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s"
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    return logger

logger = setup_logging()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import uuid

import os

app = FastAPI(title="ACP Teams Backend")

FRONTEND_PORT = os.getenv("FRONTEND_PORT", "5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{FRONTEND_PORT}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LogID 中间件
class LogIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        log_id = request.headers.get("X-LogID") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.log_id = log_id
        
        response = await call_next(request)
        response.headers["X-LogID"] = log_id
        return response

app.add_middleware(LogIDMiddleware)

from app.routers import project, feature, team, message, utils
app.include_router(project.router)
app.include_router(feature.router)
app.include_router(team.router)
app.include_router(message.router)
app.include_router(utils.router)

from fastapi import WebSocket, WebSocketDisconnect
from app.websocket import manager

@app.websocket("/ws/chat/{feature_id}")
async def chat_websocket(websocket: WebSocket, feature_id: int):
    await manager.connect(feature_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # client can send messages via post endpoint, ws mostly for receive
            pass
    except WebSocketDisconnect:
        manager.disconnect(feature_id, websocket)

@app.on_event("startup")
async def startup():
    logger.info("应用启动", extra={})

@app.on_event("shutdown")
async def shutdown():
    logger.info("应用关闭", extra={})

@app.get("/health")
async def health():
    return {"status": "ok"}
