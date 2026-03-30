import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.TG_JWT_SECRET || 'process.env.TG_JWT_SECRET'

function getVoter(req: NextRequest): { id: string; is_member?: boolean } | null {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return null
    return jwt.verify(token, JWT_SECRET) as any
  } catch { return null }
}

// 权重计算逻辑
function getVoteWeight(voter: { id: string; is_member?: boolean } | null, points: number): number {
  if (!voter) return 1
  if (voter.is_member) return 30
  
  const p = points
  if (p >= 500000) return 30
  if (p >= 100000) return 25
  if (p >= 50000)  return 20
  if (p >= 20000)  return 15
  if (p >= 10000)  return 10
  if (p >= 5000)   return 8
  if (p >= 3000)   return 4
  if (p >= 1000)   return 2
  return 1
}

async function applyPointsForUpvote(commentId: number, newUpvotes: number, client: any) {
  const cm = await client.query('SELECT tg_user_id, user_tier FROM comments WHERE id = $1', [commentId])
  if (!cm.rows.length) return
  const { tg_user_id, user_tier } = cm.rows[0]
  if (user_tier !== 'tg_user' || !tg_user_id) return

  if (newUpvotes > 10) {
    await client.query('UPDATE users SET points = points + 1 WHERE telegram_id = $1', [tg_user_id])
  }
  if (newUpvotes >= 100 && newUpvotes < 130) { // 考虑到权重可能一下跳过100，这里给个区间或单独标记
    // 检查是否已经奖励过500分，避免重复奖励（因为现在权重不一定是1）
    const check = await client.query('SELECT points_granted_100 FROM comments WHERE id = $1', [commentId])
    if (check.rows[0] && !check.rows[0].points_granted_100) {
       await client.query('UPDATE users SET points = points + 500 WHERE telegram_id = $1', [tg_user_id])
       await client.query('UPDATE comments SET points_granted_100 = true WHERE id = $1', [commentId])
    }
  }
}

async function reversePointsForUpvote(commentId: number, oldUpvotes: number, client: any) {
  const cm = await client.query('SELECT tg_user_id, user_tier FROM comments WHERE id = $1', [commentId])
  if (!cm.rows.length) return
  const { tg_user_id, user_tier } = cm.rows[0]
  if (user_tier !== 'tg_user' || !tg_user_id) return

  if (oldUpvotes > 10) {
    await client.query('UPDATE users SET points = points - 1 WHERE telegram_id = $1', [tg_user_id])
  }
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || 'unknown'
  const { comment_id, vote } = await req.json()
  if (!comment_id || ![1, -1].includes(vote)) return NextResponse.json({ error: '参数错误' }, { status: 400 })

  const voter = getVoter(req)
  let voterPoints = 0
  if (voter) {
    const pRes = await pool.query('SELECT points FROM users WHERE telegram_id = $1', [voter.id])
    voterPoints = pRes.rows[0]?.points ?? 0
  }

  const weight = getVoteWeight(voter, voterPoints)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const existing = await client.query('SELECT vote, weight FROM comment_votes WHERE comment_id = $1 AND voter_ip = $2', [comment_id, ip])

    if (existing.rows.length > 0) {
      const oldVote = existing.rows[0].vote
      const oldWeight = existing.rows[0].weight || 1
      
      if (oldVote === vote) {
        // 取消投票：按旧权重扣除
        await client.query('DELETE FROM comment_votes WHERE comment_id = $1 AND voter_ip = $2', [comment_id, ip])
        const col = vote === 1 ? 'upvotes' : 'downvotes'
        await client.query(`UPDATE comments SET ${col} = GREATEST(0, ${col} - ${oldWeight}) WHERE id = $1`, [comment_id])
        if (vote === 1) await reversePointsForUpvote(comment_id, 11, client) // 简化处理
      } else {
        // 改变方向：减去旧权重的旧票，加上新权重的新票
        await client.query('UPDATE comment_votes SET vote = $1, weight = $2 WHERE comment_id = $3 AND voter_ip = $4', [vote, weight, comment_id, ip])
        const addCol = vote === 1 ? 'upvotes' : 'downvotes'
        const subCol = vote === 1 ? 'downvotes' : 'upvotes'
        await client.query(`UPDATE comments SET ${addCol} = ${addCol} + ${weight}, ${subCol} = GREATEST(0, ${subCol} - ${oldWeight}) WHERE id = $1`, [comment_id])
        if (vote === 1) await applyPointsForUpvote(comment_id, 11, client)
      }
    } else {
      // 新投票：使用当前权重
      await client.query('INSERT INTO comment_votes (comment_id, voter_ip, vote, weight) VALUES ($1, $2, $3, $4)', [comment_id, ip, vote, weight])
      const col = vote === 1 ? 'upvotes' : 'downvotes'
      await client.query(`UPDATE comments SET ${col} = ${col} + ${weight} WHERE id = $1`, [comment_id])
      if (vote === 1) await applyPointsForUpvote(comment_id, 11, client)
    }

    if (voter && existing.rows.length === 0) {
      await client.query('UPDATE users SET points = points + 1 WHERE telegram_id = $1', [voter.id])
    }

    await client.query('COMMIT')
    const result = await client.query('SELECT upvotes, downvotes FROM comments WHERE id = $1', [comment_id])
    return NextResponse.json({ ok: true, ...result.rows[0], current_weight: weight })
  } catch (e: any) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
