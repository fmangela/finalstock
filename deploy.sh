#!/bin/bash

# ============================================
# FinalStock 一键部署脚本
# 支持 CentOS / Ubuntu / Debian
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印信息
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检测操作系统
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

# 安装 Node.js
install_nodejs() {
    log_info "检查 Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_info "Node.js 已安装: $NODE_VERSION"
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

# 安装 MariaDB
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

# 安装 Nginx
install_nginx() {
    log_info "检查 Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_info "Nginx 已安装"
        return
    fi
    
    log_info "安装 Nginx..."
    
    if [ "$OS" = "centos" ] || [ "$OS" = "rocky" ] || [ "$OS" = "alma" ]; then
        yum install -y nginx
        systemctl enable nginx
    elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt install -y nginx
        systemctl enable nginx
    fi
    
    log_info "Nginx 安装完成"
}

# 获取 MySQL root 密码
get_mysql_root_password() {
    # 优先使用环境变量
    if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
        MYSQL_OPTS="-u root -p${MYSQL_ROOT_PASSWORD}"
        return
    fi

    # 尝试无密码连接（新安装默认）
    if mysql -u root -e "SELECT 1" &>/dev/null 2>&1; then
        MYSQL_OPTS="-u root"
        return
    fi

    # 交互式输入密码
    read -rsp "请输入 MySQL root 密码: " MYSQL_ROOT_PASSWORD
    echo
    MYSQL_OPTS="-u root -p${MYSQL_ROOT_PASSWORD}"
}

# 配置数据库
setup_database() {
    log_info "配置数据库..."

    get_mysql_root_password

    # 创建数据库和表
    mysql $MYSQL_OPTS << EOF
CREATE DATABASE IF NOT EXISTS openclaw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON openclaw.* TO 'openclaw'@'localhost' IDENTIFIED BY 'ocoper';
FLUSH PRIVILEGES;
EOF

    # 运行初始化脚本
    if [ -f "$SCRIPT_DIR/database/init.sql" ]; then
        mysql $MYSQL_OPTS openclaw < "$SCRIPT_DIR/database/init.sql"
        log_info "数据库表创建完成"
    fi

    log_info "数据库配置完成"
}

# 配置后端
setup_backend() {
    log_info "配置后端服务..."
    
    BACKEND_DIR="$SCRIPT_DIR/backend"
    
    # 安装依赖
    cd "$BACKEND_DIR"
    npm install --production
    
    # 复制环境变量文件
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            log_info "请编辑 $BACKEND_DIR/.env 配置数据库连接"
        fi
    fi
    
    log_info "后端配置完成"
}

# 配置前端
setup_frontend() {
    log_info "配置前端服务..."
    
    FRONTEND_DIR="$SCRIPT_DIR/frontend"
    
    # 安装依赖
    cd "$FRONTEND_DIR"
    npm install
    
    # 构建
    npm run build
    
    log_info "前端构建完成"
}

# 检测 BT 面板路径
detect_web_root() {
    if [ -d "/www/wwwroot" ]; then
        WEB_ROOT="/www/wwwroot/finalstock"
        log_info "检测到 BT 面板，使用路径: $WEB_ROOT"
    else
        WEB_ROOT="/var/www/finalstock"
        log_info "使用默认路径: $WEB_ROOT"
    fi
}

# 配置 Nginx
configure_nginx() {
    log_info "配置 Nginx..."

    detect_web_root

    # 创建 Nginx 配置
    cat > /etc/nginx/conf.d/finalstock.conf << EOF
server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root ${WEB_ROOT}/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # 创建目录并复制前端文件
    mkdir -p "${WEB_ROOT}/frontend/dist"
    cp -r "$SCRIPT_DIR/frontend/dist"/* "${WEB_ROOT}/frontend/dist/"

    # 测试配置
    nginx -t

    # 重启 Nginx
    systemctl restart nginx

    log_info "Nginx 配置完成"
}

# 创建 systemd 服务
create_systemd_service() {
    log_info "创建 systemd 服务..."
    
    cat > /etc/systemd/system/finalstock.service << 'EOF'
[Unit]
Description=FinalStock Backend Service
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/www/wwwroot/finalstock/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable finalstock
    
    log_info "systemd 服务创建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 启动后端
    systemctl restart finalstock
    sleep 2
    
    # 检查状态
    if systemctl is-active --quiet finalstock; then
        log_info "后端服务启动成功"
    else
        log_error "后端服务启动失败"
        journalctl -u finalstock -n 20
    fi
    
    # 启动 Nginx
    systemctl restart nginx
    
    log_info "所有服务启动完成"
}

# 打印使用说明
print_usage() {
    echo ""
    echo "=========================================="
    echo "  部署完成！"
    echo "=========================================="
    echo ""
    echo "服务地址:"
    echo "  - 前端: http://你的服务器IP"
    echo "  - 后端: http://你的服务器IP:3000"
    echo ""
    echo "管理命令:"
    echo "  - 重启后端: systemctl restart finalstock"
    echo "  - 查看日志: journalctl -u finalstock -f"
    echo "  - 重启 Nginx: systemctl restart nginx"
    echo ""
    echo "数据库:"
    echo "  - 默认数据库: openclaw"
    echo "  - 用户: openclaw / ocoper"
    echo ""
}

# 主函数
main() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    log_info "=========================================="
    log_info "  FinalStock 一键部署脚本"
    log_info "=========================================="
    
    check_root
    detect_os
    
    # 如果指定了 --backend-only，只部署后端
    if [ "$1" = "--backend-only" ]; then
        log_info "仅部署后端服务..."
        install_nodejs
        install_mariadb
        setup_database
        setup_backend
        create_systemd_service
        start_services
        print_usage
        exit 0
    fi
    
    # 完整部署
    install_nodejs
    install_mariadb
    install_nginx
    setup_database
    setup_backend
    setup_frontend
    configure_nginx
    create_systemd_service
    start_services
    
    print_usage
}

# 运行主函数
main "$@"