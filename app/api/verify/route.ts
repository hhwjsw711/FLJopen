import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { checkReputation, calcScore, type Reputation } from '@/lib/grok'
import { fetchTwitterUser, type TwitterUser } from '@/lib/twitter'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
const CACHE_TTL_HOURS = 2160  // 90天兜底 TTL（主要靠搜索次数触发刷新）
const SEARCH_COUNT_REFRESH_INTERVAL = 100  // 每累计100次搜索触发一次 AI 刷新
const ALL_LANGS = ['zh', 'zh-tw', 'ja', 'en']
const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'
const INTERNAL_REFRESH_SECRET = process.env.INTERNAL_REFRESH_SECRET || 'process.env.INTERNAL_REFRESH_SECRET'

function verifyToken(req: NextRequest): { id: number; is_member?: boolean; points?: number } | null {
  const auth = req.headers.get('authorization')
  const token = auth?.split(' ')[1]
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    const id = payload.id || payload.tg_id || null
    if (!id) return null
    return { id, is_member: payload.is_member, points: payload.points }
  } catch { return null }
}

function getCooldown(tokenData: { is_member?: boolean; points?: number } | null): number {
  if (!tokenData) return 180  // 匿名
  if (tokenData.is_member) return 10  // 天龙人
  const p = tokenData.points ?? 0
  if (p >= 20000) return 10   // 副厅+
  if (p >= 10000) return 30   // 正处
  if (p >= 5000)  return 50   // 副处
  if (p >= 3000)  return 70   // 正科
  if (p >= 1000)  return 90   // 副科
  return 120                  // 居委会
}

// 过滤账号本人自辩句
const SELF_DEFENSE_PATTERNS = [
  /为什么我被认为/i, /なぜ私.*詐欺/i, /why (am|do) i.*scam/i,
  /我被认为是骗子/i, /私が詐欺師/i, /i am.*scammer/i,
  /\(context:/i,          // Grok 自行添加的 (context: ...) 总结注释
  /context:.*discussing/i,
  /\(translation:/i,      // Grok 翻译注释
  /\[translation/i,
]
function filterSelfDefense(examples: string[]): string[] {
  return (examples || []).filter(ex => !SELF_DEFENSE_PATTERNS.some(p => p.test(ex)))
}

// 各 complaint_type 对应的关键词 — 过滤后的例句里必须包含至少一个关键词，才保留该类型
const COMPLAINT_KEYWORDS: Record<string, RegExp> = {
  scam:          /骗钱|跑路|卷钱|詐欺|被骗|钱没了|付了|转账|汇款|scam|fraud|stole|took.*money|disappear|ブロック.*金|お金.*逃/i,
  impersonation: /冒充|假冒|なりすまし|impersonat|fake.*account|偽アカ/i,
}
// 若过滤后的例句不支持某 complaint_type，则移除该类型
function reconcileComplaintTypes(types: string[], examples: string[]): string[] {
  const filtered = filterSelfDefense(examples)
  return types.filter(t => {
    const kw = COMPLAINT_KEYWORDS[t]
    if (!kw) return true  // stolen_photo / fake_gender 无需例句支撑，保留
    // 必须有至少一条例句匹配关键词才保留
    return filtered.some(ex => kw.test(ex))
  })
}

// 后台静默刷新（fire-and-forget）
async function triggerBackgroundRefresh(username: string, lang: string, host: string) {
  try {
    await fetch(`${host}/api/verify?username=${encodeURIComponent(username)}&lang=${lang}&refresh=background`, {
      method: 'GET',
      headers: { 'x-internal-token': INTERNAL_REFRESH_SECRET },
    })
  } catch { /* 静默失败，不影响用户 */ }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawUsername = (searchParams.get('username') || '').replace('@', '').trim()
  if (!rawUsername) return NextResponse.json({ error: 'missing username' }, { status: 400 })
  if (/[^a-zA-Z0-9_]/.test(rawUsername)) return NextResponse.json({ error: 'invalid_username' }, { status: 400 })
  const username = rawUsername.toLowerCase()
  const lang = searchParams.get('lang') || 'zh'
  const forceRefresh = searchParams.get('refresh') === '1'
  const isBackgroundRefresh = searchParams.get('refresh') === 'background' &&
    req.headers.get('x-internal-token') === INTERNAL_REFRESH_SECRET

  // source=search：用户主动搜索，允许触发刷新；其他来源（排行榜点击）只读缓存
  const isSearchSource = searchParams.get('source') === 'search' || forceRefresh
  const tokenData = verifyToken(req)
  const tgUserId = tokenData?.id ?? null
  const isLoggedIn = !!tgUserId || isBackgroundRefresh

  const guestIp = (!isLoggedIn && !isBackgroundRefresh)
    ? (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown'
    : null

  // ── 频率控制与限额检查 ──
  const GUEST_DAILY_LIMIT = 5
  const MEMBER_DAILY_LIMIT = 100
  const COOLDOWN_SECONDS = getCooldown(tokenData)
  const GLOBAL_HOURLY_AI_LIMIT = 100 // 全站每小时最多允许 100 次新 AI 分析

  async function checkRateLimit(): Promise<{ allowed: boolean; error?: string; remaining?: number }> {
    // 1. 全站每小时硬上限检查（background refresh 也要参与计数，不豁免）
    const hourKey = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
    const globalRes = await pool.query(
      `INSERT INTO global_usage_stats (hour_key, ai_count) VALUES ($1, 1)
       ON CONFLICT (hour_key) DO UPDATE SET ai_count = global_usage_stats.ai_count + 1
       RETURNING ai_count`, [hourKey]
    )
    if (globalRes.rows[0].ai_count > GLOBAL_HOURLY_AI_LIMIT && !tgUserId) {
      await pool.query(`UPDATE global_usage_stats SET ai_count = ai_count - 1 WHERE hour_key = $1`, [hourKey])
      return { allowed: false, error: 'global_busy' }
    }

    // background refresh 只做全站限额检查，跳过用户级别限速
    if (isBackgroundRefresh) return { allowed: true }

    const today = new Date().toISOString().slice(0, 10)
    
    // 2. 先检查是否搜过相同账号（这种不算次数，也不触发冷却）
    const alreadyRes = tgUserId 
      ? await pool.query(`SELECT 1 FROM user_rate_limits WHERE tg_user_id = $1 AND date = $2 AND searched_usernames @> $3::jsonb`, [tgUserId, today, JSON.stringify([username])])
      : await pool.query(`SELECT 1 FROM ip_rate_limits WHERE ip = $1 AND date = $2 AND searched_usernames @> $3::jsonb`, [guestIp, today, JSON.stringify([username])])
    
    if (alreadyRes.rows.length > 0) return { allowed: true }

    // 2. 检查冷却时间
    const lastSearchRes = tgUserId
      ? await pool.query(`SELECT last_search_at FROM user_rate_limits WHERE tg_user_id = $1 ORDER BY last_search_at DESC LIMIT 1`, [tgUserId])
      : await pool.query(`SELECT last_search_at FROM ip_rate_limits WHERE ip = $1 ORDER BY last_search_at DESC LIMIT 1`, [guestIp])
    
    if (lastSearchRes.rows.length > 0 && lastSearchRes.rows[0].last_search_at) {
      const last = new Date(lastSearchRes.rows[0].last_search_at).getTime()
      const now = Date.now()
      const diff = Math.floor((now - last) / 1000)
      if (diff < COOLDOWN_SECONDS) {
        return { allowed: false, error: 'too_fast', remaining: COOLDOWN_SECONDS - diff }
      }
    }

    // 3. 检查每日限额并更新
    const limit = tgUserId ? MEMBER_DAILY_LIMIT : GUEST_DAILY_LIMIT
    const r = tgUserId
      ? await pool.query(
          `INSERT INTO user_rate_limits (tg_user_id, date, count, last_search_at, searched_usernames)
           VALUES ($1, $2, 1, NOW(), $3::jsonb)
           ON CONFLICT (tg_user_id, date) DO UPDATE SET 
             count = user_rate_limits.count + 1, 
             last_search_at = NOW(),
             searched_usernames = user_rate_limits.searched_usernames || $3::jsonb
           RETURNING count`, [tgUserId, today, JSON.stringify([username])])
      : await pool.query(
          `INSERT INTO ip_rate_limits (ip, date, count, last_search_at, searched_usernames)
           VALUES ($1, $2, 1, NOW(), $3::jsonb)
           ON CONFLICT (ip, date) DO UPDATE SET 
             count = ip_rate_limits.count + 1, 
             last_search_at = NOW(),
             searched_usernames = ip_rate_limits.searched_usernames || $3::jsonb
           RETURNING count`, [guestIp, today, JSON.stringify([username])])

    if (r.rows[0].count > limit) {
      if (tgUserId) {
        await pool.query(`UPDATE user_rate_limits SET count = count - 1 WHERE tg_user_id = $1 AND date = $2`, [tgUserId, today])
      } else {
        await pool.query(`UPDATE ip_rate_limits SET count = count - 1 WHERE ip = $1 AND date = $2`, [guestIp, today])
      }
      return { allowed: false, error: 'quota_exceeded' }
    }

    // 更新用户表的累计总次数
    if (tgUserId) {
      pool.query(`UPDATE users SET search_count = search_count + 1 WHERE id = $1`, [tgUserId]).catch(() => {})
    }

    return { allowed: true }
  }

  // ── 查询数据库，无论是否过期 ──
  if (!forceRefresh && !isBackgroundRefresh) {
    const cached = await pool.query(
      `SELECT *, cached_at < NOW() - INTERVAL '${CACHE_TTL_HOURS} hours' AS needs_refresh,
              is_restricted, restricted_message
       FROM girls WHERE twitter_username = $1`,
      [username]
    )

    // 限制曝光：直接返回受限信息，不做任何 AI 分析
    if (cached.rows.length > 0 && cached.rows[0].is_restricted) {
      return NextResponse.json({
        restricted: true,
        restricted_message: cached.rows[0].restricted_message || '该账号已申请限制曝光。',
        twitter_username: username,
      }, { headers: NO_CACHE })
    }
    if (cached.rows.length > 0) {
      const row = cached.rows[0]

      // 🔄 每累计 100 次搜索触发一次完整 AI 刷新（计数未 +1 时检查，+1 后是整百则触发）
      const newCount = (row.search_count || 0) + 1
      if (isSearchSource && newCount % SEARCH_COUNT_REFRESH_INTERVAL === 0) {
        // 先更新计数，然后走完整 AI 分析流程（直接 fall through，不 return）
        await pool.query(
          'UPDATE girls SET search_count = $1, last_searched_at = NOW() WHERE twitter_username = $2',
          [newCount, username]
        )
        // 跳出缓存逻辑，走下面的完整分析
      } else {

      const parse = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val) } catch { return [] }
        }
        return val
      }

      const sd = parse(row.score_detail) || {}
      const rowNegTags = parse(row.negative_tags)
      const rowPosTags = parse(row.positive_tags)
      const rowNegEx = parse(row.complaint_examples)
      const rowPosEx = parse(row.positive_examples)

      const finalMerged = {
        ...sd,
        is_fushi: row.is_fushi,
        is_offline: row.is_offline,
        has_threshold: row.has_threshold,
        active_cities: parse(row.active_cities),
        negative_tags: rowNegTags,
        positive_tags: rowPosTags,
        complaint_examples: rowNegEx,
        positive_examples: rowPosEx,
        is_welfare: row.is_welfare,
        gender: row.gender,
        account_language: row.account_language,
        display_name: row.display_name,
        bio: row.bio,
        avatar_url: row.avatar_url,
      }
      
      // 锁定账号直接用 DB 存的分数，不重算（保护管理员手动改分）
      const isLocked = !!row.is_locked
      const finalScore = isLocked ? (row.score ?? calcScore(20, finalMerged as Reputation)) : calcScore(20, finalMerged as Reputation)

      // 更新搜索计数与最新搜索时间（不阻塞返回）；锁定账号不覆盖分数
      if (!isBackgroundRefresh) {
        if (isLocked) {
          pool.query(
            'UPDATE girls SET search_count = search_count + 1, last_searched_at = NOW() WHERE twitter_username = $1',
            [username]
          ).catch(() => {})
        } else {
          pool.query(
            'UPDATE girls SET search_count = search_count + 1, score = $2, last_searched_at = NOW() WHERE twitter_username = $1',
            [username, finalScore]
          ).catch(() => {})
        }
      }

      // 缓存命中时，记录 TG 会员的今日搜索（用于后台统计）
      if (tgUserId && isSearchSource && !isBackgroundRefresh) {
        const today = new Date().toISOString().slice(0, 10)
        pool.query(
          `INSERT INTO user_rate_limits (tg_user_id, date, count, last_search_at, searched_usernames)
           VALUES ($1, $2, 1, NOW(), $3::jsonb)
           ON CONFLICT (tg_user_id, date) DO UPDATE SET
             count = user_rate_limits.count + 1,
             last_search_at = NOW(),
             searched_usernames = user_rate_limits.searched_usernames || $3::jsonb`,
          [tgUserId, today, JSON.stringify([username])]
        ).catch(() => {})
        pool.query(`UPDATE users SET search_count = search_count + 1 WHERE id = $1`, [tgUserId]).catch(() => {})
      }

      // 记录事件：缓存命中
      if (!isBackgroundRefresh) {
        const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim()
        pool.query(
          `INSERT INTO site_events (event_type, path, tg_user_id, ip) VALUES ($1, $2, $3, $4)`,
          ['search_cache', `/verify/${username}`, tgUserId, clientIp]
        ).catch(() => {})
      }

      // 仅当用户主动搜索（source=search）且超过14天时，才触发后台静默刷新
      if (row.needs_refresh && isSearchSource && !isBackgroundRefresh) {
        const host = req.headers.get('x-forwarded-host')
          ? `https://${req.headers.get('x-forwarded-host')}`
          : `http://localhost:${process.env.PORT || 3001}`
        triggerBackgroundRefresh(username, lang, host)
      }
      
      // 解析 i18n 翻译
      let i18n: any = {}
      try {
        i18n = (typeof row.user_eval_i18n === 'string') ? JSON.parse(row.user_eval_i18n) : (row.user_eval_i18n || {})
      } catch (e) { i18n = {} }

      const targetLang = (lang || 'zh').toLowerCase()
      // 优先级：请求的语言 -> JSON 里的中文 -> 数据库主字段 (已经同步为中文)
      let currentEval = i18n[targetLang] || i18n['zh'] || row.user_eval || ''

      // 调试：如果发现请求的是中文但拿到了英文（通过长度或特征判断），强制纠正
      if (targetLang === 'zh' && /^[a-zA-Z\s.,!?'"()]+$/.test(currentEval.slice(0, 50))) {
         currentEval = i18n['zh'] || row.user_eval || currentEval;
      }

      // 缺少目标语言时直接 fallback 到中文，不再调用 Gemini 补全翻译
      // （数据库中已有的旧翻译数据仍会正常使用，不会被清除）

      // 核心修复：不仅更新外层的 user_eval，还要更新 frontend 使用的 score_detail.detail
      const finalMergedWithI18n = {
        ...finalMerged,
        detail: currentEval
      }

      // 如果粉丝量/发帖量缺失，后台静默补充 Twitter 数据
      if (finalMerged.followers == null || finalMerged.tweets == null) {
        fetchTwitterUser(username).then(tw => {
          if (!tw) return
          const updatedDetail = {
            ...finalMerged,
            followers: tw.followers ?? finalMerged.followers,
            following: tw.following ?? finalMerged.following,
            tweets: tw.tweets ?? finalMerged.tweets,
            is_verified: tw.is_verified ?? finalMerged.is_verified,
            account_age_years: tw.account_age_years ?? finalMerged.account_age_years,
            display_name: tw.display_name || finalMerged.display_name,
            bio: tw.bio || finalMerged.bio,
            avatar_url: tw.avatar_url || finalMerged.avatar_url,
          }
          const newScore = calcScore(20, updatedDetail as any)
          pool.query(
            `UPDATE girls SET score_detail=$2, score=$3, display_name=$4, bio=$5, avatar_url=$6, updated_at=NOW() WHERE twitter_username=$1`,
            [username, JSON.stringify(updatedDetail), newScore, updatedDetail.display_name, updatedDetail.bio, updatedDetail.avatar_url]
          ).catch(() => {})
        }).catch(() => {})
      }

      return NextResponse.json({
        ...row,
        user_eval: currentEval,
        _debug: { req_lang: lang, target: targetLang, has_i18n_target: !!i18n[targetLang] },
        is_fushi: finalMerged.is_fushi,
        is_offline: finalMerged.is_offline,
        has_threshold: finalMerged.has_threshold,
        active_cities: finalMerged.active_cities,
        negative_tags: finalMerged.negative_tags,
        positive_tags: finalMerged.positive_tags,
        complaint_examples: finalMerged.complaint_examples,
        positive_examples: finalMerged.positive_examples,
        score: finalScore,
        score_detail: finalMergedWithI18n,
        // 顶层冗余输出，确保前端无论从哪里读都能拿到
        followers: finalMerged.followers ?? null,
        following: finalMerged.following ?? null,
        tweets: finalMerged.tweets ?? null,
        is_verified: finalMerged.is_verified ?? null,
        account_age_years: finalMerged.account_age_years ?? null,
        cached: true,
        needs_refresh: row.needs_refresh ?? false,
      }, { headers: NO_CACHE })
      } // end else（非整百次，返回缓存）
    }
  }

  // ── 缓存未命中 或 搜索次数达到整百次 → AI 分析 ──
  // 记录事件：新 AI 分析
  if (!isBackgroundRefresh) {
    const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim()
    pool.query(
      `INSERT INTO site_events (event_type, path, tg_user_id, ip) VALUES ($1, $2, $3, $4)`,
      ['search_ai', `/verify/${username}`, tgUserId, clientIp]
    ).catch(() => {})
  }

  const rateLimitStatus = await checkRateLimit()
  if (!rateLimitStatus.allowed) {
    return NextResponse.json(
      { error: rateLimitStatus.error, remaining: rateLimitStatus.remaining },
      { status: 429 }
    )
  }

  let rep: Reputation
  let twitterUser: TwitterUser | null = null
  try {
    // 1. 先用 Grok 做中文深度分析 + 获取 Twitter 用户基本信息
    const [repRes, twRes] = await Promise.all([
      checkReputation(username, 'zh'), // 固定用中文做主分析，最准确
      fetchTwitterUser(username)
    ])
    rep = repRes as Reputation
    twitterUser = twRes as TwitterUser | null
  } catch (e: any) {
    if (e?.code === 'grok_quota_exceeded') {
      return NextResponse.json({ error: 'grok_quota_exceeded' }, { status: 503 })
    }
    throw e
  }

  // 新分析只保存中文，不再调用 Gemini 翻译（旧数据中已有的多语言保留不变）
  // 读取数据库中已有的 i18n 数据（如果是 UPDATE 场景，保留旧翻译）
  const existingRow = await pool.query('SELECT user_eval_i18n FROM girls WHERE twitter_username = $1', [username])
  const existingI18n: Record<string, string> = (() => {
    try {
      const raw = existingRow.rows[0]?.user_eval_i18n
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) || {}
    } catch { return {} }
  })()

  const zhText = rep.detail || ''
  // 保留已有的多语言翻译，仅更新中文
  const i18nDetails: Record<string, string> = {
    ...existingI18n,   // 保留旧的 zh-tw / ja / en
    zh: zhText,        // 中文始终用最新分析结果覆盖
  }

  const merged = {
    ...rep,
    ...(twitterUser ? {
      followers: twitterUser.followers ?? rep.followers,
      following: twitterUser.following ?? rep.following,
      tweets: twitterUser.tweets ?? rep.tweets,
      is_verified: twitterUser.is_verified ?? rep.is_verified,
      display_name: twitterUser.display_name || rep.display_name,
      bio: twitterUser.bio || rep.bio,
      avatar_url: twitterUser.avatar_url || rep.avatar_url,
    } : {})
  }

  // 过滤自辩并验证证据门槛
  const finalComplaintEx = filterSelfDefense(merged.complaint_examples)
  const finalPositiveEx = filterSelfDefense(merged.positive_examples)
  const finalComplaintTypes = reconcileComplaintTypes(merged.complaint_types, finalComplaintEx)

  const finalMerged = {
    ...merged,
    complaint_examples: finalComplaintEx,
    positive_examples: finalPositiveEx,
    complaint_types: finalComplaintTypes,
  }

  const score = calcScore(20, finalMerged as Reputation)
  const tags = finalMerged.account_tags || []

  const r = await pool.query(
    `INSERT INTO girls (
       twitter_username, display_name, bio, avatar_url, score, score_detail,
       media_urls, account_language,
       is_fushi, is_offline, has_threshold, active_cities,
       negative_tags, positive_tags, content_tags,
       complaint_examples, positive_examples,
       user_eval, user_eval_i18n,
       cached_lang, cached_at, updated_at,
       gender, is_welfare, last_searched_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW(), $21, $22, NOW()
     )
     ON CONFLICT (twitter_username) DO UPDATE SET
       display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
       avatar_url = EXCLUDED.avatar_url, score = EXCLUDED.score,
       score_detail = EXCLUDED.score_detail, media_urls = EXCLUDED.media_urls,
       account_language = EXCLUDED.account_language,
       is_fushi = EXCLUDED.is_fushi, is_offline = EXCLUDED.is_offline,
       has_threshold = EXCLUDED.has_threshold, active_cities = EXCLUDED.active_cities,
       negative_tags = EXCLUDED.negative_tags, positive_tags = EXCLUDED.positive_tags,
       content_tags = EXCLUDED.content_tags,
       user_eval = EXCLUDED.user_eval, user_eval_i18n = EXCLUDED.user_eval_i18n,
       complaint_examples = EXCLUDED.complaint_examples,
       positive_examples = EXCLUDED.positive_examples,
       cached_lang = EXCLUDED.cached_lang, cached_at = NOW(), updated_at = NOW(),
       gender = EXCLUDED.gender, is_welfare = EXCLUDED.is_welfare,
       last_searched_at = NOW()
     RETURNING *`,
    [
      username, finalMerged.display_name || null, finalMerged.bio || null,
      finalMerged.avatar_url || null, score, JSON.stringify(finalMerged),
      JSON.stringify(rep.media_urls || []),
      finalMerged.primary_language || null,
      tags.includes('風俗業者'), tags.includes('可线下'), tags.includes('有门槛费'),
      JSON.stringify(((finalMerged as any).active_cities || []).filter((c: string) => c && c.length <= 5)),
      JSON.stringify(finalMerged.complaint_types || []),
      JSON.stringify(finalMerged.positive_types || []),
      (finalMerged as any).content_tags || [],
      JSON.stringify(finalMerged.complaint_examples || []),
      JSON.stringify(finalMerged.positive_examples || []),
      i18nDetails.zh,
      JSON.stringify(i18nDetails),
      lang,
      finalMerged.gender || 'unknown',
      finalMerged.is_welfare !== false
    ]
  )

  const finalRow = r.rows[0]

  // 🚫 自动限制：普通博主（无任何福利属性）首次分析后自动设 is_restricted
  const isRegularBlogger = (
    !finalRow.is_welfare &&
    !finalRow.is_fushi &&
    !finalRow.is_offline &&
    !finalRow.has_threshold &&
    finalRow.gender && finalRow.gender !== 'unknown'
  )
  if (isRegularBlogger && !finalRow.is_restricted) {
    await pool.query(
      `UPDATE girls SET is_restricted = true, restricted_message = $2 WHERE twitter_username = $1`,
      [username, '该账号为普通博主，非成人内容创作者，暂不支持本站收录与搜索。']
    )
    return NextResponse.json({
      restricted: true,
      restricted_message: '该账号为普通博主，非成人内容创作者，暂不支持本站收录与搜索。',
      twitter_username: username,
    }, { headers: NO_CACHE })
  }

  const currentEval = i18nDetails[lang] || i18nDetails.zh
  return NextResponse.json({ 
    ...finalRow, 
    user_eval: currentEval, 
    score_detail: {
      ...finalMerged,
      detail: currentEval
    },
    cached: false 
  })
}
