#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
RUNTIME_DIR="$SCRIPT_DIR/.runtime"
LOG_DIR="$SCRIPT_DIR/logs"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG_FILE="$LOG_DIR/backend-test.log"
FRONTEND_LOG_FILE="$LOG_DIR/frontend-test.log"

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_CMD="${BACKEND_CMD:-npm run dev}"
FRONTEND_CMD="${FRONTEND_CMD:-npm run dev}"

usage() {
  cat <<'EOF'
Usage:
  ./restart-test-env.sh [start|stop|restart|status]

Defaults:
  restart    Stop and start frontend/backend test services

Optional env overrides:
  BACKEND_PORT   Backend port, default 3000
  FRONTEND_PORT  Frontend port, default 5173
  BACKEND_CMD    Backend start command, default "npm run dev"
  FRONTEND_CMD   Frontend start command, default "npm run dev"
EOF
}

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

fail() {
  log "$*"
  exit 1
}

ensure_project_layout() {
  [[ -f "$BACKEND_DIR/package.json" ]] || fail "Missing backend/package.json"
  [[ -f "$FRONTEND_DIR/package.json" ]] || fail "Missing frontend/package.json"
}

ensure_runtime_dirs() {
  mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
}

ensure_dependencies() {
  [[ -d "$BACKEND_DIR/node_modules" ]] || fail "Missing backend/node_modules, please run: cd backend && npm install"
  [[ -d "$FRONTEND_DIR/node_modules" ]] || fail "Missing frontend/node_modules, please run: cd frontend && npm install"
}

get_pid_from_file() {
  local pid_file="$1"

  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' < "$pid_file"
  fi
}

is_pid_running() {
  local pid="$1"

  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

find_pids_by_port() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null \
      | awk -v port="$port" '$4 ~ ":" port "$" || $4 ~ "\\]:" port "$"' \
      | grep -o 'pid=[0-9]\+' \
      | cut -d= -f2 \
      | sort -u || true
    return
  fi

  return 0
}

collect_service_pids() {
  local pid_file="$1"
  local port="$2"
  local file_pid port_pids

  file_pid="$(get_pid_from_file "$pid_file")"
  port_pids="$(find_pids_by_port "$port")"

  {
    [[ -n "$file_pid" ]] && printf '%s\n' "$file_pid"
    [[ -n "$port_pids" ]] && printf '%s\n' "$port_pids"
  } | awk 'NF' | sort -u
}

wait_for_port_release() {
  local port="$1"
  local retries=20

  while (( retries > 0 )); do
    if [[ -z "$(find_pids_by_port "$port")" ]]; then
      return 0
    fi

    sleep 1
    retries=$((retries - 1))
  done

  return 1
}

wait_for_port_ready() {
  local port="$1"
  local retries=20

  while (( retries > 0 )); do
    if [[ -n "$(find_pids_by_port "$port")" ]]; then
      return 0
    fi

    sleep 1
    retries=$((retries - 1))
  done

  return 1
}

stop_service() {
  local name="$1"
  local pid_file="$2"
  local port="$3"
  local pids pid

  pids="$(collect_service_pids "$pid_file" "$port")"

  if [[ -z "$pids" ]]; then
    rm -f "$pid_file"
    log "$name is not running"
    return 0
  fi

  log "Stopping $name"

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    if is_pid_running "$pid"; then
      kill "$pid" 2>/dev/null || true
    fi
  done <<< "$pids"

  if ! wait_for_port_release "$port"; then
    log "$name did not exit in time, forcing termination"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      if is_pid_running "$pid"; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done <<< "$pids"
    wait_for_port_release "$port" || true
  fi

  rm -f "$pid_file"
}

start_service() {
  local name="$1"
  local service_dir="$2"
  local command="$3"
  local pid_file="$4"
  local log_file="$5"
  local port="$6"
  local pid

  if [[ -n "$(collect_service_pids "$pid_file" "$port")" ]]; then
    log "$name is already running, skipping start"
    return 0
  fi

  printf '\n[%s] Starting %s with command: %s\n' "$(timestamp)" "$name" "$command" >> "$log_file"

  (
    cd "$service_dir"
    nohup bash -lc "exec $command" >> "$log_file" 2>&1 &
    echo "$!" > "$pid_file"
  )

  pid="$(get_pid_from_file "$pid_file")"
  sleep 1

  if ! is_pid_running "$pid"; then
    fail "$name failed to start, check log: $log_file"
  fi

  if wait_for_port_ready "$port"; then
    log "$name started on port $port (pid $pid)"
  else
    fail "$name process started but port $port is not ready, check log: $log_file"
  fi
}

status_service() {
  local name="$1"
  local pid_file="$2"
  local port="$3"
  local log_file="$4"
  local pids

  pids="$(collect_service_pids "$pid_file" "$port")"

  if [[ -n "$pids" ]]; then
    log "$name is running on port $port"
    printf '%s\n' "$pids" | awk 'NF { printf("  pid: %s\n", $1) }'
    printf '  log: %s\n' "$log_file"
  else
    log "$name is not running"
  fi
}

main() {
  local action="${1:-restart}"

  ensure_project_layout
  ensure_runtime_dirs

  case "$action" in
    start)
      ensure_dependencies
      start_service "backend" "$BACKEND_DIR" "$BACKEND_CMD" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE" "$BACKEND_PORT"
      start_service "frontend" "$FRONTEND_DIR" "$FRONTEND_CMD" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" "$FRONTEND_PORT"
      ;;
    stop)
      stop_service "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"
      stop_service "backend" "$BACKEND_PID_FILE" "$BACKEND_PORT"
      ;;
    restart)
      ensure_dependencies
      stop_service "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"
      stop_service "backend" "$BACKEND_PID_FILE" "$BACKEND_PORT"
      start_service "backend" "$BACKEND_DIR" "$BACKEND_CMD" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE" "$BACKEND_PORT"
      start_service "frontend" "$FRONTEND_DIR" "$FRONTEND_CMD" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" "$FRONTEND_PORT"
      ;;
    status)
      status_service "backend" "$BACKEND_PID_FILE" "$BACKEND_PORT" "$BACKEND_LOG_FILE"
      status_service "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT" "$FRONTEND_LOG_FILE"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "${1:-restart}"
