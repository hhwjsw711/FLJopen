import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!
const JWT_SECRET = process.env.TG_JWT_SECRET!

function verifyTelegramHash(params: Record<string, string>): boolean {
  const { hash, ...rest } = params
  const checkStr = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n')
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkStr).digest('hex')
  return hmac === hash
}

async function checkChannelMember(userId: number): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`
    )
    const d = await res.json()
    const status = d.result?.status
    return ['member', 'administrator', 'creator'].includes(status)
  } catch { return false }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { params[k] = v })

  const BASE = 'https://flj.info'

  if (!params.hash) {
    return NextResponse.redirect(`${BASE}/?tg_err=invalid&reason=no_hash`)
  }

  const hashOk = verifyTelegramHash(params)
  if (!hashOk) {
    // debug: 临时显示参数帮助排查
    const keys = Object.keys(params).sort().join(',')
    return NextResponse.redirect(`${BASE}/?tg_err=invalid&reason=hash_fail&keys=${encodeURIComponent(keys)}`)
  }

  const authAge = Math.floor(Date.now() / 1000) - parseInt(params.auth_date)
  if (authAge > 86400) {
    return NextResponse.redirect(`${BASE}/?tg_err=expired`)
  }

  const isMember = await checkChannelMember(parseInt(params.id))
  // 非会员也允许登录，is_member=false 标记为普通用户

  // 记录用户信息到 DB，首次登录会员送 100 积分
  try {
    const pool = (await import('@/lib/db')).default
    const initPoints = 100  // 所有新用户首次登录送 100 分
    await pool.query(
      `INSERT INTO users (telegram_id, username, first_name, photo_url, last_login, points, is_member)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         photo_url = EXCLUDED.photo_url,
         is_member = EXCLUDED.is_member,
         points = CASE WHEN users.points = 0 THEN 100 ELSE users.points END,
         last_login = NOW()`,
      [params.id, params.username || null, params.first_name || null, params.photo_url || null, initPoints, isMember]
    )
  } catch (e: any) {
    console.error('Save user error:', e.message)
  }

  const token = jwt.sign(
    { id: params.id, username: params.username, first_name: params.first_name, photo_url: params.photo_url, is_member: isMember },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  const user = encodeURIComponent(JSON.stringify({
    id: params.id,
    username: params.username,
    first_name: params.first_name,
    photo_url: params.photo_url,
    is_member: isMember,
  }))

  return NextResponse.redirect(`${BASE}/?tg_token=${token}&tg_user=${user}`)
}
