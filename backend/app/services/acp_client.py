import asyncio
import logging
from typing import Optional, Dict, Any
import re
import uuid
import subprocess
import acp
from acp.core import Client, ClientSideConnection
from acp.helpers import text_block

from app.models.database import SessionLocal
from app.models.message import Message
from app.models.work_log import WorkLog
from app.models.acp_session import ACPSession
from app.models.team import TeamMember
from app.websocket import manager as ws_manager
from app.schemas.message import MessageResponse
from app.models.feature import Feature
from app.models.project import Project
from app.core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def parse_mentions(content: str) -> list[str]:
    return re.findall(r'@\w+', content)

class TeamMemberClient(Client):
    def __init__(self, manager: 'ACPClientManager', member_id: int):
        self.manager = manager
        self.member_id = member_id
        self.connection: Optional[ClientSideConnection] = None
        self.reply_buffer = ""
        self.thought_buffer = ""
        self.current_streaming_id: Optional[str] = None

    def on_connect(self, connection: ClientSideConnection):
        self.connection = connection
        # Add a raw observer to debug
        async def observer(event):
            logger.debug(f"ACP Raw {event.direction}: {event.message}")
        self.connection._conn.add_observer(observer)

    async def session_update(self, session_id: str, update: Any, **kwargs):
        logger.info(f"Received session update: {update.session_update}")
        # Note: in a real implementation we would broadcast this via websocket
        # For now, let's just log it and potentially extract content
        if hasattr(update, "content") and hasattr(update.content, "text"):
            text = update.content.text
        
        # Find feature_id from session_id
        db = SessionLocal()
        session = db.query(ACPSession).filter(ACPSession.session_id == session_id).first()
        if not session:
            db.close()
            return
        feature_id = session.feature_id
        db.close()

        if update.session_update == "agent_thought_chunk":
            content = update.content.text
            self.thought_buffer += content
            if self.current_streaming_id:
                asyncio.create_task(ws_manager.broadcast(feature_id, {
                    "type": "stream_chunk",
                    "member_id": self.member_id,
                    "streaming_id": self.current_streaming_id,
                    "chunk_type": "thought",
                    "content": content
                }))
        elif update.session_update == "agent_message_chunk":
            content = update.content.text
            self.reply_buffer += content
            if self.current_streaming_id:
                asyncio.create_task(ws_manager.broadcast(feature_id, {
                    "type": "stream_chunk",
                    "member_id": self.member_id,
                    "streaming_id": self.current_streaming_id,
                    "chunk_type": "message",
                    "content": content
                }))
        elif update.session_update == "tool_call":
            title = getattr(update, 'title', 'Tool')
            tool_call_id = getattr(update, 'tool_call_id', '')
            raw_input = getattr(update, 'raw_input', None)

            content = f"Tool Call: {title} ({tool_call_id})"
            
            if not hasattr(self, '_tool_args_buffer'):
                self._tool_args_buffer = {}
            if not hasattr(self, '_tool_name_buffer'):
                self._tool_name_buffer = {}
                
            self._tool_args_buffer[tool_call_id] = raw_input
            self._tool_name_buffer[tool_call_id] = title
            
            if raw_input:
                import json
                try:
                    args_str = json.dumps(raw_input, ensure_ascii=False, indent=2)
                    content += f"\nArguments:\n{args_str}"
                except:
                    content += f"\nArguments: {raw_input}"

            if self.current_streaming_id:
                asyncio.create_task(ws_manager.broadcast(feature_id, {
                    "type": "stream_chunk",
                    "member_id": self.member_id,
                    "streaming_id": self.current_streaming_id,
                    "chunk_type": "tool_call",
                    "title": title,
                    "tool_call_id": tool_call_id,
                    "content": f"\n\n{content}"
                }))
        elif update.session_update == "tool_call_update":
            tool_call_id = getattr(update, 'tool_call_id', '')
            raw_output = getattr(update, 'raw_output', None)
            
            if raw_output:
                content = f"Tool Call Result ({tool_call_id}):\n"
                import json
                try:
                    res_str = json.dumps(raw_output, ensure_ascii=False, indent=2)
                    content += res_str
                except:
                    res_str = str(raw_output)
                    content += res_str
                    
                # Recover original input arguments from the buffer to save them persistently
                args_data = getattr(self, '_tool_args_buffer', {}).pop(tool_call_id, None)
                db_payload = {
                    "tool_name": getattr(self, '_tool_name_buffer', {}).pop(tool_call_id, 'Tool'),
                    "arguments": args_data,
                    "result": raw_output
                }
                
                try:
                    db_content = json.dumps(db_payload, ensure_ascii=False)
                except:
                    db_content = content # Fallback to plain text if not serializable
                
                # Save structured JSON to DB so the UI can reconstruct both arguments & result
                await self.manager.save_work_log(feature_id, self.member_id, "tool_call", db_content)

                if self.current_streaming_id:
                    asyncio.create_task(ws_manager.broadcast(feature_id, {
                        "type": "stream_chunk",
                        "member_id": self.member_id,
                        "streaming_id": self.current_streaming_id,
                        "chunk_type": "tool_call",
                        "title": "Tool Result", # not used by UI frontend for updates
                        "tool_call_id": tool_call_id,
                        "content": f"\n\n{content}"
                    }))

class ACPClientManager:
    def __init__(self):
        self.clients: Dict[int, TeamMemberClient] = {}
        self.queues: Dict[int, asyncio.Queue] = {}
        self.tasks: Dict[int, asyncio.Task] = {}
        self.working_members: Dict[int, bool] = {}

    def get_member_status(self, member_id: int) -> str:
        if member_id in self.working_members and self.working_members[member_id]:
            return "working"
        return "idle"

    def get_member_name(self, member_id: int) -> str:
        db = SessionLocal()
        member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
        db.close()
        return member.name if member else f"User_{member_id}"

    def get_member_id_by_name(self, name: str, feature_id: int) -> Optional[int]:
        db = SessionLocal()
        from app.models.feature import Feature
        from app.models.team import Team
        feature = db.query(Feature).filter(Feature.id == feature_id).first()
        if not feature:
            db.close()
            return None
        team = db.query(Team).filter(Team.project_id == feature.project_id).first()
        if not team:
            db.close()
            return None
        member = db.query(TeamMember).filter(
            TeamMember.team_id == team.id,
            TeamMember.name == name.strip('@')
        ).first()
        db.close()
        return member.id if member else None

    async def start_client(self, member_id: int, member_name: str, command: str | list[str], **kwargs):
        if member_id in self.clients:
            return

        # Clear stale sessions for this member as the new agent process won't recognize them.
        db = SessionLocal()
        db.query(ACPSession).filter(ACPSession.member_id == member_id).delete()
        db.commit()
        db.close()

        logger.info(f"Starting real ACP client for {member_name} with command: {command}")
        client = TeamMemberClient(self, member_id)
        self.clients[member_id] = client
        self.queues[member_id] = asyncio.Queue()
        self.tasks[member_id] = asyncio.create_task(self._manage_agent_lifecycle(member_id, member_name, command, client, **kwargs))

    async def _manage_agent_lifecycle(self, member_id: int, member_name: str, command: str | list[str], client: TeamMemberClient, **kwargs):
        if isinstance(command, str):
            cmd_parts = command.split()
        else:
            cmd_parts = command
            
        try:
            async with acp.spawn_agent_process(
                client,
                cmd_parts[0],
                *cmd_parts[1:],
                **kwargs
            ) as (connection, process):
                # Initialize connection
                await connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
                logger.info(f"ACP connection initialized for {member_name}")
                
                # Start processing queue
                asyncio.create_task(self._process_queue(member_id, member_name))
                await process.wait()
        except Exception as e:
            logger.error(f"Agent lifecycle error for {member_name}: {e}")
        finally:
            if member_id in self.clients:
                del self.clients[member_id]
            logger.info(f"Agent {member_name} stopped")

    async def _process_queue(self, member_id: int, member_name: str):
        while member_id in self.queues:
            try:
                message_data = await self.queues[member_id].get()
                feature_id = message_data["feature_id"]
                content = message_data["content"]
                
                client = self.clients.get(member_id)
                if not client or not client.connection:
                    logger.error(f"Client or connection not ready for {member_name}")
                    # Re-queue or wait?
                    await asyncio.sleep(1)
                    await self.queues[member_id].put(message_data)
                    self.queues[member_id].task_done()
                    continue

                db = SessionLocal()
                member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
                prompt_text = member.prompt if member and member.prompt else f"You are {member_name}"
                db.close()

                session_id = await self.get_or_create_session(feature_id, member_id, prompt_text)
                
                logger.info(f"Sending prompt to agent {member_name}: {content[:50]}")
                
                self.working_members[member_id] = True
                client.current_streaming_id = str(uuid.uuid4())
                await ws_manager.broadcast(feature_id, {
                    "type": "agent_status",
                    "member_id": member_id,
                    "status": "working",
                    "streaming_id": client.current_streaming_id
                })
                
                try:
                    # Send prompt to agent
                    await client.connection.prompt(
                        prompt=[text_block(content)],
                        session_id=session_id
                    )
                finally:
                    self.working_members[member_id] = False
                    streaming_id_for_end = client.current_streaming_id
                    client.current_streaming_id = None
                    await ws_manager.broadcast(feature_id, {
                        "type": "agent_status",
                        "member_id": member_id,
                        "status": "idle",
                        "streaming_id": streaming_id_for_end
                    })
                
                logger.info(f"Prompt sent to agent {member_name}")
                
                if client.thought_buffer:
                    await self.save_work_log(feature_id, member_id, "thought", client.thought_buffer)
                    client.thought_buffer = ""
                    
                if client.reply_buffer:
                    await self.save_work_log(feature_id, member_id, "output", client.reply_buffer)
                    await self.handle_member_message(feature_id, member_id, client.reply_buffer)
                    client.reply_buffer = ""
                
                self.queues[member_id].task_done()
            except Exception as e:
                logger.error(f"Processing queue error for {member_name}: {e}")
                await asyncio.sleep(1)

    async def save_work_log(self, feature_id: int, member_id: int, log_type: str, content: str):
        db = SessionLocal()
        log = WorkLog(feature_id=feature_id, member_id=member_id, log_type=log_type, content=content)
        db.add(log)
        db.commit()
        db.close()

    async def handle_member_message(self, feature_id: int, sender_member_id: int, content: str):
        sender = "@" + self.get_member_name(sender_member_id)
        mentions = parse_mentions(content)
        db = SessionLocal()
        message = Message(feature_id=feature_id, sender=sender, content=content, mentions=mentions)
        db.add(message)
        db.commit()
        db.refresh(message)
        
        msg_dump = MessageResponse.model_validate(message).model_dump()
        msg_dump["created_at"] = msg_dump["created_at"].isoformat()
        await ws_manager.broadcast(feature_id, msg_dump)
        
        for mention in mentions:
            if mention != sender:
                member_id = self.get_member_id_by_name(mention, feature_id)
                if member_id:
                    await self.send_to_member(feature_id, member_id, content)
        db.close()

    async def get_or_create_session(self, feature_id: int, member_id: int, prompt: str) -> str:
        db = SessionLocal()
        session = db.query(ACPSession).filter(
            ACPSession.feature_id == feature_id, 
            ACPSession.member_id == member_id).first()
        if session:
            db.close()
            return session.session_id
        
        client = self.clients.get(member_id)
        if not client or not client.connection:
            db.close()
            raise Exception("Agent not connected")

        feature = db.query(Feature).filter(Feature.id == feature_id).first()
        project = db.query(Project).filter(Project.id == feature.project_id).first() if feature else None
        cwd = project.directory if project else "/tmp"
        
        resp = await client.connection.new_session(cwd=cwd)
        session_id = resp.session_id
        
        # Utilize prompt as initial instructions if provided
        if prompt:
            logger.info(f"Initializing session {session_id} for {self.get_member_name(member_id)} with prompt")
            await client.connection.prompt(
                prompt=[text_block(prompt)],
                session_id=session_id
            )
            # Clear buffers to avoid initialization acknowledgment leaking into chat
            client.thought_buffer = ""
            client.reply_buffer = ""
        
        new_session = ACPSession(feature_id=feature_id, member_id=member_id, session_id=session_id)
        db.add(new_session)
        db.commit()
        db.close()
        return session_id

    async def send_to_member(self, feature_id: int, member_id: int, message: str):
        if member_id not in self.clients:
            member_name = self.get_member_name(member_id)
            
            db = SessionLocal()
            member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
            command = member.acp_start_command if member and member.acp_start_command else settings.acp_start_command
            db.close()
            
            await self.start_client(member_id, member_name, command)
            
        await self.queues[member_id].put({"feature_id": feature_id, "content": message})

acp_manager = ACPClientManager()
