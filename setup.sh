#!/bin/bash
# ============================================================
# TikTok Live Analytics — One-Click Setup
# 一键部署脚本：安装依赖 → 构建扩展 → 启动服务器
# ============================================================

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}[$1/4]${NC} $2"; }
print_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
print_warn() { echo -e "  ${YELLOW}!${NC} $1"; }
print_err()  { echo -e "  ${RED}✗${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Step 1: Check environment ──────────────────────────────
print_step 1 "Checking environment / 检查环境..."

if ! command -v node > /dev/null 2>&1; then
    print_err "Node.js not found / 未找到 Node.js"
    echo ""
    echo "  Please install Node.js >= 18:"
    echo "  请安装 Node.js >= 18："
    echo ""
    echo "    https://nodejs.org/"
    echo ""
    echo "  Or use nvm:"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    echo "    nvm install 18"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_err "Node.js version too old: $(node -v) (need >= 18)"
    print_err "Node.js 版本过低: $(node -v)（需要 >= 18）"
    exit 1
fi
print_ok "Node.js $(node -v)"

if ! command -v npm > /dev/null 2>&1; then
    print_err "npm not found / 未找到 npm"
    exit 1
fi
print_ok "npm $(npm -v)"

# Check if port 3456 is available
if command -v lsof > /dev/null 2>&1; then
    if lsof -i :3456 > /dev/null 2>&1; then
        print_warn "Port 3456 is in use / 端口 3456 已被占用"
        print_warn "The server may fail to start. Kill the process first:"
        print_warn "服务器可能无法启动。请先关闭占用进程："
        echo "    lsof -i :3456"
        echo ""
    fi
fi

# ── Step 2: Install server dependencies ────────────────────
print_step 2 "Installing server dependencies / 安装服务器依赖..."

cd "$SCRIPT_DIR/tiktok-live-server"
if npm install --silent 2>&1; then
    print_ok "Server dependencies installed / 服务器依赖安装完成"
else
    print_err "Failed to install server dependencies / 服务器依赖安装失败"
    exit 1
fi

# ── Step 3: Build extension ────────────────────────────────
print_step 3 "Building Chrome extension / 构建 Chrome 扩展..."

cd "$SCRIPT_DIR/tiktok-live-extension"
if npm install --silent 2>&1; then
    print_ok "Extension dependencies installed / 扩展依赖安装完成"
else
    print_err "Failed to install extension dependencies / 扩展依赖安装失败"
    exit 1
fi

if npm run build 2>&1; then
    print_ok "Extension built / 扩展构建完成"
else
    print_err "Extension build failed / 扩展构建失败"
    exit 1
fi

EXTENSION_PATH="$SCRIPT_DIR/tiktok-live-extension/dist/chrome-mv3"

# ── Step 4: Start server ──────────────────────────────────
print_step 4 "Starting server / 启动服务器..."

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Setup complete! / 部署完成！${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  ${CYAN}Next steps / 下一步：${NC}"
echo ""
echo "  1. Load the extension in Chrome / 在 Chrome 中加载扩展："
echo "     a. Open chrome://extensions/"
echo "        打开 chrome://extensions/"
echo "     b. Enable 'Developer mode' (top right toggle)"
echo "        开启右上角「开发者模式」"
echo "     c. Click 'Load unpacked' / 点击「加载已解压的扩展程序」"
echo "     d. Select this folder / 选择此文件夹："
echo -e "        ${YELLOW}${EXTENSION_PATH}${NC}"
echo ""
echo "  2. The server is starting below / 服务器正在启动："
echo -e "     ${YELLOW}http://localhost:3456${NC}"
echo ""
echo "  3. Click the extension icon → enter a TikTok username → Connect"
echo "     点击扩展图标 → 输入 TikTok 用户名 → 连接"
echo ""
echo -e "  ${CYAN}Press Ctrl+C to stop the server / 按 Ctrl+C 停止服务器${NC}"
echo ""
echo "------------------------------------------------------------"
echo ""

cd "$SCRIPT_DIR/tiktok-live-server"
node server.js
