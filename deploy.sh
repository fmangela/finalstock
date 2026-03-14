#!/bin/bash

# ============================================
# FinalStock 一键部署脚本
# 支持 CentOS / Ubuntu / Debian
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    log_info "检测到操作系统: $OS"
}

install_nodejs() {
    log_info "检查 Node.js..."
    if command -v node &> /dev/null; then
        log_info "Node.js 已安装: $(node -v)"
        return
    fi
    log_info "安装 Node.js..."
    if [ "$OS" = "centos" ] || [ "$OS" = "rocky" ] || [ "$OS" = "alma" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    else
        log_error "不支持的操作系统"
        exit 1
    fi
    log_info "Node.js 安装完成: $(node -v)"
}

install_mariadb() {
    log_info "检查 MariaDB..."
    if command -v mysql &> /dev/null; then
        log_info "MariaDB 已安装"
        return
    fi
    log_info "安装 MariaDB..."
    if [ "$OS" = "centos" ] || [ "$OS" = "rocky" ] || [ "$OS" = "alma" ]; then
        yum install -y mariadb mariadb-server
        systemctl enable mariadb
        systemctl start mariadb
    elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt update
        apt install -y mariadb-server
        systemctl enable mariadb
        systemctl start mariadb
    fi
    log_info "MariaDB 安装完成"
}

get_mysql_root_password() {
    if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
        MYSQL_OPTS="-u root -p${MYSQL_ROOT_PASSWORD}"
        return
    fi
    if mysql -u root -e "SELECT 1" &>/dev/null 2>&1; then
        MYSQL_OPTS="-u root"
        return
    fi
    read -rsp "请输入 MySQL root 密码: " MYSQL_ROOT_PASSWORD
    echo
    MYSQL_OPTS="-u root -p${MYSQL_ROOT_PASSWORD}"
}

setup_database() {
    log_info "配置数据库..."
    get_mysql_root_password
    mysql $MYSQL_OPTS << EOF
CREATE DATABASE IF NOT EXISTS openclaw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON openclaw.* TO 'openclaw'@'localhost' IDENTIFIED BY 'ocoper';
FLUSH PRIVILEGES;
EOF
    if [ -f "$SCRIPT_DIR/database/init.sql" ]; then
        mysql $MYSQL_OPTS openclaw < "$SCRIPT_DIR/database/init.sql"
        log_info "数据库表创建完成"
    fi
    log_info "数据库配置完成"
}

setup_backend() {
    log_info "配置后端服务..."
    BACKEND_DIR="$SCRIPT_DIR/backend"
    cd "$BACKEND_DIR"
    npm install --production
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            log_warn "请编辑 $BACKEND_DIR/.env 配置数据库连接和 LLM 参数"
        fi
    fi
    log_info "后端配置完成"
}

create_systemd_service() {
    log_info "创建 systemd 服务..."
    BACKEND_DIR="$SCRIPT_DIR/backend"
    cat > /etc/systemd/system/finalstock.service << EOF
[Unit]
Description=FinalStock Backend Service
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND_DIR}
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
EnvironmentFile=${BACKEND_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable finalstock
    log_info "systemd 服务创建完成"
}

start_services() {
    log_info "启动服务..."
    systemctl restart finalstock
    sleep 2
    if systemctl is-active --quiet finalstock; then
        log_info "后端服务启动成功"
    else
        log_error "后端服务启动失败"
        journalctl -u finalstock -n 20
    fi
    log_info "所有服务启动完成"
}

print_usage() {
    echo ""
    echo "=========================================="
    echo "  部署完成！"
    echo "=========================================="
    echo ""
    echo "服务地址:"
    echo "  - 后端 API: http://你的服务器IP:3000"
    echo "  - 健康检查: http://你的服务器IP:3000/api/health"
    echo ""
    echo "管理命令:"
    echo "  - 重启后端: systemctl restart finalstock"
    echo "  - 查看日志: journalctl -u finalstock -f"
    echo "  - 查看状态: systemctl status finalstock"
    echo ""
    echo "数据库:"
    echo "  - 默认数据库: openclaw"
    echo "  - 用户: openclaw / ocoper"
    echo ""
}

main() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    log_info "=========================================="
    log_info "  FinalStock 一键部署脚本"
    log_info "=========================================="
    check_root
    detect_os
    install_nodejs
    install_mariadb
    setup_database
    setup_backend
    create_systemd_service
    start_services
    print_usage
}

main "$@"
