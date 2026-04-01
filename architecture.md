# FLJ 项目架构文档

> 供未来开发者快速理解项目结构与核心设计决策。

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [目录结构](#3-目录结构)
4. [核心模块](#4-核心模块)
5. [数据库设计](#5-数据库设计)
6. [认证与权限](#6-认证与权限)
7. [API 接口总览](#7-api-接口总览)
8. [关键业务流程](#8-关键业务流程)
9. [限流与配额策略](#9-限流与配额策略)
10. [国际化（i18n）](#10-国际化i18n)
11. [区块链集成](#11-区块链集成)
12. [部署架构](#12-部署架构)
13. [环境变量](#13-环境变量)

---

## 1. 项目概述

FLJ（福利鉴）是一个由社区驱动的 Twitter/X 账号信誉评估平台，主要面向中日两国市场。核心功能：

- **AI 信誉分析**：调用 xAI Grok API，对 Twitter 账号进行双轮分析（账号画像 + 社区口碑），输出 0–200 分的综合信任分
- **爆料板块**：用户可匿名提交真实经历，社区投票决定展示权重
- **积分排名**：基于搜索贡献、充值的积分体系，以「官员职级」命名的 9 档头衔
- **代币充值**：用户可通过 BSC 链上 FLJ 代币兑换搜索积分（区块链验证，无需第三方支付）
- **管理后台**：账号管理、图片审核、内容管理、数据统计

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端框架 | Next.js 14（App Router）+ React 18 | SSR / CSR 混合渲染 |
| 样式 | Tailwind CSS | 支持深色/浅色/黄色三套主题 |
| 后端 | Next.js API Routes（Node.js 18+） | 同构全栈，无独立后端服务 |
| 数据库 | PostgreSQL 14+ | 主存储，JSONB 存灵活元数据 |
| 主 AI | xAI Grok API | 账号分析，返回结构化 JSON |
| 辅助 AI | Google Gemini 1.5 Flash | 多语言翻译（可选） |
| 社交 API | Twitter API v2（Bearer Token） | 获取账号公开指标（可选） |
| 认证 | JWT + Telegram Bot OAuth | 用户登录与频道会员验证 |
| 安全 | Cloudflare Turnstile | 匿名用户的机器人防护 |
| 区块链 | BSC（币安智能链）RPC | FLJ 代币交易验证 |
| 进程管理 | PM2 | 生产环境进程守护 |
| 反向代理 | Nginx | 端口转发 + 静态图片直出 |

---

## 3. 目录结构

```
FLJopen/
├── app/                    # Next.js App Router（页面 + API）
│   ├── api/                # 后端 API 路由（约 39 个端点）
│   │   ├── admin/          # 管理后台接口
│   │   ├── auth/           # Telegram 登录
│   │   ├── boom/           # 爆料板块接口
│   │   ├── comments/       # 评论接口
│   │   ├── expose/         # 爆料提交与投票
│   │   ├── rankings/       # 排行榜
│   │   ├── topup/          # 区块链充值
│   │   ├── upload/         # 图片上传
│   │   ├── user/           # 用户信息
│   │   ├── verify/         # 核心：账号验证（Grok）
│   │   ├── verify-byok/    # BYOK 自助验证
│   │   └── vote/           # 账号可信/诈骗投票
│   │
│   ├── Pages/              # 前端页面
│   │   ├── page.tsx        # 首页（搜索 + 排行榜）
│   │   ├── verify/[username]/ # 账号详情页
│   │   ├── boom/           # 爆料页
│   │   ├── rankings/       # 排行榜页
│   │   ├── city/[city]/    # 城市榜
│   │   ├── topup/          # 充值页
│   │   ├── byok/           # 自助搜索页
│   │   └── admin/          # 管理后台页面
│   │
│   └── layout.tsx          # 根布局（主题 / 语言初始化）
│
├── lib/                    # 核心业务逻辑
│   ├── db.ts               # PostgreSQL 连接池
│   ├── grok.ts             # xAI Grok 集成（分析引擎）
│   ├── gemini.ts           # Google Gemini 集成（翻译）
│   ├── twitter.ts          # Twitter API v2 集成
│   ├── rank.ts             # 积分等级定义
│   ├── i18n.ts             # 多语言文本
│   ├── themes.ts           # 主题色定义
│   └── apiUrl.ts           # 镜像站 basePath 工具
│
├── public/
│   └── uploads/            # 爆料图片存储目录
│
├── scripts/                # 工具脚本
├── schema.sql              # 数据库建表脚本（15 张表 + 索引）
├── deploy-mirror.sh        # 镜像站部署脚本
├── deploy-promote.sh       # 生产部署脚本
├── .env.example            # 环境变量模板
└── next.config.mjs         # Next.js 配置
```

---

## 4. 核心模块

### 4.1 分析引擎（`lib/grok.ts`）

项目最核心的模块，负责驱动 AI 信誉分析。

**两轮并行调用 Grok：**

| 轮次 | 目标 | 输出字段 |
|---|---|---|
| 第一轮 | 账号画像 | display_name, bio, followers, is_verified, primary_language, active_cities, account_tags, content_tags, gender, is_welfare, using_proxy 等 |
| 第二轮 | 社区口碑 | complaints（含类型、示例）, positives（含类型、示例）|

**评分算法（`calcScore`，满分 200）：**

| 加分项 | 分值 |
|---|---|
| 账号年龄 | +3/年，上限 25 |
| 粉丝数 | log 缩放，上限 20 |
| 推文数 | log 缩放，上限 8 |
| 官方认证蓝标 | +10 |
| 近期活跃 | +5 |
| 互动率（高/中/低） | +8 / +4 / 0 |
| 正面口碑 | +10 |
| 手动认证 | +30 |

| 扣分项 | 分值 |
|---|---|
| 每条投诉 | -8 |
| 诈骗 (scam) | -20 |
| 假冒 (impersonation) | -20 |
| 疑似 VPN/代理 | -5 |
| 置顶推文含外链 | -10 |

**自动限制：** 若账号被识别为非福利类普通博主，自动标记为 `is_restricted = true`，不展示详细分析内容。

**账号标签（account_tags）：** 风俗業者、可线下、有门槛费、AV女優、福利博主

**内容标签（content_tags）：** 巨乳、童颜、御姐、萝莉、美腿、黑丝、不露脸等 18 类

---

### 4.2 验证端点（`app/api/verify/route.ts`）

整个系统的主干请求路径，顺序如下：

```
输入校验（用户名格式）
  ↓
限流检查（全局/用户/IP）
  ↓
缓存查询（PostgreSQL girls 表）
  ├─ 缓存有效（< 90 天）→ 直接返回 + 假进度动画
  │       └─ 搜索次数为 100 的倍数时触发后台静默刷新
  └─ 无缓存或已过期
         ↓
    并行调用 Grok（画像 + 口碑）+ Twitter API（可选）
         ↓
    后处理（过滤自辩声明、验证投诉类型）
         ↓
    计算信任分
         ↓
    非福利账号？→ 自动限制
         ↓
    写入 girls 表（UPSERT）
         ↓
    写入 site_events（统计）
         ↓
    返回结果
```

**响应数据结构：**

```typescript
{
  score: number,           // 0–200
  cached: boolean,
  needs_refresh: boolean,
  score_detail: {
    display_name, bio, avatar_url,
    followers, following, tweets,
    is_verified, is_active, engagement,
    account_tags, content_tags,
    complaint_types, complaint_examples,
    positive_types, positive_examples,
    primary_language, active_cities,
    gender, is_welfare, using_proxy,
    pinned_tweet_has_url, is_manual_verified,
    detail: string          // AI 生成的评估描述
  }
}
```

---

### 4.3 爆料系统（`api/boom/` + `api/expose/`）

**爆料分类：** 日常爆料、被骗经历、门槛爆料、同行互撕、金主哭诉

**图片处理：** 上传时自动压缩至 800px，存储至 `/public/uploads/`，状态字段 `images_status`（pending / approved / rejected）

**排序算法：** 最新、热门（按用户等级加权）、争议（高投票分歧）

**自动折叠规则：** 反对票 > 10 且赞同票 < 100 时自动折叠

**天龙人特权：** 天龙人用户发布的爆料直接显示，无需等待图片审核

---

### 4.4 积分与排名（`lib/rank.ts` + `api/rankings/`）

**用户积分头衔（9 档）：**

| 积分门槛 | 头衔 |
|---|---|
| 500,000+ | 正部 |
| 100,000+ | 副部 |
| 50,000+ | 正厅 |
| 20,000+ | 副厅 |
| 10,000+ | 正处 |
| 5,000+ | 副处 |
| 3,000+ | 正科 |
| 1,000+ | 副科 |
| < 1,000 | 居委会 |

**账号排行榜分类：** 信任账号（分数 ≥ 60）、已认证、可线下、有门槛费

---

### 4.5 代币充值（`api/topup/`）

详见 [第 11 节：区块链集成](#11-区块链集成)。

---

## 5. 数据库设计

连接池配置：最大 10 个连接，空闲超时 30 秒（`lib/db.ts`）。

### 初始化

完整建表脚本位于 `schema.sql`，包含 15 张表的 DDL、索引及默认数据，可直接导入：

```bash
psql -U fljuser -d fljdb -f schema.sql
```

脚本全部使用 `CREATE TABLE IF NOT EXISTS`，可安全重复执行（幂等）。

### 数据表总览

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `girls` | 账号分析结果缓存 | `twitter_username`(UNIQUE), `score`, `score_detail`(JSONB), `complaint_examples`(JSONB), `positive_examples`(JSONB), `cached_at`, `is_restricted`, `is_manual_verified` |
| `users` | Telegram 用户信息 | `telegram_id`(UNIQUE), `points`, `is_member`, `is_moderator`, `search_count` |
| `comments` | 评论与爆料 | `twitter_username`, `is_expose`, `images_status`, `upvotes`, `downvotes`, `is_collapsed`, `expose_category` |
| `comment_votes` | 爆料投票记录（防重复） | `comment_id`, `voter_ip`(UNIQUE 组合), `vote`, `weight` |
| `user_votes` | 账号可信/诈骗投票（防重复） | `tg_user_id`, `twitter_username`(UNIQUE 组合), `vote` |
| `site_events` | 站点行为日志 | `event_type`(pv/search_ai/search_cache), `ip`, `tg_user_id`, `created_at` |
| `reports` | 用户数据纠错报告 | `twitter_username`, `reporter_ip`, `status`(pending/resolved/dismissed) |
| `flj_topups` | 区块链充值记录 | `tx_hash`(UNIQUE), `tg_user_id`, `flj_amount`, `points_granted` |
| `topup_quotes` | 充值报价单（15 分钟有效） | `tg_user_id`, `flj_needed`, `expires_at`, `used` |
| `global_usage_stats` | 全局每小时 AI 调用量 | `hour_key`(PK，格式 `YYYY-MM-DDTHH`), `ai_count` |
| `user_rate_limits` | 用户每日搜索限额 | `tg_user_id + date`(复合 PK), `count`, `last_search_at` |
| `ip_rate_limits` | IP 每日搜索限额 | `ip + date`(复合 PK), `count`, `last_search_at` |
| `active_sessions` | 活跃会话追踪（在线人数） | `id`(PK), `last_seen` |
| `site_settings` | 全局配置键值对 | `key`(PK), `value` |
| `admin_users` | 管理员账户 | `email`(UNIQUE), `password_hash`(bcrypt) |

### JSONB 字段说明

| 表.字段 | 内容 |
|---|---|
| `girls.score_detail` | AI 分析完整结果（followers, complaint_types, positive_examples, engagement 等） |
| `girls.user_eval_i18n` | 多语言评估文案 `{zh, zh-tw, ja, en}`，避免重复调用 Gemini |
| `girls.negative_tags` | 负面标签数组，如 `["scam", "impersonation"]`，支持 GIN 索引过滤 |
| `girls.positive_tags` | 正面标签数组，如 `["recommended", "verified_real"]` |
| `girls.active_cities` | 活跃城市数组，如 `["东京", "大阪"]`，支持 GIN 索引过滤 |
| `user_rate_limits.searched_usernames` | 当日已搜索的用户名列表，用于判断是否命中缓存 |

### 管理员账户初始化

`schema.sql` 不预置管理员，需手动插入（密码须先用 bcrypt 哈希）：

```bash
# 生成密码哈希
node -e "require('bcryptjs').hash('你的密码', 10).then(h => console.log(h))"

# 插入管理员
psql -U fljuser -d fljdb -c \
  "INSERT INTO admin_users (email, password_hash) VALUES ('admin@example.com', '上面的哈希值');"
```

---

## 6. 认证与权限

### 用户三级体系

| 级别 | 名称 | 认证方式 | 特权 |
|---|---|---|---|
| 天龙人 | 高级会员 | Telegram + 指定频道会员 | 最短冷却、爆料直显 |
| 居委会 | 普通用户 | Telegram 登录 | 基础功能 |
| 匿名 | 游客 | 无 | 每日 5 次搜索，爆料需审核 |

**Telegram 验证流程：**

1. 前端调用 Telegram Login Widget，回调至 `/api/auth/telegram`
2. 服务端用 `TELEGRAM_BOT_TOKEN` 的 SHA-256 HMAC 验证数据完整性
3. 调用 Telegram Bot API 检查用户是否在指定频道
4. 签发 JWT（有效期 7 天），存入 cookie

**管理员认证：** 独立 JWT 体系，通过 `JWT_SECRET` 签发，需 Bearer Token 头部。

**版主权限：** `users.is_moderator = true`，可进行图片审核与爆料管理，但无法访问敏感统计。

---

## 7. API 接口总览

### 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/verify` | 账号 AI 分析（主接口）|
| GET | `/api/verify-byok` | BYOK 自助分析 |
| GET | `/api/search` | 账号搜索 |
| GET | `/api/boom` | 爆料列表 |
| POST | `/api/expose` | 提交爆料 |
| POST | `/api/expose/vote` | 爆料投票 |
| GET | `/api/comments` | 获取账号评论 |
| POST | `/api/comments` | 发布评论 |
| GET/POST | `/api/vote` | 账号可信/诈骗投票 |
| GET | `/api/rankings/overview` | 排行榜概览 |
| GET | `/api/rankings` | 城市排行 |
| GET | `/api/rankings/cities` | 城市列表 |
| GET/POST | `/api/topup` | 充值查询 / 验证交易 |
| GET | `/api/topup/quote` | 获取充值报价 |
| POST | `/api/auth/telegram` | Telegram 登录 |
| GET | `/api/user/me` | 获取当前用户信息 |
| POST | `/api/upload` | 上传爆料图片 |
| POST | `/api/stats/pv` | 页面浏览统计 |
| POST | `/api/report` | 提交数据纠错 |
| POST | `/api/feedback` | 提交 UI 反馈 |

### 管理接口（需 Admin JWT）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/dashboard` | 数据概览 |
| GET/POST | `/api/admin/users` | 用户管理 |
| POST | `/api/admin/users/moderator` | 设置版主 |
| GET | `/api/admin/comments` | 爆料管理 |
| POST | `/api/admin/collapse` | 折叠/恢复爆料 |
| GET/POST | `/api/admin/images` | 图片审核 |
| GET/POST | `/api/admin/girls` | 账号管理（锁分/限制）|
| GET/POST | `/api/admin/promotions` | 推荐账号管理 |
| GET | `/api/admin/topups` | 充值记录 |
| GET | `/api/admin/reports` | 纠错报告 |
| POST | `/api/admin/settings` | 全局配置 |
| GET | `/api/admin/usage` | API 配额监控 |

---

## 8. 关键业务流程

### 8.1 账号搜索与缓存

```
用户搜索 username
  ↓
限流校验（全局每小时 100 次新分析上限）
  ↓
查询 girls 表
  ├─ 有效缓存（< 90 天）→ 直接返回，前端模拟进度动画
  │         ↓（异步）每 100 次搜索静默刷新一次
  └─ 无缓存 → 并行调用 Grok（画像轮 + 口碑轮）
                ↓
           可选：Twitter API 补充真实粉丝数
                ↓
           后处理 + 评分计算
                ↓
           UPSERT 写入 girls 表
                ↓
           返回结果
```

### 8.2 爆料提交与展示

```
用户提交爆料（含可选图片）
  ↓
身份验证（天龙人/普通用户/匿名）
  ↓
图片压缩存储，images_status = 'pending'
  ↓
写入 comments 表（is_expose = true）
  ↓
天龙人？→ 直接展示
普通/匿名？→ 等待管理员审核图片
  ↓
社区投票（每人限投一次）
  ↓
反对 > 10 且赞同 < 100 → 自动折叠
```

### 8.3 区块链充值

```
用户选择充值档位
  ↓
获取 DexScreener 实时 FLJ/USDT 价格
生成报价单（15 分钟有效）
  ↓
用户在 BSC 链上转账 FLJ 至平台钱包
  ↓
用户提交 tx_hash
  ↓
后端查询 BSC RPC（eth_getTransactionByHash）
验证：接收方 ✓、代币合约 ✓、金额（±20%容差）✓、tx 唯一性 ✓
  ↓
数据库事务：users.points += 档位积分
写入 flj_topups 记录
标记报价单已使用
  ↓
返回充值结果
```

---

## 9. 限流与配额策略

**全局限制：** `global_usage_stats` 表记录每小时新 AI 分析次数，上限 100 次/小时，超限返回 503。

**用户/IP 每日搜索配额：**

| 用户层级 | 每日上限 |
|---|---|
| 匿名 | 5 次 |
| 居委会及以上 | 100 次 |
| 天龙人 | 100 次 |

**搜索冷却时间（按积分档位）：**

| 积分 | 冷却 |
|---|---|
| < 1,000 | 120 秒 |
| 1,000–4,999 | 90 秒 |
| 5,000–9,999 | 50 秒 |
| 10,000–19,999 | 30 秒 |
| 20,000+ | 10 秒 |
| 天龙人 | 10 秒 |

---

## 10. 国际化（i18n）

**支持语言：** 简体中文（默认）、繁體中文、日本語、English

**实现方案：**

- AI 分析以中文存储于数据库（`score_detail.detail`）
- 需要其他语言时调用 Gemini 翻译，结果缓存至 `girls.user_eval_i18n` JSONB 字段
- UI 文案统一维护在 `lib/i18n.ts` 的 `T` 对象中
- 语言选择通过 URL 参数 `?lang=ja` 或 localStorage 持久化

---

## 11. 区块链集成

**代币：** FLJ（BEP-20，Binance Smart Chain）

**充值档位：**

| 图标 | 档位名 | 美元 | 积分 |
|---|---|---|---|
| ☕ | 入门 | $1 | 1,000 |
| 🍜 | 进阶 | $3 | 3,200 |
| 🍣 | 高级 | $6 | 5,500 |
| 🚀 | 精英 | $12 | 10,500 |
| 💎 | 铂金 | $25 | 21,000 |

**验证逻辑（`api/topup/route.ts`）：**

1. 调用 BSC RPC `eth_getTransactionByHash` 获取交易详情
2. 校验 `to` 地址为平台钱包（`FLJ_WALLET_ADDRESS`）
3. 校验 input data 中的代币合约为 FLJ（`FLJ_CONTRACT_ADDRESS`）
4. 校验转账金额在报价 ±20% 范围内
5. 检查 `flj_topups` 表中 tx_hash 唯一性（防止重复提交）

---

## 12. 部署架构

### 推荐方案：PM2 + Nginx

```
互联网
  ↓
Nginx（80/443 端口）
  ├─ / → proxy_pass http://localhost:3001（Next.js）
  └─ /uploads/ → alias /var/www/flj/public/uploads/（静态图片直出，绕过 Next.js）
       ↓
PM2 管理的 Next.js 进程（端口 3001）
       ↓
PostgreSQL（本地或远程）
```

**PM2 启动命令：**

```bash
pm2 start npm --name flj -- start -- -p 3001
pm2 startup && pm2 save
```

**Nginx 关键配置：**

```nginx
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# 上传图片静态直出，避免经过 Next.js
location /uploads/ {
    alias /var/www/flj/public/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 镜像站部署

通过 `deploy-mirror.sh` 部署，Next.js 以 `NEXT_PUBLIC_BASE_PATH=/mirror` 模式构建，所有路由自动加前缀。

---

## 13. 环境变量

完整模板见 `.env.example`，以下为分组说明：

### 数据库（必填）

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=fljuser
DB_PASSWORD=your_password
DB_NAME=fljdb
```

### AI 服务

```env
XAI_API_KEY=your_xai_key          # 必填，核心分析功能依赖
GEMINI_API_KEY=your_gemini_key    # 可选，不填则禁用多语言翻译
TWITTER_BEARER_TOKEN=your_token   # 可选，不填则仅使用 Grok 数据
```

### Telegram 认证（必填）

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id   # 天龙人会员频道 ID
TG_JWT_SECRET=random_secret_string    # 用户 JWT 签名密钥
JWT_SECRET=admin_jwt_secret           # 管理员 JWT 签名密钥
INTERNAL_REFRESH_SECRET=secret        # 后台静默刷新鉴权密钥
```

### 安全（建议配置）

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
```

### 区块链（启用充值功能时必填）

```env
FLJ_CONTRACT_ADDRESS=0x...   # BSC 上 FLJ 代币合约地址
FLJ_WALLET_ADDRESS=0x...     # 平台收款钱包地址
BSCSCAN_API_KEY=optional     # BscScan API Key（备用验证）
```

### 其他

```env
PORT=3001                        # Next.js 监听端口
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/mirror    # 仅镜像站需要配置
```

---

*文档最后更新：2026-03-31*
