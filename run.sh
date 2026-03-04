#!/bin/bash

# 项目启动/停止/重启脚本
# 默认后端端口: 8000
# 默认前端端口: 5173

PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PYTHON_BIN="/Users/magic/miniconda3/bin/python" # 使用指定的 conda python

# 尝试加载根目录下的 .env 配置文件
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# 日志文件
BACKEND_LOG="$PROJECT_ROOT/logs/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/logs/frontend.log"

mkdir -p "$PROJECT_ROOT/logs"

start() {
    echo "正在启动服务..."

    # 启动后端 (指定 python 版本并安装依赖，如果需要)
    echo "正在后台启动后端服务 (FastAPI) 端口: $BACKEND_PORT..."
    cd "$BACKEND_DIR"
    nohup "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT > "$BACKEND_LOG" 2>&1 &
    echo $! > "$PROJECT_ROOT/backend.pid"
    echo "后端已启动，PID: $(cat "$PROJECT_ROOT/backend.pid")，日志: $BACKEND_LOG"

    # 启动前端
    echo "正在后台启动前端服务 (Vite) 端口: $FRONTEND_PORT..."
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$PROJECT_ROOT/frontend.pid"
    echo "前端已启动，PID: $(cat "$PROJECT_ROOT/frontend.pid")，日志: $FRONTEND_LOG"

    echo "所有服务启动完成。"
    echo "前端访问地址: http://localhost:$FRONTEND_PORT"
}

stop() {
    echo "正在停止服务..."

    if [ -f "$PROJECT_ROOT/backend.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/backend.pid")
        echo "停止后端服务 (PID: $PID)..."
        kill "$PID" 2>/dev/null
        rm "$PROJECT_ROOT/backend.pid"
    else
        # 尝试通过端口查找并杀掉
        echo "未找到 backend.pid，正在尝试通过端口 $BACKEND_PORT 停止..."
        pkill -f "uvicorn app.main:app"
    fi

    if [ -f "$PROJECT_ROOT/frontend.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/frontend.pid")
        echo "停止前端服务 (PID: $PID)..."
        kill "$PID" 2>/dev/null
        rm "$PROJECT_ROOT/frontend.pid"
    else
        echo "未找到 frontend.pid，正在尝试通过端口 $FRONTEND_PORT 停止..."
        pkill -f "vite"
    fi

    echo "服务已停止。"
}

status() {
    if [ -f "$PROJECT_ROOT/backend.pid" ] && ps -p $(cat "$PROJECT_ROOT/backend.pid") > /dev/null; then
        echo "后端: 运行中 (PID: $(cat "$PROJECT_ROOT/backend.pid"))"
    else
        echo "后端: 已停止"
    fi

    if [ -f "$PROJECT_ROOT/frontend.pid" ] && ps -p $(cat "$PROJECT_ROOT/frontend.pid") > /dev/null; then
        echo "前端: 运行中 (PID: $(cat "$PROJECT_ROOT/frontend.pid"))"
    else
        echo "前端: 已停止"
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
esac

exit 0
