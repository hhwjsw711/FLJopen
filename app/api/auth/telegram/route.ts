import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!
const JWT_SECRET = process.env.TG_JWT_SECRET!

function verifyTelegramHash(data: Record<string, string>): boolean {
  const { hash, ...rest } = data
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
    if (!d.ok) return false
    const status = d.result?.status
    return ['member', 'administrator', 'creator'].includes(status)
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const data = await req.json()

  // 1. 验证 Telegram 数据真实性
  if (!verifyTelegramHash(data)) {
    return NextResponse.json({ error: '验证失败，数据不合法' }, { status: 401 })
  }

  // 2. 检查 auth_date 不超过 24h
  const authAge = Math.floor(Date.now() / 1000) - parseInt(data.auth_date)
  if (authAge > 86400) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 })
  }

  // 3. 检查是否是频道成员（非会员也允许登录，但 tier 不同）
  const isMember = await checkChannelMember(parseInt(data.id))

  // 4. 生成 JWT（含 is_member 标记）
  const token = jwt.sign(
    { id: data.id, username: data.username, first_name: data.first_name, photo_url: data.photo_url, is_member: isMember },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return NextResponse.json({
    token,
    is_member: isMember,
    user: { id: data.id, username: data.username, first_name: data.first_name, photo_url: data.photo_url, is_member: isMember }
  })
}
