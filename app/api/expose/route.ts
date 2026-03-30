import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const DAILY_LIMIT = 5
const MIN_LENGTH  = 10
const JWT_SECRET  = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

function getTgUser(req: NextRequest): { id: string; username?: string; is_member?: boolean } | null {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return null
    return jwt.verify(token, JWT_SECRET) as any
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown'
  const { twitter_username, content, _hp, _t, image_urls, expose_category } = await req.json()
  const VALID_CATEGORIES = ['日常爆料', '被骗经历', '门槛爆料', '同行互撕', '金主哭诉']
  const category = VALID_CATEGORIES.includes(expose_category) ? expose_category : '日常爆料'

  // 🍯 蜜罐
  if (_hp && _hp.length > 0)
    return NextResponse.json({ error: '提交失败' }, { status: 400 })

  // ⏱ 速度检测
  if (typeof _t === 'number' && _t < 2000)
    return NextResponse.json({ error: '提交太快了，请再试一次' }, { status: 400 })

  if (!twitter_username) return NextResponse.json({ error: '缺少账号' }, { status: 400 })
  if (!content || content.trim().length < MIN_LENGTH)
    return NextResponse.json({ error: `内容至少 ${MIN_LENGTH} 个字` }, { status: 400 })

  // 🔍 检查账号是否在福利鉴数据库中
  const girlCheck = await pool.query(
    `SELECT gender, is_welfare FROM girls WHERE twitter_username = $1`,
    [twitter_username.toLowerCase()]
  )
  if (girlCheck.rows.length === 0) {
    return NextResponse.json({ error: '该账号尚未被收录，爆料广场仅支持已收录的福利姬账号。可先在首页搜索该账号使其入库。' }, { status: 400 })
  }
  const girl = girlCheck.rows[0]
  if (girl.gender === 'male') {
    return NextResponse.json({ error: '爆料广场仅限女性/不明性别账号，不支持爆料男性用户。' }, { status: 400 })
  }

  // 🧹 内容质量过滤
  const cleaned = content.trim().replace(/\s+/g, '')
  const uniqueChars = new Set(cleaned).size
  if (uniqueChars < 3)
    return NextResponse.json({ error: '内容无效，请描述具体经历' }, { status: 400 })

  // 获取用户身份（三层：member / tg_user / anonymous）
  const tgUser = getTgUser(req)
  const userTier = !tgUser ? 'anonymous' : tgUser.is_member ? 'member' : 'tg_user'
  const tgUserId = tgUser?.id || null

  // 每日限速：会员用 tg_user_id 计数，匿名用 IP
  if (tgUserId) {
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM comments WHERE tg_user_id = $1 AND is_expose = true
       AND created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Tokyo'`,
      [tgUserId]
    )
    if (parseInt(countRes.rows[0].count) >= DAILY_LIMIT) {
      return NextResponse.json({ error: `每天最多爆料 ${DAILY_LIMIT} 次，明天再来` }, { status: 429 })
    }
  } else {
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM comments WHERE reporter_ip = $1 AND is_expose = true
       AND created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Tokyo'`,
      [ip]
    )
    if (parseInt(countRes.rows[0].count) >= DAILY_LIMIT) {
      return NextResponse.json({ error: `每天最多爆料 ${DAILY_LIMIT} 次，明天再来` }, { status: 429 })
    }
  }

  // tg_user 积分检查：不足 50 分不能发布
  if (userTier === 'tg_user' && tgUserId) {
    const ptRes = await pool.query('SELECT points FROM users WHERE telegram_id = $1', [tgUserId])
    const pts = ptRes.rows[0]?.points ?? 0
    if (pts < 50) {
      return NextResponse.json({ error: `积分不足，当前 ${pts} 分，发布爆料需要 50 分` }, { status: 403 })
    }
    await pool.query('UPDATE users SET points = points - 50 WHERE telegram_id = $1', [tgUserId])
  }

  // 验证图片（最多2张，必须是 /uploads/boom/ 路径）
  const validImages = Array.isArray(image_urls)
    ? image_urls.filter((u: string) => typeof u === 'string' && u.startsWith('/uploads/boom/')).slice(0, 2)
    : []

  // TG 登录用户（member 或 tg_user）图片直接免审核
  const isTgUser = userTier === 'member' || userTier === 'tg_user'
  const imagesStatus = validImages.length === 0 ? 'none' : isTgUser ? 'approved' : 'pending'

  const res = await pool.query(
    `INSERT INTO comments (twitter_username, user_id, user_name, content, is_expose, reporter_ip, user_tier, tg_user_id, image_urls, images_status, expose_category)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      twitter_username.toLowerCase(),
      ip,
      userTier === 'member' ? '会员用户' : userTier === 'tg_user' ? 'TG用户' : '匿名用户',
      content.trim(),
      ip,
      userTier,
      tgUserId,
      validImages,
      imagesStatus,
      category,
    ]
  )
  return NextResponse.json({ ok: true, comment: res.rows[0], tier: userTier })
}
