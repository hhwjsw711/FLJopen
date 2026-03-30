import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'
const FLJ_CONTRACT = (process.env.FLJ_CONTRACT_ADDRESS || 'process.env.FLJ_CONTRACT_ADDRESS').toLowerCase()
const QUOTE_TTL_SECONDS = 300

const TIERS = [
  { label: '☕ 入门',  usd: 1,  points: 1000 },
  { label: '🍜 进阶',  usd: 3,  points: 3200 },
  { label: '🍣 高级',  usd: 6,  points: 5500 },
  { label: '🚀 精英',  usd: 12, points: 10500 },
  { label: '💎 顶级',  usd: 25, points: 21000 },
]

async function getFljPrice(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${FLJ_CONTRACT}`, { cache: 'no-store' })
    const data = await res.json()
    const price = parseFloat(data?.pairs?.[0]?.priceUsd || '0')
    return price > 0 ? price : null
  } catch { return null }
}

function verifyToken(req: NextRequest): number | null {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    if (!token) return null
    const payload = jwt.verify(token, JWT_SECRET) as any
    return payload.id || payload.tg_id || null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const tgUserId = verifyToken(req)
  if (!tgUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tier_index } = await req.json()
  const tier = TIERS[tier_index]
  if (!tier) return NextResponse.json({ error: 'invalid_tier' }, { status: 400 })

  const price = await getFljPrice()
  if (!price) return NextResponse.json({ error: 'price_unavailable' }, { status: 503 })

  const fljNeeded = Math.ceil(tier.usd / price)
  const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000)

  const { rows } = await pool.query(
    `INSERT INTO topup_quotes (tg_user_id, tier_index, tier_label, flj_needed, price_usd, usd_value, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [String(tgUserId), tier_index, tier.label, fljNeeded, price, tier.usd, expiresAt]
  )

  return NextResponse.json({
    quote_id: rows[0].id,
    flj_needed: fljNeeded,
    price_usd: price,
    usd_value: tier.usd,
    tier_label: tier.label,
    points: tier.points,
    expires_at: expiresAt.toISOString(),
    expires_in: QUOTE_TTL_SECONDS,
  })
}
