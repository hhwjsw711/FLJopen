#!/bin/bash
# 部署到镜像站（测试环境）
# 用法：./deploy-mirror.sh
# 测试地址：https://flj.info/mirror

set -e

echo "🔄 部署到镜像站..."
sshpass -p 'YOUR_SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no user@YOUR_SERVER_IP '
  # 1. 镜像站拉最新代码
  cd /var/www/flj-mirror
  git pull

  # 2. 恢复镜像站的 next.config（带 basePath + env）
  cat > next.config.mjs << EOF
/** @type {import("next").NextConfig} */
const nextConfig = {
  basePath: "/mirror",
  assetPrefix: "/mirror",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/mirror",
  },
};
export default nextConfig;
EOF

  # 3. 构建镜像站
  npm run build 2>&1 | tail -5

  # 4. 重启镜像站
  pm2 restart flj-mirror

  echo "✅ 镜像站部署完成 → https://flj.info/mirror"
'
