# ACP Teams - 多智能体开发协同系统

这是一个基于 Agent Client Protocol (ACP) 协议实现的类 Claude Code Teams 协作系统。

## 核心特性

- **多智能体团队协同**：支持创建包含 PM、架构师、开发者和 QA 的智能团队。
- **Feature 驱动开发**：以功能特性为维度进行协同开发。
- **实时工作流监控**：前端可实时查看各智能体的思考过程、工具调用及任务进度。
- **ACP 协议隔离**：利用 Session 机制实现不同角色在同一 Feature 下的上下文隔离。

## 技术架构

- **后端**：FastAPI + SQLAlchemy + SQLite + Python 3.12+ (支持 LogID 全链路追踪)。
- **前端**：React + TypeScript + Vite + WebSocket (实时推送)。
- **协同协议**：Agent Client Protocol (ACP)。

## 快速启动

### 前提条件

- **后端**: Python 3.11 或更高版本 (推荐 3.12)
- **前端**: Node.js v18.12 或更高版本 (推荐 v20.x LTS), npm v9.x 或更高版本
- Conda 环境 (可选，推荐用于管理后端 Python 环境)

### 环境搭建

#### 1. 安装后端环境

推荐使用 Conda 创建并管理后端的 Python 环境：

```bash
# 创建 Conda 环境
conda create -n openteams python=3.12 -y

# 激活 Conda 环境
conda activate openteams

# 进入后端目录并安装依赖
cd backend
pip install -e .
```

#### 2. 安装前端环境

请确保系统已安装 Node.js。然后进入前端目录安装所需依赖：

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
```

### 使用脚本启动

我们提供了一个 `run.sh` 脚本，可以方便地管理后端和前端服务。

```bash
# 给脚本添加执行权限
chmod +x run.sh

# 启动所有服务
./run.sh start

# 查看服务状态
./run.sh status
```

### 访问页面

服务启动后，可以通过以下地址访问：

- **前端界面**: [http://localhost:5173](http://localhost:5173)
- **后端 API 文档 (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 手动启动

#### 后端

```bash
cd backend
# 使用已有的 conda 环境
conda activate your_env_name
# 安装依赖
pip install -e .
# 启动服务
uvicorn app.main:app --port 8000 --reload
```

#### 前端

```bash
cd frontend
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```

## 默认配置

默认团队配置位于 `backend/config/default_team.yaml`。创建新项目时，系统会自动根据此配置初始化团队成员。

## 目录结构

```text
.
├── backend          # Python 后端应用
│   ├── app          # 业务逻辑
│   ├── config       # 配置文件 (default_team.yaml)
│   └── logs         # 运行日志
├── frontend         # React 前端应用
│   └── src          # 页面与组件
└── docs             # 设计文档与计划
```
