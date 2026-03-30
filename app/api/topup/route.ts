import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'
const BSCSCAN_KEY = process.env.BSCSCAN_API_KEY || ''
const FLJ_CONTRACT = (process.env.FLJ_CONTRACT_ADDRESS || 'process.env.FLJ_CONTRACT_ADDRESS').toLowerCase()
const FLJ_WALLET  = (process.env.FLJ_WALLET_ADDRESS  || 'process.env.FLJ_WALLET_ADDRESS').toLowerCase()

const TIERS = [
  { label: '☕ 入门',  usd: 1,  points: 1000 },
  { label: '🍜 进阶',  usd: 3,  points: 3200 },
  { label: '🍣 高级',  usd: 6,  points: 5500 },
  { label: '🚀 精英',  usd: 12, points: 10500 },
  { label: '💎 顶级',  usd: 25, points: 21000 },
]

function verifyToken(req: NextRequest): number | null {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1]
    if (!token) return null
    const payload = jwt.verify(token, JWT_SECRET) as any
    return payload.id || payload.tg_id || null
  } catch { return null }
}

// 获取 FLJ 实时价格（USDT），用 DexScreener 免费 API
async function getFljPrice(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${FLJ_CONTRACT}`, { next: { revalidate: 0 } })
    const data = await res.json()
    const pair = data?.pairs?.[0]
    const price = parseFloat(pair?.priceUsd || '0')
    return price > 0 ? price : null
  } catch { return null }
}

// GET /api/topup — 返回当前价格 + 各档位所需 FLJ 数量
export async function GET() {
  const price = await getFljPrice()
  if (!price) return NextResponse.json({ error: 'price_unavailable' }, { status: 503 })

  const tiers = TIERS.map(t => ({
    ...t,
    flj_needed: Math.ceil(t.usd / price),
    price_usd: price,
  }))

  return NextResponse.json({ price_usd: price, tiers, wallet: FLJ_WALLET })
}

// POST /api/topup — 验证 TX Hash 并发放积分
export async function POST(req: NextRequest) {
  const tgUserId = verifyToken(req)
  if (!tgUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tx_hash, quote_id } = await req.json()
  if (!tx_hash || !quote_id) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  // 查报价单
  const quoteRes = await pool.query(
    `SELECT * FROM topup_quotes WHERE id = $1 AND tg_user_id = $2 AND used = false AND expires_at > NOW()`,
    [quote_id, String(tgUserId)]
  )
  if (quoteRes.rows.length === 0) return NextResponse.json({ error: 'quote_expired' }, { status: 400 })
  const quote = quoteRes.rows[0]
  const tier = TIERS[quote.tier_index]
  if (!tier) return NextResponse.json({ error: 'invalid_tier' }, { status: 400 })

  // 防重复兑换
  const dup = await pool.query('SELECT id FROM flj_topups WHERE tx_hash = $1', [tx_hash.toLowerCase()])
  if (dup.rows.length > 0) return NextResponse.json({ error: 'already_used' }, { status: 400 })

  // 用 BSC 公开 RPC 直接验证交易
  let txData: any = null
  try {
    const rpc = await fetch('https://bsc-dataseed.binance.org/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', method:'eth_getTransactionByHash', params:[tx_hash], id:1 })
    })
    const rpcJson = await rpc.json()
    const result = rpcJson.result
    if (result && result.to?.toLowerCase() === FLJ_CONTRACT && result.input?.startsWith('0xa9059cbb')) {
      const input = result.input
      const toAddr = '0x' + input.slice(34, 74)
      const value = BigInt('0x' + input.slice(74, 138))
      if (toAddr.toLowerCase() === FLJ_WALLET && result.blockNumber) {
        txData = { to: FLJ_WALLET, contractAddress: FLJ_CONTRACT, value: value.toString(), tokenDecimal: '18', hash: tx_hash }
      }
    }
  } catch {
    return NextResponse.json({ error: 'bscscan_error' }, { status: 503 })
  }

  if (!txData) return NextResponse.json({ error: 'tx_not_found' }, { status: 404 })
  if (txData.to.toLowerCase() !== FLJ_WALLET) return NextResponse.json({ error: 'wrong_recipient' }, { status: 400 })
  if (txData.contractAddress.toLowerCase() !== FLJ_CONTRACT) return NextResponse.json({ error: 'wrong_token' }, { status: 400 })

  // 用报价时的价格验证金额（允许 ±20% 误差）
  const fljAmount = Number(txData.value) / 1e18
  const minFlj = Number(quote.flj_needed) * 0.8

  if (fljAmount < minFlj) {
    return NextResponse.json({
      error: 'insufficient_amount',
      sent_flj: Math.floor(fljAmount).toLocaleString(),
      required_flj: Number(quote.flj_needed).toLocaleString(),
    }, { status: 400 })
  }

  // 发放积分
  const usdValue = Number(quote.usd_value)
  await pool.query('BEGIN')
  try {
    await pool.query(`UPDATE topup_quotes SET used = true WHERE id = $1`, [quote_id])
    await pool.query(
      `INSERT INTO flj_topups (tg_user_id, tx_hash, flj_amount, usdt_value, points_granted, tier_label)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [String(tgUserId), tx_hash.toLowerCase(), fljAmount, usdValue, tier.points, quote.tier_label]
    )
    await pool.query(
      `UPDATE users SET points = points + $1 WHERE telegram_id = $2`,
      [tier.points, String(tgUserId)]
    )
    await pool.query('COMMIT')
  } catch (e) {
    await pool.query('ROLLBACK')
    throw e
  }

  return NextResponse.json({ ok: true, points_granted: tier.points, tier_label: tier.label })
}
