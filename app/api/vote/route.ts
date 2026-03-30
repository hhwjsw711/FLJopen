import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

function getTgUserId(req: NextRequest): number | null {
  const auth = req.headers.get('authorization')
  const token = auth?.split(' ')[1]
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    return payload.id || payload.tg_id || null
  } catch { return null }
}

// GET: 获取某账号的投票汇总 + 当前用户的投票
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.toLowerCase()
  if (!username) return NextResponse.json({ error: 'missing username' }, { status: 400 })

  const tgUserId = getTgUserId(req)

  const [sumRow, myRow] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(vote), 0)::int AS vote_score,
              COUNT(CASE WHEN vote=1 THEN 1 END)::int AS trust_count,
              COUNT(CASE WHEN vote=-1 THEN 1 END)::int AS fraud_count
       FROM user_votes WHERE twitter_username = $1`,
      [username]
    ),
    tgUserId
      ? pool.query(
          `SELECT vote FROM user_votes WHERE tg_user_id = $1 AND twitter_username = $2`,
          [tgUserId, username]
        )
      : Promise.resolve({ rows: [] })
  ])

  return NextResponse.json({
    vote_score: sumRow.rows[0]?.vote_score || 0,
    trust_count: sumRow.rows[0]?.trust_count || 0,
    fraud_count: sumRow.rows[0]?.fraud_count || 0,
    my_vote: myRow.rows[0]?.vote ?? null,
  })
}

// POST: 提交投票（需要 TG 登录）
export async function POST(req: NextRequest) {
  const tgUserId = getTgUserId(req)
  if (!tgUserId) return NextResponse.json({ error: 'login_required' }, { status: 401 })

  const { username, vote } = await req.json()
  if (!username || ![1, -1].includes(vote)) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 })
  }

  const lUsername = username.toLowerCase()

  // Upsert：已投过则更新，未投则新增
  await pool.query(
    `INSERT INTO user_votes (tg_user_id, twitter_username, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (tg_user_id, twitter_username) DO UPDATE SET vote = EXCLUDED.vote`,
    [tgUserId, lUsername, vote]
  )

  // 重新统计该账号的总投票分，存入 score_detail，并更新排行榜 score
  const voteRes = await pool.query(
    `SELECT COALESCE(SUM(vote), 0)::int AS total FROM user_votes WHERE twitter_username = $1`,
    [lUsername]
  )
  const voteTotal = voteRes.rows[0]?.total || 0

  // 更新 girls: 将 user_vote_score 写入 score_detail，并同步调整 score
  await pool.query(
    `UPDATE girls
     SET score_detail = score_detail || jsonb_build_object('user_vote_score', $2::int),
         score = LEAST(100, GREATEST(0, score + ($2::int - COALESCE((score_detail->>'user_vote_score')::int, 0))))
     WHERE twitter_username = $1`,
    [lUsername, voteTotal]
  )

  const sumRow = await pool.query(
    `SELECT COALESCE(SUM(vote),0)::int AS vote_score,
            COUNT(CASE WHEN vote=1 THEN 1 END)::int AS trust_count,
            COUNT(CASE WHEN vote=-1 THEN 1 END)::int AS fraud_count
     FROM user_votes WHERE twitter_username = $1`,
    [lUsername]
  )

  return NextResponse.json({
    ok: true,
    vote_score: sumRow.rows[0]?.vote_score || 0,
    trust_count: sumRow.rows[0]?.trust_count || 0,
    fraud_count: sumRow.rows[0]?.fraud_count || 0,
    my_vote: vote,
  })
}
