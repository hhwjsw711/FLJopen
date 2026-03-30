# FLJ - Twitter Account Verification Platform

An open-source platform for verifying and rating Twitter/X accounts, with community-driven expose system, points ranking, and admin management tools.

## Features

- 🔍 **Account Search & Verification** - Search Twitter accounts and get AI-powered analysis
- 💥 **Expose System (爆料广场)** - Community-driven expose board with voting and categories
- 🏆 **Points & Ranking** - Tiered user system with points progression
- 🤖 **Telegram Auth** - Three-tier authentication (天龙人/居委会/匿名)
- 💰 **$FLJ Token Top-up** - BSC blockchain token utility for points
- 🛡️ **Admin Dashboard** - Full management panel with statistics, user management, and content moderation
- 🖼️ **Image Upload** - Evidence images for exposes with admin review
- 🌐 **i18n Support** - Chinese (zh/zh-tw), Japanese, English

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **AI**: xAI Grok API
- **Auth**: JWT + Telegram Bot
- **Styling**: Tailwind CSS
- **Deployment**: PM2 + Nginx

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token
- xAI API Key

### Installation

1. Clone the repository
```bash
git clone https://github.com/iam567/FLJopen.git
cd FLJopen
npm install
```

2. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. Set up the database
```bash
# Create database and run migrations
psql -U postgres -c "CREATE DATABASE fljdb;"
psql -U postgres -d fljdb -f schema.sql
```

4. Run development server
```bash
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
app/
├── api/          # API routes
├── admin/        # Admin dashboard
├── boom/         # Expose board
├── verify/       # Account verification
└── topup/        # Token top-up

lib/
├── db.ts         # Database connection
└── rank.ts       # User ranking logic
```

---

## 中文安装文档

### 环境要求

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot（通过 [@BotFather](https://t.me/BotFather) 创建）
- xAI API Key（用于 AI 分析）

### 安装步骤

**1. 克隆项目**
```bash
git clone https://github.com/iam567/FLJopen.git
cd FLJopen
npm install
```

**2. 配置环境变量**
```bash
cp .env.example .env.local
```

用文本编辑器打开 `.env.local`，填入以下信息：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=你的数据库用户名
DB_PASSWORD=你的数据库密码
DB_NAME=fljdb

# xAI API（用于账号分析）
XAI_API_KEY=你的xAI_API_Key

# Telegram Bot
TELEGRAM_BOT_TOKEN=你的Bot_Token
TELEGRAM_CHANNEL_ID=你的频道ID（用于会员验证）
TG_JWT_SECRET=随机字符串（自定义，用于JWT签名）

# 管理后台
JWT_SECRET=随机字符串（自定义，用于后台登录）
INTERNAL_REFRESH_SECRET=随机字符串

# Cloudflare Turnstile（防机器人，可选）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的站点Key
TURNSTILE_SECRET_KEY=你的密钥
```

**3. 初始化数据库**

```bash
# 创建数据库
psql -U postgres -c "CREATE USER fljuser WITH PASSWORD '你的密码';"
psql -U postgres -c "CREATE DATABASE fljdb OWNER fljuser;"
```

主要数据表（需手动创建）：
- `girls` - 账号信息表
- `comments` - 爆料/评论表
- `users` - 用户表（Telegram 用户）
- `comment_votes` - 投票记录表
- `site_events` - 站点统计表
- `reports` - 错误报告表
- `flj_topups` - 充值记录表
- `topup_quotes` - 充值报价表

**4. 启动开发服务器**
```bash
npm run dev
```

访问 `http://localhost:3000` 即可看到首页。

**5. 生产环境部署**

推荐使用 PM2 + Nginx：

```bash
# 构建
npm run build

# 使用 PM2 启动
pm2 start npm --name flj -- start -- -p 3001

# 设置开机自启
pm2 startup
pm2 save
```

Nginx 反向代理配置示例：
```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 图片上传目录直接由 Nginx 服务
    location /uploads/ {
        alias /var/www/flj/public/uploads/;
    }
}
```

### 管理后台

访问 `/admin` 进入管理后台，功能包括：
- 📊 数据统计看板
- 👥 用户管理（积分、等级、纪检委权限）
- 💬 爆料管理（折叠/恢复）
- 🖼️ 图片审核
- 📢 推广账号管理
- 💰 充值记录

### 常见问题

**Q: 图片上传后显示 404？**
A: 需要配置 Nginx 直接服务 `/uploads/` 目录，绕过 Next.js 缓存。

**Q: Telegram 登录不生效？**
A: 确认 Bot Token 正确，且 Bot 已加入对应频道并设为管理员。

**Q: AI 分析一直失败？**
A: 检查 `XAI_API_KEY` 是否有效，xAI 目前需要申请 API 访问权限。

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

## License

MIT
