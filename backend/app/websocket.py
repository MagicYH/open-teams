import uuid
import logging
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}
    
    async def connect(self, feature_id: int, websocket: WebSocket):
        await websocket.accept()
        ws_id = f"ws_{uuid.uuid4().hex[:8]}"
        websocket.scope["ws_id"] = ws_id
        if feature_id not in self.active_connections:
            self.active_connections[feature_id] = []
        self.active_connections[feature_id].append(websocket)
        logger.info(
            "WebSocket 连接",
            extra={
                "feature_id": feature_id,
                "ws_id": ws_id,
            }
        )
    
    def disconnect(self, feature_id: int, websocket: WebSocket):
        ws_id = websocket.scope.get("ws_id", "unknown")
        if feature_id in self.active_connections and websocket in self.active_connections[feature_id]:
            self.active_connections[feature_id].remove(websocket)
            if not self.active_connections[feature_id]:
                del self.active_connections[feature_id]
        logger.info(
            "WebSocket 断开",
            extra={
                "feature_id": feature_id,
                "ws_id": ws_id,
            }
        )
    
    async def broadcast(self, feature_id: int, message: dict):
        if feature_id in self.active_connections:
            for connection in self.active_connections[feature_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass
            logger.debug(
                "WebSocket 广播消息",
                extra={
                    "feature_id": feature_id,
                    "message_id": message.get("id"),
                    "recipients": len(self.active_connections[feature_id]),
                }
            )

manager = ConnectionManager()
