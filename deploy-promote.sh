#!/bin/bash
# 镜像站升级到主站脚本
# 用法：./deploy-promote.sh
# 前提：镜像站已测试通过

set -e

# 先确保本地代码推到 GitHub
echo "📤 推送本地代码到 GitHub..."
git push origin main

echo "🚀 将代码升级到主站..."
sshpass -p 'YOUR_SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no user@YOUR_SERVER_IP '
  # 1. 主站拉最新代码
  cd /var/www/flj
  git fetch origin
  git reset --hard origin/main

  # 2. 恢复主站的 next.config（无 basePath）
  cat > next.config.ts << EOF
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
EOF

  # 3. 构建主站
  npm run build 2>&1 | tail -5

  # 4. 重启主站
  pm2 restart flj

  echo "✅ 主站升级完成 → https://flj.info"
'
