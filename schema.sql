-- FLJ Database Schema
-- 由代码反推生成，覆盖 15 张主要数据表
-- PostgreSQL 14+

-- ============================================================
-- 1. girls - 账号分析结果缓存
-- ============================================================
CREATE TABLE IF NOT EXISTS girls (
  id                  SERIAL PRIMARY KEY,
  twitter_username    VARCHAR NOT NULL UNIQUE,
  display_name        VARCHAR,
  bio                 TEXT,
  avatar_url          VARCHAR,
  score               INT,
  score_detail        JSONB NOT NULL DEFAULT '{}',
  media_urls          JSONB NOT NULL DEFAULT '[]',
  account_language    VARCHAR,
  gender              VARCHAR NOT NULL DEFAULT 'unknown',
  is_welfare          BOOLEAN NOT NULL DEFAULT true,
  is_fushi            BOOLEAN NOT NULL DEFAULT false,
  is_offline          BOOLEAN NOT NULL DEFAULT false,
  has_threshold       BOOLEAN NOT NULL DEFAULT false,
  active_cities       JSONB NOT NULL DEFAULT '[]',
  negative_tags       JSONB NOT NULL DEFAULT '[]',
  positive_tags       JSONB NOT NULL DEFAULT '[]',
  content_tags        TEXT[],
  complaint_examples  JSONB NOT NULL DEFAULT '[]',
  positive_examples   JSONB NOT NULL DEFAULT '[]',
  user_eval           TEXT,
  user_eval_i18n      JSONB NOT NULL DEFAULT '{}',
  likes               INT DEFAULT 0,
  dislikes            INT DEFAULT 0,
  search_count        INT DEFAULT 0,
  is_locked           BOOLEAN NOT NULL DEFAULT false,
  is_manual_verified  BOOLEAN NOT NULL DEFAULT false,
  is_restricted       BOOLEAN NOT NULL DEFAULT false,
  restricted_message  VARCHAR,
  is_promoted         BOOLEAN NOT NULL DEFAULT false,
  status              VARCHAR DEFAULT 'active',
  city                VARCHAR,
  cached_lang         VARCHAR,
  cached_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  last_searched_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_girls_score             ON girls(score DESC);
CREATE INDEX IF NOT EXISTS idx_girls_restricted        ON girls(is_restricted, gender, is_welfare);
CREATE INDEX IF NOT EXISTS idx_girls_created_at        ON girls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_girls_cached_at         ON girls(cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_girls_last_searched_at  ON girls(last_searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_girls_negative_tags     ON girls USING GIN(negative_tags);
CREATE INDEX IF NOT EXISTS idx_girls_positive_tags     ON girls USING GIN(positive_tags);
CREATE INDEX IF NOT EXISTS idx_girls_active_cities     ON girls USING GIN(active_cities);
CREATE INDEX IF NOT EXISTS idx_girls_score_detail      ON girls USING GIN(score_detail);

-- ============================================================
-- 2. users - Telegram 用户
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT NOT NULL UNIQUE,
  username     VARCHAR,
  first_name   VARCHAR,
  photo_url    VARCHAR,
  points       INT NOT NULL DEFAULT 100,
  is_member    BOOLEAN NOT NULL DEFAULT false,
  is_moderator BOOLEAN NOT NULL DEFAULT false,
  search_count INT DEFAULT 0,
  last_login   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_points     ON users(points DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_member  ON users(is_member);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- ============================================================
-- 3. comments - 评论与爆料
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id                 SERIAL PRIMARY KEY,
  twitter_username   VARCHAR NOT NULL,
  user_id            VARCHAR,
  user_name          VARCHAR,
  user_avatar        VARCHAR,
  content            TEXT NOT NULL,
  is_expose          BOOLEAN NOT NULL DEFAULT false,
  reporter_ip        VARCHAR,
  user_tier          VARCHAR DEFAULT 'anonymous',
  tg_user_id         BIGINT,
  image_urls         TEXT[] DEFAULT '{}',
  images_status      VARCHAR DEFAULT 'pending',
  expose_category    VARCHAR DEFAULT '日常爆料',
  upvotes            INT DEFAULT 0,
  downvotes          INT DEFAULT 0,
  is_collapsed       BOOLEAN NOT NULL DEFAULT false,
  points_granted_100 BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_username      ON comments(LOWER(twitter_username), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_expose        ON comments(is_expose, is_collapsed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_tier     ON comments(user_tier);
CREATE INDEX IF NOT EXISTS idx_comments_images_status ON comments(images_status);
CREATE INDEX IF NOT EXISTS idx_comments_tg_user_id    ON comments(tg_user_id);

-- ============================================================
-- 4. comment_votes - 爆料投票记录（防重复投票）
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_votes (
  id         SERIAL PRIMARY KEY,
  comment_id INT NOT NULL,
  voter_ip   VARCHAR NOT NULL,
  vote       SMALLINT NOT NULL,
  weight     INT DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, voter_ip)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);

-- ============================================================
-- 5. user_votes - 账号可信/诈骗投票（防重复投票）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_votes (
  id               SERIAL PRIMARY KEY,
  tg_user_id       BIGINT NOT NULL,
  twitter_username VARCHAR NOT NULL,
  vote             SMALLINT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tg_user_id, twitter_username)
);

CREATE INDEX IF NOT EXISTS idx_user_votes_username ON user_votes(twitter_username);

-- ============================================================
-- 6. site_events - 站点行为日志（PV、搜索等）
-- ============================================================
CREATE TABLE IF NOT EXISTS site_events (
  id         SERIAL PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  path       VARCHAR,
  tg_user_id BIGINT,
  ip         VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_events_type_time ON site_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_events_tg_user   ON site_events(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_site_events_ip        ON site_events(ip);

-- ============================================================
-- 7. reports - 用户数据纠错报告
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id               SERIAL PRIMARY KEY,
  twitter_username VARCHAR NOT NULL,
  reason           TEXT NOT NULL,
  reporter_ip      VARCHAR NOT NULL,
  reporter_tg_id   VARCHAR,
  status           VARCHAR DEFAULT 'pending',
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_username ON reports(twitter_username);
CREATE INDEX IF NOT EXISTS idx_reports_ip       ON reports(reporter_ip, created_at DESC);

-- ============================================================
-- 8. flj_topups - 区块链充值记录
-- ============================================================
CREATE TABLE IF NOT EXISTS flj_topups (
  id             SERIAL PRIMARY KEY,
  tg_user_id     VARCHAR NOT NULL,
  tx_hash        VARCHAR NOT NULL UNIQUE,
  flj_amount     DECIMAL(20, 8) NOT NULL,
  usdt_value     DECIMAL(10, 2) NOT NULL,
  points_granted INT NOT NULL,
  tier_label     VARCHAR NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flj_topups_user       ON flj_topups(tg_user_id);
CREATE INDEX IF NOT EXISTS idx_flj_topups_created_at ON flj_topups(created_at DESC);

-- ============================================================
-- 9. topup_quotes - 充值报价单（15 分钟有效）
-- ============================================================
CREATE TABLE IF NOT EXISTS topup_quotes (
  id         SERIAL PRIMARY KEY,
  tg_user_id VARCHAR NOT NULL,
  tier_index INT NOT NULL,
  tier_label VARCHAR NOT NULL,
  flj_needed INT NOT NULL,
  price_usd  DECIMAL(10, 4) NOT NULL,
  usd_value  DECIMAL(10, 2) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_quotes_user ON topup_quotes(tg_user_id, expires_at DESC);

-- ============================================================
-- 10. global_usage_stats - 全局每小时 AI 调用量
-- ============================================================
CREATE TABLE IF NOT EXISTS global_usage_stats (
  hour_key VARCHAR PRIMARY KEY,
  ai_count INT DEFAULT 0
);

-- ============================================================
-- 11. user_rate_limits - 用户每日搜索限额
-- ============================================================
CREATE TABLE IF NOT EXISTS user_rate_limits (
  tg_user_id         BIGINT NOT NULL,
  date               DATE NOT NULL,
  count              INT DEFAULT 0,
  last_search_at     TIMESTAMP,
  searched_usernames JSONB DEFAULT '[]',
  PRIMARY KEY(tg_user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_rate_limits_date ON user_rate_limits(date DESC);

-- ============================================================
-- 12. ip_rate_limits - IP 每日搜索限额
-- ============================================================
CREATE TABLE IF NOT EXISTS ip_rate_limits (
  ip                 VARCHAR NOT NULL,
  date               DATE NOT NULL,
  count              INT DEFAULT 0,
  last_search_at     TIMESTAMP,
  searched_usernames JSONB DEFAULT '[]',
  PRIMARY KEY(ip, date)
);

CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_date ON ip_rate_limits(date DESC);

-- ============================================================
-- 13. active_sessions - 活跃会话追踪（在线人数统计）
-- ============================================================
CREATE TABLE IF NOT EXISTS active_sessions (
  id        VARCHAR PRIMARY KEY,
  last_seen TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen ON active_sessions(last_seen DESC);

-- ============================================================
-- 14. site_settings - 全局配置
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初始化默认配置
INSERT INTO site_settings (key, value) VALUES
  ('search_duration_min', '10'),
  ('search_duration_max', '20')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 15. admin_users - 管理员账户
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 初始管理员账户
-- 密码需在应用层用 bcrypt 生成后手动插入，示例：
--   INSERT INTO admin_users (email, password_hash) VALUES ('admin@example.com', '$2b$10$...');
-- ============================================================
