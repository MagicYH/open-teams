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

## 日志规范

### 日志级别

- **INFO**: 关键业务流程（创建、删除、状态变更）
- **DEBUG**: 详细执行过程（参数、返回值）
- **ERROR**: 异常错误

### LogID 机制

每个请求分配唯一 LogID，用于串联整个请求链路：

1. **请求入口生成 LogID**：API 请求进入时生成 UUID
2. **传递到响应头**：响应返回时带上 `X-LogID` 头
3. **响应体包含 LogID**：所有 API 响应体包含 `log_id` 字段
4. **日志携带 LogID**：所有日志打印包含 `log_id` 字段
5. **前端追溯**：前端请求/响应都保存 log_id，报告问题时带上

#### LogID 格式

```
log_id: "req_abc123def456"
```

#### 响应格式示例

```json
{
  "id": 1,
  "name": "my-project",
  "log_id": "req_abc123def456"
}
```

```json
{
  "error": "Project not found",
  "log_id": "req_abc123def456"
}
```

### 必须记录的日志

#### 项目操作
- 创建项目：`project_id=1, name=xxx, directory=xxx`
- 删除项目：`project_id=1`

#### Feature 操作
- 创建 feature：`project_id=1, feature_id=1, name=xxx`
- 删除 feature：`project_id=1, feature_id=1`

#### Team 操作
- 创建成员：`project_id=1, member_id=1, name=@Developer`
- 删除成员：`project_id=1, member_id=1, name=@Developer`

#### 消息处理
- 用户发送消息：`feature_id=1, from=@User, to=@Developer, content=xxx`
- 角色发送消息：`feature_id=1, from=@Developer, to=@User/PM, content=xxx`
- 消息存入群聊：`feature_id=1, message_id=1, sender=@xxx, mentions=[@yyy]`
- 消息加入队列：`feature_id=1, from=@xxx, to=@yyy, queue_position=1`

#### ACP 客户端
- 启动 ACP 客户端：`member_id=1, name=@Developer, command=opencode acp`
- 创建 session：`feature_id=1, member_id=1, session_id=xxx`
- 复用 session：`feature_id=1, member_id=1, session_id=xxx`
- Session 失效重建：`feature_id=1, member_id=1, old_session_id=xxx -> new_session_id=xxx`

#### WebSocket
- 客户端连接：`feature_id=1, ws_id=xxx`
- 客户端断开：`feature_id=1, ws_id=xxx`
- 广播消息：`feature_id=1, message_id=1`

### 日志格式

```python
import logging

logger = logging.getLogger(__name__)

# 示例
logger.info(
    "用户发送消息",
    extra={
        "feature_id": 1,
        "from": "@User",
        "to": ["@Developer"],
        "content": "完成登录功能",
    }
)

logger.info(
    "消息加入处理队列",
    extra={
        "feature_id": 1,
        "member_id": 1,
        "from": "@User",
        "queue_size": 3,
    }
)

logger.info(
    "创建 ACP session",
    extra={
        "feature_id": 1,
        "member_id": 1,
        "session_id": "sess_xxx",
    }
)
```

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
| display_name | String | 显示名称（可选，用于 UI 展示） |
| color | String | UI 展示颜色（如 #FF5733） |
| role | String | 角色描述 |
| prompt | String | 系统提示词 |
| acp_start_command | String | ACP 启动命令（如 `opencode acp`） |
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

#### 消息展示要求

- 群聊消息必须清晰显示发送者名称（带 @ 前缀）
- 不同类型发送者使用不同样式区分：
  - @User（用户）：使用默认样式
  - @角色（团队成员）：使用团队成员配置的颜色/样式
- 消息时间显示在消息下方

#### 消息发送规则

- 用户可以 @一个或多个角色发送消息
- 角色也可以 @其他角色发送消息
- 角色可以 @User 发送消息给用户
- 所有带 @的消息都需要在群聊中展示
- 消息发送时需要解析 mentions，存入消息表时记录所有被 @的角色

### 5. 消息队列与处理

- 每个角色维护独立消息队列
- 后端自动管理 ACP 客户端进程
- 消息处理流程：
  1. 任何发送者（用户或角色）发送消息，解析 mentions
  2. 消息存入群聊数据库（所有带 @的消息都存入群聊）
  3. 如果有被 @的角色，为每个角色创建/获取 session，消息加入队列
  4. 如果消息发送者是角色，且被 @User，则消息已在群聊中展示
  5. ACP 客户端异步处理
  6. 角色回复中如有 @角色，存入群聊供所有人可见

### 6. 角色工作窗口

- 显示角色的思考过程、工具调用、输出
- 工作日志持久化到数据库
- 点击角色状态栏可展开工作窗口
- 工作窗口中需要明确显示消息来源（来自哪个角色）
- 工作窗口展示内容区分：
  - 发送给该角色的消息（带 @角色 的消息）
  - 角色自己的工作输出（thinking、tool_call、output）

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
    display_name: "项目经理"
    color: "#FF5733"
    role: "Project Manager"
    prompt: "你是一个项目经理..."
    acp_start_command: "opencode acp"
  - name: "Architect"
    display_name: "架构师"
    color: "#33FF57"
    role: "System Architect"
    prompt: "你是一个系统架构师..."
    acp_start_command: "opencode acp"
  - name: "Developer"
    display_name: "开发者"
    color: "#3357FF"
    role: "Developer"
    prompt: "你是一个开发工程师..."
    acp_start_command: "opencode acp"
  - name: "QA"
    display_name: "测试工程师"
    color: "#FF33F5"
    role: "Quality Assurance"
    prompt: "你是一个 QA 工程师..."
    acp_start_command: "opencode acp"
```
