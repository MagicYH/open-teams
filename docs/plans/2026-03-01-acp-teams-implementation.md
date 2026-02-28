# ACP 开发团队系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于 ACP 协议实现开发团队协作系统，包含项目管理、团队管理、群聊、消息队列、角色工作窗口功能

**Architecture:** 前后端分离架构。后端 FastAPI + SQLite，前端 React + TypeScript + Vite。ACP 客户端由后端进程管理，通过 session 隔离不同角色

**Tech Stack:** React, TypeScript, Vite, FastAPI, SQLAlchemy, SQLite, WebSocket, agent-client-protocol

---

## 阶段一：后端基础设施

### Task 1: 项目初始化与依赖

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

**Step 1: 创建 pyproject.toml**

```toml
[project]
name = "acp-teams-backend"
version = "0.1.0"
description = "ACP Teams Backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "sqlalchemy>=2.0.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "python-socketio>=5.0.0",
    "aiohttp>=3.9.0",
    "agent-client-protocol>=0.1.0",
    "pyyaml>=6.0.0",
]

[tool.uv.snake]
true
```

**Step 2: 创建基础 FastAPI 应用**

```python
from fastapi import FastAPI

app = FastAPI(title="ACP Teams Backend")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 3: 验证服务启动**

Run: `cd backend && uv run uvicorn app.main:app --reload`
Expected: 服务启动成功，访问 /health 返回 {"status":"ok"}

**Step 4: Commit**

```bash
git add backend/
git commit -m "feat: 初始化后端项目结构"
```

---

### Task 2: 数据库模型

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/database.py`
- Create: `backend/app/models/project.py`
- Create: `backend/app/models/feature.py`
- Create: `backend/app/models/team.py`
- Create: `backend/app/models/message.py`
- Create: `backend/app/models/acp_session.py`

**Step 1: 创建数据库连接**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

engine = create_engine("sqlite:///./acp_teams.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**Step 2: 创建项目模型**

```python
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    directory = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Step 3: 创建其他模型（Feature, Team, TeamMember, Message, WorkLog, ACPSession）**

参考设计文档创建完整的模型定义。

**Step 4: 创建数据库表**

```python
Base.metadata.create_all(bind=engine)
```

**Step 5: Commit**

```bash
git add backend/app/models/
git commit -m "feat: 添加数据库模型"
```

---

### Task 3: 项目 CRUD API

**Files:**
- Create: `backend/app/schemas/project.py`
- Create: `backend/app/routers/project.py`
- Modify: `backend/app/main.py`

**Step 1: 创建 Pydantic Schema**

```python
from pydantic import BaseModel
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    directory: str

class ProjectResponse(BaseModel):
    id: int
    name: str
    directory: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

**Step 2: 创建 API 路由**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, Project

router = APIRouter(prefix="/api/projects", tags=["projects"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()
```

**Step 3: 注册路由**

```python
from app.routers import project
app.include_router(project.router)
```

**Step 4: 测试 API**

Run: `curl -X POST http://localhost:8000/api/projects -H "Content-Type: application/json" -d '{"name":"test","directory":"/tmp/test"}'`
Expected: 返回创建的 project

**Step 5: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加项目 CRUD API"
```

---

### Task 4: Feature CRUD API

**Files:**
- Create: `backend/app/schemas/feature.py`
- Create: `backend/app/routers/feature.py`

**Step 1: 创建 Feature Schema**

```python
from pydantic import BaseModel
from datetime import datetime

class FeatureCreate(BaseModel):
    name: str

class FeatureResponse(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: datetime
    
    class Config:
        from_attributes = True
```

**Step 2: 创建 Feature API 路由**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.feature import Feature
from app.models.project import Project

router = APIRouter(prefix="/api/projects/{project_id}/features", tags=["features"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=FeatureResponse)
def create_feature(project_id: int, feature: FeatureCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_feature = Feature(project_id=project_id, **feature.model_dump())
    db.add(db_feature)
    db.commit()
    db.refresh(db_feature)
    return db_feature

@router.get("/", response_model=list[FeatureResponse])
def list_features(project_id: int, db: Session = Depends(get_db)):
    return db.query(Feature).filter(Feature.project_id == project_id).all()

@router.delete("/{feature_id}")
def delete_feature(project_id: int, feature_id: int, db: Session = Depends(get_db)):
    feature = db.query(Feature).filter(
        Feature.id == feature_id, 
        Feature.project_id == project_id
    ).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    db.delete(feature)
    db.commit()
    return {"status": "deleted"}
```

**Step 3: 在 main.py 中注册路由**

```python
from app.routers import feature
app.include_router(feature.router)
```

**Step 4: 测试 Feature API**

```bash
# 创建 feature
curl -X POST http://localhost:8000/api/projects/1/features \
  -H "Content-Type: application/json" \
  -d '{"name":"用户登录"}'

# 获取 feature 列表
curl http://localhost:8000/api/projects/1/features

# 删除 feature
curl -X DELETE http://localhost:8000/api/projects/1/features/1
```

**Step 5: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加 Feature CRUD API"
```

---

### Task 5: Team Member CRUD API

**Files:**
- Create: `backend/app/schemas/team.py`
- Create: `backend/app/routers/team.py`

**Step 1: 创建 Team 和 TeamMember Schema**

```python
from pydantic import BaseModel
from datetime import datetime

class TeamMemberCreate(BaseModel):
    name: str
    role: str
    prompt: str

class TeamMemberUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    prompt: str | None = None

class TeamMemberResponse(BaseModel):
    id: int
    team_id: int
    name: str
    role: str
    prompt: str
    
    class Config:
        from_attributes = True

class TeamResponse(BaseModel):
    id: int
    project_id: int
    members: list[TeamMemberResponse] = []
    
    class Config:
        from_attributes = True
```

**Step 2: 创建 Team Member API 路由**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.team import Team, TeamMember

router = APIRouter(prefix="/api/projects/{project_id}/team", tags=["team"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=TeamResponse)
def get_team(project_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

@router.post("/members", response_model=TeamMemberResponse)
def create_member(project_id: int, member: TeamMemberCreate, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.project_id == project_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db_member = TeamMember(team_id=team.id, **member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@router.put("/members/{member_id}", response_model=TeamMemberResponse)
def update_member(project_id: int, member_id: int, member: TeamMemberUpdate, db: Session = Depends(get_db)):
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
def delete_member(project_id: int, member_id: int, db: Session = Depends(get_db)):
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
    return {"status": "deleted"}
```

**Step 3: 项目创建时自动创建默认团队**

在 Task 3 的 project router 中添加：

```python
import yaml

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
            role=member["role"],
            prompt=member["prompt"]
        )
        db.add(db_member)
    db.commit()

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    create_default_team(db, db_project.id)
    return db_project
```

**Step 4: 测试 Team Member API**

```bash
# 获取团队
curl http://localhost:8000/api/projects/1/team

# 添加成员
curl -X POST http://localhost:8000/api/projects/1/team/members \
  -H "Content-Type: application/json" \
  -d '{"name":"Developer2","role":"Developer","prompt":"你是一个开发工程师..."}'

# 更新成员
curl -X PUT http://localhost:8000/api/projects/1/team/members/2 \
  -H "Content-Type: application/json" \
  -d '{"name":"Senior Developer"}'

# 删除成员
curl -X DELETE http://localhost:8000/api/projects/1/team/members/2
```

**Step 5: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加 Team Member CRUD API"
```

---

### Task 6: 消息与工作日志 API

**Files:**
- Create: `backend/app/schemas/message.py`
- Create: `backend/app/routers/message.py`

**Step 1: 创建消息 Schema**

```python
from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    feature_id: int
    sender: str
    content: str
    mentions: list[str] = []

class MessageResponse(BaseModel):
    id: int
    feature_id: int
    sender: str
    content: str
    mentions: list[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
```

**Step 2: 创建消息 API**

- GET /api/features/{feature_id}/messages - 获取群聊消息
- POST /api/features/{feature_id}/messages - 发送消息

**Step 3: 创建工作日志 Schema 和 API**

- GET /api/features/{feature_id}/members/{member_id}/logs - 获取工作日志

**Step 4: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加消息和工作日志 API"
```

---

### Task 7: WebSocket 实时通信

**Files:**
- Create: `backend/app/websocket.py`
- Modify: `backend/app/main.py`

**Step 1: 创建 WebSocket 路由**

```python
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}
    
    async def connect(self, feature_id: int, websocket: WebSocket):
        await websocket.accept()
        if feature_id not in self.active_connections:
            self.active_connections[feature_id] = []
        self.active_connections[feature_id].append(websocket)
    
    def disconnect(self, feature_id: int, websocket: WebSocket):
        if feature_id in self.active_connections:
            self.active_connections[feature_id].remove(websocket)
    
    async def broadcast(self, feature_id: int, message: dict):
        if feature_id in self.active_connections:
            for connection in self.active_connections[feature_id]:
                await connection.send_json(message)
```

**Step 2: 添加 WebSocket 端点**

```python
@app.websocket("/ws/chat/{feature_id}")
async def chat_websocket(websocket: WebSocket, feature_id: int):
    await manager.connect(feature_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # 处理消息并广播
    except WebSocketDisconnect:
        manager.disconnect(feature_id, websocket)
```

**Step 3: 测试 WebSocket 连接**

使用浏览器或 wscat 测试 WebSocket 连接。

**Step 4: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加 WebSocket 实时通信"
```

---

## 阶段二：ACP 客户端集成

### Task 8: ACP 客户端管理

**Files:**
- Create: `backend/app/services/acp_client.py`

**Step 1: 创建 ACP 客户端服务**

```python
import asyncio
from typing import Optional
from agent_client_protocol import AcpClient

class ACPClientManager:
    def __init__(self):
        self.clients: dict[int, AcpClient] = {}
        self.queues: dict[int, asyncio.Queue] = {}
    
    async def start_client(self, member_id: int):
        client = AcpClient()
        await client.initialize()
        self.clients[member_id] = client
        self.queues[member_id] = asyncio.Queue()
        asyncio.create_task(self._process_queue(member_id))
    
    async def _process_queue(self, member_id: int):
        while True:
            message = await self.queues[member_id].get()
            client = self.clients[member_id]
            # 处理消息
```

**Step 2: 消息处理逻辑**

- 解析消息中的 @mentions
- 为每个被 @的成员创建/获取 session
- 将消息加入队列

**Step 3: 实现工作日志记录**

在处理过程中记录 thinking、tool_call、output 到数据库。

**Step 4: Commit**

```bash
git add backend/app/services/
git commit -m "feat: 添加 ACP 客户端管理服务"
```

---

### Task 9: Session 管理

**Files:**
- Modify: `backend/app/services/acp_client.py`
- Modify: `backend/app/models/acp_session.py`

**Step 1: Session 创建与复用**

```python
async def get_or_create_session(self, feature_id: int, member_id: int, prompt: str) -> str:
    # 查询数据库中是否有可用 session
    # 如果有，测试是否有效
    # 如果无效或不存在，创建新 session
```

**Step 2: Session 持久化**

将 session_id 存储到数据库。

**Step 3: 测试 Session 管理**

创建两个 session，验证可以复用。

**Step 4: Commit**

```bash
git add backend/app/
git commit -m "feat: 添加 Session 管理"
```

---

### Task 10: 消息队列与处理

**Files:**
- Modify: `backend/app/services/acp_client.py`

**Step 1: 实现消息队列**

```python
async def send_to_member(self, feature_id: int, member_id: int, message: str):
    await self.queues[member_id].put({
        "feature_id": feature_id,
        "message": message
    })
```

**Step 2: 实现消息处理**

- 从队列取消息
- 获取/创建 session
- 发送消息到 ACP 客户端
- 接收响应

**Step 3: 实现群聊消息处理**

如果响应中包含 @角色，解析并添加到群聊消息。

**Step 4: Commit**

```bash
git add backend/app/services/
git commit -m "feat: 添加消息队列和处理"
```

---

## 阶段三：前端开发

### Task 11: 前端项目初始化

**Files:**
- Create: `frontend/vite.config.ts`
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1: 创建 Vite + React + TypeScript 项目**

```bash
npm create vite@latest frontend -- --template react-ts
```

**Step 2: 安装依赖**

```bash
cd frontend
npm install
npm install react-router-dom axios socket.io-client
```

**Step 3: 创建基础页面结构**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/projects/:projectId/features/:featureId/chat" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 4: 测试前端启动**

Run: `cd frontend && npm run dev`
Expected: 前端服务启动

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: 初始化前端项目"
```

---

### Task 12: 项目管理页面

**Files:**
- Create: `frontend/src/pages/ProjectList.tsx`
- Create: `frontend/src/pages/NewProject.tsx`
- Create: `frontend/src/api/projects.ts`

**Step 1: 创建项目列表页面**

```tsx
function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  
  useEffect(() => {
    api.getProjects().then(setProjects)
  }, [])
  
  return (
    <div>
      <h1>项目列表</h1>
      {projects.map(p => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  )
}
```

**Step 2: 创建新建项目页面**

**Step 3: 创建 API 客户端**

```ts
const api = {
  getProjects: () => fetch("/api/projects").then(r => r.json()),
  createProject: (data: ProjectCreate) => 
    fetch("/api/projects", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
}
```

**Step 4: 测试**

访问页面，验证项目创建功能。

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: 添加项目管理页面"
```

---

### Task 13: 项目详情页面

**Files:**
- Create: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: 创建项目详情页面**

显示：feature 列表、team 成员列表

```tsx
function ProjectDetail() {
  const { projectId } = useParams()
  const [project, setProject] = useState<ProjectDetail>()
  
  return (
    <div>
      <h1>{project?.name}</h1>
      <Section title="Features">
        {project?.features.map(f => <div key={f.id}>{f.name}</div>)}
      </Section>
      <Section title="Team">
        {project?.members.map(m => <div key={m.id}>{m.name}</div>)}
      </Section>
    </div>
  )
}
```

**Step 2: 添加 Feature 创建功能**

**Step 3: 添加 Team 成员管理功能**

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: 添加项目详情页面"
```

---

### Task 14: 群聊页面

**Files:**
- Create: `frontend/src/pages/Chat.tsx`
- Create: `frontend/src/components/MessageList.tsx`
- Create: `frontend/src/components/MessageInput.tsx`

**Step 1: 创建消息列表组件**

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <span>{m.sender}:</span> {m.content}
        </div>
      ))}
    </div>
  )
}
```

**Step 2: 创建消息输入组件**

支持 @mentions 的输入框。

```tsx
function MessageInput({ onSend }: { onSend: (content: string, mentions: string[]) => void }) {
  const [content, setContent] = useState("")
  
  const handleSend = () => {
    const mentions = parseMentions(content)
    onSend(content, mentions)
  }
  
  return (
    <input value={content} onChange={e => setContent(e.target.value)} />
  )
}
```

**Step 3: 创建群聊页面**

整合 WebSocket 连接、消息列表、输入框。

```tsx
function Chat() {
  const { featureId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${featureId}`)
    ws.onmessage = (event) => {
      setMessages(prev => [...prev, JSON.parse(event.data)])
    }
    return () => ws.close()
  }, [featureId])
  
  return (
    <div>
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  )
}
```

**Step 4: 测试群聊功能**

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: 添加群聊页面"
```

---

### Task 15: 角色工作窗口

**Files:**
- Create: `frontend/src/components/MemberWorkWindow.tsx`
- Create: `frontend/src/components/WorkLogList.tsx`

**Step 1: 创建工作日志列表组件**

```tsx
function WorkLogList({ logs }: { logs: WorkLog[] }) {
  return (
    <div>
      {logs.map(log => (
        <div key={log.id} className={`log-${log.log_type}`}>
          {log.content}
        </div>
      ))}
    </div>
  )
}
```

**Step 2: 创建角色工作窗口组件**

显示：状态栏、工作日志列表

```tsx
function MemberWorkWindow({ memberId, featureId }: { memberId: number, featureId: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "busy">("idle")
  const [logs, setLogs] = useState<WorkLog[]>([])
  
  return (
    <div>
      <div onClick={() => setIsOpen(!isOpen)}>
        {memberName} - {status}
      </div>
      {isOpen && <WorkLogList logs={logs} />}
    </div>
  )
}
```

**Step 3: 在群聊页面集成工作窗口**

在群聊页面显示所有角色的状态。

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: 添加角色工作窗口"
```

---

## 阶段四：集成与测试

### Task 16: 端到端测试

**Step 1: 启动后端服务**

```bash
cd backend && uv run uvicorn app.main:app --reload
```

**Step 2: 启动前端服务**

```bash
cd frontend && npm run dev
```

**Step 3: 完整流程测试**

1. 创建项目 → 自动创建默认团队
2. 创建 feature
3. 进入群聊，发送消息 "@Developer 完成登录功能"
4. 验证消息在群聊显示
5. 验证 ACP 客户端收到消息
6. 验证工作窗口显示处理过程
7. 验证角色回复

**Step 4: Commit**

```bash
git add .
git commit -m "feat: 完成端到端集成"
```

---

## 执行方式

**Plan complete and saved to `docs/plans/2026-03-01-acp-teams-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
