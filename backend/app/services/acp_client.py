import asyncio
import logging
from typing import Optional, Dict, Any
import re
import uuid
import subprocess
import acp
import json
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
    # Match standard @word, @word-word, and specific spaced roles like @Test Engineer
    return re.findall(r'@(?:[\w\-]+|Test Engineer|Product Manager|User)', content, re.IGNORECASE)

class TeamMemberClient(Client):
    def __init__(self, manager: 'ACPClientManager', member_id: int):
        self.manager = manager
        self.member_id = member_id
        self.connection: Optional[ClientSideConnection] = None
        self.reply_buffer = ""
        self.thought_buffer = ""
        self.current_streaming_id: str = str(uuid.uuid4())
        self._tool_args_buffer: dict = {}
        self._tool_name_buffer: dict = {}
        self.agent_capabilities = None
        self.is_replaying: bool = False

    def on_connect(self, connection: ClientSideConnection):
        logger.info(f"[member_id={self.member_id}] on_connect called — ACP connection is ready")
        self.connection = connection
        # Log every raw ACP message for debugging
        def _observer(event):
            logger.debug(f"[member_id={self.member_id}] ACP [{event.direction.value}]: {str(event.message)[:200]}")
        connection._conn.add_observer(_observer)

    async def write_text_file(self, content: str, path: str, session_id: str, **kwargs):
        from acp.schema import WriteTextFileResponse
        logger.info(f"[member_id={self.member_id}] write_text_file: path={path} ({len(content)} chars)")
        try:
            import os
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info(f"[member_id={self.member_id}] write_text_file success: {path}")
        except Exception as e:
            logger.error(f"[member_id={self.member_id}] write_text_file error: {e}")
        return WriteTextFileResponse()

    async def read_text_file(self, path: str, session_id: str, limit=None, line=None, **kwargs):
        from acp.schema import ReadTextFileResponse
        logger.info(f"[member_id={self.member_id}] read_text_file: path={path}")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                text = f.read()
            return ReadTextFileResponse(content=text)
        except Exception as e:
            logger.error(f"[member_id={self.member_id}] read_text_file error: {e}")
            return ReadTextFileResponse(content="")

    async def request_permission(self, options, session_id: str, tool_call=None, **kwargs):
        from acp.schema import RequestPermissionResponse, AllowedOutcome
        logger.info(f"[member_id={self.member_id}] request_permission called — auto-approving")
        # Auto-approve all permissions so the agent doesn't block
        return RequestPermissionResponse(outcome=AllowedOutcome())

    async def session_update(self, session_id: str, update: Any, **kwargs):
        update_type = getattr(update, 'session_update', 'UNKNOWN')
        if self.is_replaying:
            logger.debug(f"[member_id={self.member_id}] [replaying] skipping broadcast for {update_type}")
            return
        logger.debug(f"[member_id={self.member_id}] session_update received: {update_type}")

        # Find feature_id from session_id
        db = SessionLocal()
        session = db.query(ACPSession).filter(ACPSession.session_id == session_id).first()
        if not session:
            db.close()
            logger.warning(f"[member_id={self.member_id}] session_update: no ACPSession found for session_id={session_id}")
            return
        feature_id = session.feature_id
        db.close()

        if update_type == "agent_thought_chunk":
            content = update.content.text
            self.thought_buffer += content
            logger.debug(f"[member_id={self.member_id}] thought_chunk ({len(content)} chars), streaming_id={self.current_streaming_id}")
            asyncio.create_task(ws_manager.broadcast(feature_id, {
                "type": "stream_chunk",
                "member_id": self.member_id,
                "streaming_id": self.current_streaming_id,
                "chunk_type": "thought",
                "content": content
            }))

        elif update_type == "agent_message_chunk":
            content = update.content.text
            self.reply_buffer += content
            logger.debug(f"[member_id={self.member_id}] message_chunk ({len(content)} chars), streaming_id={self.current_streaming_id}")
            asyncio.create_task(ws_manager.broadcast(feature_id, {
                "type": "stream_chunk",
                "member_id": self.member_id,
                "streaming_id": self.current_streaming_id,
                "chunk_type": "message",
                "content": content
            }))

        elif update_type == "tool_call":
            title = getattr(update, 'title', 'Tool')
            tool_call_id = getattr(update, 'tool_call_id', '')
            raw_input = getattr(update, 'raw_input', None)

            logger.info(f"[member_id={self.member_id}] tool_call start: title={title}, id={tool_call_id}")
            logger.debug(f"[member_id={self.member_id}] tool_call raw_input: {raw_input}")

            self._tool_args_buffer[tool_call_id] = raw_input
            self._tool_name_buffer[tool_call_id] = title

            if raw_input:
                try:
                    args_str = json.dumps(raw_input, ensure_ascii=False, indent=2)
                except Exception:
                    args_str = str(raw_input)
            else:
                args_str = "(no args)"

            content = f"Tool Call: {title}\n\nArguments:\n{args_str}"
            await self.manager.save_work_log(feature_id, self.member_id, "tool_call", content)

            if self.current_streaming_id:
                asyncio.create_task(ws_manager.broadcast(feature_id, {
                    "type": "stream_chunk",
                    "member_id": self.member_id,
                    "streaming_id": self.current_streaming_id,
                    "chunk_type": "tool_call",
                    "title": title,
                    "tool_call_id": tool_call_id,
                    "content": content
                }))

        elif update_type == "tool_call_update":
            tool_call_id = getattr(update, 'tool_call_id', '')
            raw_output = getattr(update, 'raw_output', None)
            logger.info(f"[member_id={self.member_id}] tool_call_update: id={tool_call_id}")
            logger.debug(f"[member_id={self.member_id}] tool_call_update raw_output: {raw_output}")

            if raw_output:
                import json
                try:
                    res_str = json.dumps(raw_output, ensure_ascii=False, indent=2)
                except Exception:
                    res_str = str(raw_output)

                raw_input_data = getattr(update, 'raw_input', {})
                tool_title = getattr(update, 'title', None) or self._tool_name_buffer.pop(tool_call_id, 'Tool')

                db_payload = {
                    "tool_name": tool_title,
                    "arguments": raw_input_data,
                    "result": raw_output
                }
                import json as _json
                db_content = _json.dumps(db_payload, ensure_ascii=False)

                await self.manager.save_work_log(feature_id, self.member_id, "tool_call", db_content)

                if self.current_streaming_id:
                    asyncio.create_task(ws_manager.broadcast(feature_id, {
                        "type": "stream_chunk",
                        "member_id": self.member_id,
                        "streaming_id": self.current_streaming_id,
                        "chunk_type": "tool_call",
                        "title": "Tool Result",
                        "tool_call_id": tool_call_id,
                        "content": f"\n\n{res_str}"
                    }))

        else:
            logger.debug(f"[member_id={self.member_id}] unhandled session_update type: {update_type}")


class ACPClientManager:
    def __init__(self):
        self.clients: Dict[int, TeamMemberClient] = {}
        self.queues: Dict[int, asyncio.Queue] = {}
        self.tasks: Dict[int, asyncio.Task] = {}
        self.working_members: Dict[int, bool] = {}
        # Event to signal when a client's connection is ready
        self._connection_ready: Dict[int, asyncio.Event] = {}
        self._established_sessions: set[tuple[int, int]] = set()  # (member_id, feature_id)

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
            logger.warning(f"get_member_id_by_name: feature_id={feature_id} not found")
            return None
        team = db.query(Team).filter(Team.project_id == feature.project_id).first()
        if not team:
            db.close()
            logger.warning(f"get_member_id_by_name: no team for project_id={feature.project_id}")
            return None

        from sqlalchemy import func
        name_clean = name.strip('@').lower()

        # Map YAML configurations (agents might output hyphens or spaces) to DB names
        aliases = {
            "product-manager": "pm",
            "product manager": "pm",
            "test-engineer": "qa",
            "test engineer": "qa",
            "architect": "architect",
            "developer": "developer"
        }
        target_name = aliases.get(name_clean, name_clean)

        logger.debug(f"get_member_id_by_name: name='{name}' -> clean='{name_clean}' -> target='{target_name}' in team_id={team.id}")

        member = db.query(TeamMember).filter(
            TeamMember.team_id == team.id,
            func.lower(TeamMember.name) == target_name
        ).first()
        db.close()
        result = member.id if member else None
        logger.debug(f"get_member_id_by_name: resolved member_id={result}")
        return result

    async def start_client(self, member_id: int, member_name: str, command: str | list[str], **kwargs):
        if member_id in self.clients:
            logger.info(f"start_client: member_id={member_id} already has a client, skipping")
            return

        logger.info(f"Starting real ACP client for {member_name} with command: {command}")
        client = TeamMemberClient(self, member_id)
        self.clients[member_id] = client
        self.queues[member_id] = asyncio.Queue()
        self._connection_ready[member_id] = asyncio.Event()
        self.tasks[member_id] = asyncio.create_task(
            self._manage_agent_lifecycle(member_id, member_name, command, client, **kwargs)
        )

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
                init_resp = await connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
                client.agent_capabilities = init_resp.agent_capabilities
                logger.info(f"ACP connection initialized for {member_name}, loadSession={getattr(client.agent_capabilities, 'load_session', False)}")

                # Signal to waiting queue processor that connection is ready
                if member_id in self._connection_ready:
                    self._connection_ready[member_id].set()
                    logger.info(f"[member_id={member_id}] connection_ready event set")

                # Start processing queue after connection is ready
                queue_task = asyncio.create_task(self._process_queue(member_id, member_name))
                await process.wait()
                queue_task.cancel()
        except Exception as e:
            logger.error(f"Agent lifecycle error for {member_name}: {e}", exc_info=True)
        finally:
            if member_id in self.clients:
                del self.clients[member_id]
            if member_id in self._connection_ready:
                del self._connection_ready[member_id]
            logger.info(f"Agent {member_name} stopped")

    async def _process_queue(self, member_id: int, member_name: str):
        logger.info(f"[member_id={member_id}] _process_queue started for {member_name}")
        while member_id in self.queues:
            try:
                message_data = await self.queues[member_id].get()
                feature_id = message_data["feature_id"]
                content = message_data["content"]
                logger.info(f"[member_id={member_id}] Dequeued message for feature_id={feature_id}: {content[:80]!r}")

                client = self.clients.get(member_id)
                if not client or not client.connection:
                    logger.warning(f"[member_id={member_id}] Client or connection not ready — re-queuing after 1s")
                    await asyncio.sleep(1)
                    await self.queues[member_id].put(message_data)
                    self.queues[member_id].task_done()
                    continue

                db = SessionLocal()
                member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
                prompt_text = member.prompt if member and member.prompt else f"You are {member_name}"
                db.close()

                session_id, is_new = await self.get_or_create_session(feature_id, member_id)
                logger.info(f"[member_id={member_id}] session_id={session_id}, is_new={is_new}")

                if is_new and prompt_text:
                    content = f"{prompt_text}\n\nUser Message:\n{content}"
                    logger.info(f"[member_id={member_id}] New session — prepended system prompt ({len(prompt_text)} chars)")

                logger.info(f"[member_id={member_id}] Sending prompt to ACP agent: {content[:80]!r}")

                self.working_members[member_id] = True
                client.current_streaming_id = str(uuid.uuid4())
                logger.info(f"[member_id={member_id}] Set working=True, streaming_id={client.current_streaming_id}")

                await ws_manager.broadcast(feature_id, {
                    "type": "agent_status",
                    "member_id": member_id,
                    "status": "working",
                    "streaming_id": client.current_streaming_id
                })

                try:
                    await client.connection.prompt(
                        prompt=[text_block(content)],
                        session_id=session_id
                    )
                    logger.info(f"[member_id={member_id}] client.connection.prompt() returned — agent finished responding")
                except Exception as prompt_err:
                    logger.error(f"[member_id={member_id}] Error during prompt(): {prompt_err}", exc_info=True)
                    # Discard established session on error so we try to load/recreate it next time
                    self._established_sessions.discard((member_id, feature_id))
                finally:
                    self.working_members[member_id] = False
                    streaming_id_for_end = client.current_streaming_id
                    # Rotate to a fresh ID immediately so any late-arriving chunks
                    # from the agent are associated with the new cycle, not None.
                    client.current_streaming_id = str(uuid.uuid4())
                    logger.info(f"[member_id={member_id}] Set working=False, broadcasting idle status, next streaming_id={client.current_streaming_id}")
                    await ws_manager.broadcast(feature_id, {
                        "type": "agent_status",
                        "member_id": member_id,
                        "status": "idle",
                        "streaming_id": streaming_id_for_end
                    })

                logger.info(f"[member_id={member_id}] thought_buffer length={len(client.thought_buffer)}, reply_buffer length={len(client.reply_buffer)}")

                if client.thought_buffer:
                    await self.save_work_log(feature_id, member_id, "thought", client.thought_buffer)
                    client.thought_buffer = ""

                if client.reply_buffer:
                    await self.save_work_log(feature_id, member_id, "output", client.reply_buffer)
                    await self.handle_member_message(feature_id, member_id, client.reply_buffer)
                    client.reply_buffer = ""

                self.queues[member_id].task_done()
                logger.info(f"[member_id={member_id}] Message processing done")
            except asyncio.CancelledError:
                logger.info(f"[member_id={member_id}] _process_queue cancelled")
                break
            except Exception as e:
                logger.error(f"[member_id={member_id}] Processing queue error: {e}", exc_info=True)
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
        logger.info(f"handle_member_message: sender={sender}, mentions={mentions}, content={content[:80]!r}")
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
                logger.info(f"handle_member_message: mention={mention} -> member_id={member_id}")
                if member_id:
                    await self.send_to_member(feature_id, member_id, content)
        db.close()

    async def get_or_create_session(self, feature_id: int, member_id: int) -> tuple[str, bool]:
        key = (member_id, feature_id)
        db = SessionLocal()
        session = db.query(ACPSession).filter(
            ACPSession.feature_id == feature_id,
            ACPSession.member_id == member_id).first()

        client = self.clients.get(member_id)
        if not client or not client.connection:
            db.close()
            raise Exception(f"Agent not connected for member_id={member_id}")

        # Case 1: Session established in this process lifetime
        if session and key in self._established_sessions:
            db.close()
            logger.debug(f"get_or_create_session: reusing established session {session.session_id}")
            return session.session_id, False

        # Case 2: Session exists in DB but not established in this process (e.g. after restart)
        if session:
            feature = db.query(Feature).filter(Feature.id == feature_id).first()
            project = db.query(Project).filter(Project.id == feature.project_id).first() if feature else None
            cwd = project.directory if project else "/tmp"

            supports_load = (
                client.agent_capabilities is not None and
                getattr(client.agent_capabilities, 'load_session', False)
            )

            if supports_load:
                try:
                    client.is_replaying = True
                    logger.info(f"[member_id={member_id}] Attempting to load session {session.session_id}")
                    await client.connection.load_session(cwd=cwd, session_id=session.session_id)
                    client.is_replaying = False
                    self._established_sessions.add(key)
                    db.close()
                    logger.info(f"Session {session.session_id} loaded successfully for member_id={member_id}")
                    return session.session_id, False
                except Exception as e:
                    client.is_replaying = False
                    logger.warning(f"load_session failed for {session.session_id}: {e} — falling back to new session")
                    db.query(ACPSession).filter(
                        ACPSession.feature_id == feature_id,
                        ACPSession.member_id == member_id
                    ).delete()
                    db.commit()
            else:
                logger.info(f"Agent (member_id={member_id}) does not support loadSession — creating new session")
                db.query(ACPSession).filter(
                    ACPSession.feature_id == feature_id,
                    ACPSession.member_id == member_id
                ).delete()
                db.commit()

        # Case 3: No session exists or load failed
        feature = db.query(Feature).filter(Feature.id == feature_id).first()
        project = db.query(Project).filter(Project.id == feature.project_id).first() if feature else None
        cwd = project.directory if project else "/tmp"

        logger.info(f"get_or_create_session: creating new session for member_id={member_id}, cwd={cwd}")
        resp = await client.connection.new_session(cwd=cwd)
        session_id = resp.session_id
        logger.info(f"get_or_create_session: new session_id={session_id}")

        new_session = ACPSession(feature_id=feature_id, member_id=member_id, session_id=session_id)
        db.add(new_session)
        db.commit()
        db.close()
        self._established_sessions.add(key)
        return session_id, True

    async def send_to_member(self, feature_id: int, member_id: int, message: str):
        logger.info(f"send_to_member: feature_id={feature_id}, member_id={member_id}, msg={message[:60]!r}")
        if member_id not in self.clients:
            member_name = self.get_member_name(member_id)

            db = SessionLocal()
            member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
            command = member.acp_start_command if member and member.acp_start_command else settings.acp_start_command
            db.close()

            logger.info(f"send_to_member: starting new client for {member_name} with command={command}")
            await self.start_client(member_id, member_name, command)

            # Wait until the ACP connection is ready before queuing the message
            if member_id in self._connection_ready:
                logger.info(f"send_to_member: waiting for connection_ready event for member_id={member_id}")
                try:
                    await asyncio.wait_for(self._connection_ready[member_id].wait(), timeout=15.0)
                    logger.info(f"send_to_member: connection_ready event received for member_id={member_id}")
                except asyncio.TimeoutError:
                    logger.error(f"send_to_member: timed out waiting for member_id={member_id} to connect!")

        logger.info(f"send_to_member: queuing message for member_id={member_id}")
        await self.queues[member_id].put({"feature_id": feature_id, "content": message})

acp_manager = ACPClientManager()
