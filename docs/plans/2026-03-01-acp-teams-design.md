# ACP 开发团队系统设计

## 概述

基于 Agent Client Protocol (ACP) 协议，实现一个类似 Claude Code Teams 的开发团队协作系统。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite |
| 后端 | FastAPI + Pydantic |
| 数据库 | SQLite + SQLAlchemy |
| 实时通信 | WebSocket |
| ACP 通信 | agent-client-protocol |

## 核心架构

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Web 前端   │ ←────────────────→ │  FastAPI   │
└─────────────┘                    │   后端服务  │
                                   └──────┬──────┘
                                          │
           ┌──────────────────────────────┼──────────────────────────────┐
           │                              │                              │
           ▼                              ▼                              ▼
    ┌─────────────┐               ┌─────────────┐               ┌─────────────┐
    │   SQLite    │               │  ACP 客户端 │               │  ACP 客户端 │
    │   数据库     │               │  (角色1)    │               │  (角色2)    │
    └─────────────┘               └─────────────┘               └─────────────┘
```

## 数据库表结构

### projects
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 项目名称 |
| directory | String | 项目目录 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### features
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| project_id | Integer | 外键，所属项目 |
| name | String | feature 名称 |
| created_at | DateTime | 创建时间 |

### teams
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| project_id | Integer | 外键，所属项目 |

### team_members
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| team_id | Integer | 外键，所属团队 |
| name | String | 成员名称（如 @PM, @Developer） |
| role | String | 角色描述 |
| prompt | String | 系统提示词 |
| acp_process_id | Integer | ACP 进程 ID（可为空） |

### messages
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| feature_id | Integer | 外键，所属 feature |
| sender | String | 发送者（@User, @PM 等） |
| content | String | 消息内容 |
| mentions | String | 被 @ 的角色列表（JSON） |
| created_at | DateTime | 创建时间 |

### member_work_logs
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| feature_id | Integer | 外键，所属 feature |
| member_id | Integer | 外键，团队成员 |
| log_type | String | 日志类型（thought, tool_call, output） |
| content | String | 日志内容 |
| created_at | DateTime | 创建时间 |

### acp_sessions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| feature_id | Integer | 外键，所属 feature |
| member_id | Integer | 外键，团队成员 |
| session_id | String | ACP session ID |
| created_at | DateTime | 创建时间 |

## 功能模块

### 1. 项目管理

- 创建、删除、修改项目
- 设置项目名称和目录

### 2. Feature 管理

- 基于项目创建/删除 feature

### 3. Team 管理

- 项目创建时自动创建默认团队
- 从 `config/default_team.yaml` 读取配置
- 支持添加/删除团队成员
- 支持配置多个同名角色（如 @Developer1, @Developer2）

### 4. 群聊功能

- 用户在群聊页面发送消息
- 支持 @多个角色
- 消息格式：发送者 + 内容 + mentions
- 群聊消息持久化到数据库

### 5. 消息队列与处理

- 每个角色维护独立消息队列
- 后端自动管理 ACP 客户端进程
- 消息处理流程：
  1. 用户发送消息，解析 mentions
  2. 消息存入群聊数据库
  3. 为每个被 @角色 创建/获取 session
  4. 消息加入角色队列
  5. ACP 客户端异步处理
  6. 角色回复中如有 @角色，存入群聊

### 6. 角色工作窗口

- 显示角色的思考过程、工具调用、输出
- 工作日志持久化到数据库
- 点击角色状态栏可展开工作窗口

### 7. Session 管理

- session 按 feature + role 隔离
- 复用 session 保持对话上下文
- session 失效时自动重建

## 前端页面路由

| 路径 | 功能 |
|------|------|
| `/` | 项目列表 |
| `/projects/new` | 创建项目 |
| `/projects/:id` | 项目详情（feature 列表 + team 成员） |
| `/projects/:id/features/:featureId/chat` | 群聊页面 |

## 默认团队配置

文件位置：`config/default_team.yaml`

```yaml
members:
  - name: "PM"
    role: "Project Manager"
    prompt: "你是一个项目经理..."
  - name: "Architect"
    role: "System Architect"
    prompt: "你是一个系统架构师..."
  - name: "Developer"
    role: "Developer"
    prompt: "你是一个开发工程师..."
  - name: "QA"
    role: "Quality Assurance"
    prompt: "你是一个 QA 工程师..."
```
