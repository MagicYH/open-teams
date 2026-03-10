import asyncio
import logging
import os
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
from pydantic import BaseModel
from typing import Any, Optional
import acp
from acp.core import Client, ClientSideConnection
from acp.helpers import text_block
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/utils", tags=["utils"])

@router.get("/list-directories")
def list_directories(path: str = Query("/", description="The path to list directories from")):
    try:
        target_path = Path(path).expanduser().resolve()
        if not target_path.exists():
            # If path doesn't exist, try to start from user home or root
            target_path = Path.home()
        
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        items = []
        # Add parent directory if not at root
        if target_path != target_path.parent:
            items.append({
                "name": "..",
                "path": str(target_path.parent),
                "is_dir": True
            })

        try:
            for entry in os.scandir(target_path):
                if entry.is_dir() and not entry.name.startswith('.'):
                    items.append({
                        "name": entry.name,
                        "path": str(Path(entry.path)),
                        "is_dir": True
                    })
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {
            "current_path": str(target_path),
            "items": sorted(items, key=lambda x: x["name"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-directory")
def create_directory(path: str, name: str):
    try:
        base_path = Path(path).expanduser().resolve()
        new_dir = base_path / name
        
        if new_dir.exists():
            raise HTTPException(status_code=400, detail="Directory already exists")
            
        new_dir.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "path": str(new_dir)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Prompt Generation ────────────────────────────────────────────────────────

class TeamMemberInfo(BaseModel):
    name: str
    role: str

class GeneratePromptRequest(BaseModel):
    role: str
    existing_prompt: str = ""
    user_requirement: str = ""
    team_members: list[TeamMemberInfo] = []


class _PromptCollector(Client):
    """Minimal ACP client that just collects the agent's reply."""

    def __init__(self):
        self.connection: Optional[ClientSideConnection] = None
        self._reply_parts: list[str] = []
        self._done = asyncio.Event()

    def on_connect(self, connection: ClientSideConnection):
        self.connection = connection

    async def session_update(self, session_id: str, update: Any, **kwargs):
        update_type = getattr(update, "session_update", "UNKNOWN")
        if update_type == "agent_message_chunk":
            self._reply_parts.append(update.content.text)
        elif update_type in ("agent_end", "session_end"):
            self._done.set()

    @property
    def reply(self) -> str:
        return "".join(self._reply_parts)


@router.post("/generate-prompt")
async def generate_prompt(req: GeneratePromptRequest):
    """
    Spawn a temporary ACP agent, generate an optimised system prompt for the
    given role, then immediately shut down the agent process.
    """
    command = settings.acp_start_command
    cmd_parts = command.split()

    # Build the message sent to the agent
    parts = [f"/gen_react_prompt"]
    parts.append(f"Role: {req.role}")
    if req.existing_prompt.strip():
        parts.append(f"Existing Prompt:\n{req.existing_prompt.strip()}")
    if req.team_members:
        lines = "\n".join(f"- {m.name} ({m.role})" for m in req.team_members)
        parts.append(f"Team Members (for reference when mentioning @name):\n{lines}")
    if req.user_requirement.strip():
        parts.append(f"User Requirement: {req.user_requirement.strip()}")
    content = "\n\n".join(parts)

    collector = _PromptCollector()

    try:
        async with acp.spawn_agent_process(
            collector,
            cmd_parts[0],
            *cmd_parts[1:],
        ) as (connection, process):
            await connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
            collector.connection = connection

            # Create a temporary session (cwd doesn't matter for prompt generation)
            resp = await connection.new_session(cwd="/tmp")
            session_id = resp.session_id

            # Send the request and wait for reply (timeout: 60 s)
            await connection.prompt(
                prompt=[text_block(content)],
                session_id=session_id,
            )

            # Give the agent a moment to flush any remaining chunks
            try:
                await asyncio.wait_for(collector._done.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass  # reply may already be complete

            generated = collector.reply
            logger.info(f"generate_prompt: generated {len(generated)} chars for role={req.role!r}")

    except Exception as e:
        logger.error(f"generate_prompt error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {e}")

    if not generated.strip():
        raise HTTPException(status_code=502, detail="Agent returned an empty response")

    return {"prompt": generated}
