import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

const DISLIKE_THRESHOLD = 10  // 累计10次不准确自动清除缓存

export async function POST(req: NextRequest) {
  const { username, type } = await req.json()
  if (!username || !['like', 'dislike'].includes(type)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const col = type === 'like' ? 'likes' : 'dislikes'
  const result = await pool.query(
    `UPDATE girls SET ${col} = COALESCE(${col}, 0) + 1
     WHERE twitter_username = $1
     RETURNING dislikes, is_locked`,
    [username.toLowerCase()]
  )

  if (result.rows.length === 0) return NextResponse.json({ ok: true })

  const { dislikes, is_locked } = result.rows[0]

  // 不准确累计 >= 阈值 且 未锁定 → 删除条目，下次检索自动重新分析
  if (type === 'dislike' && dislikes >= DISLIKE_THRESHOLD && !is_locked) {
    await pool.query('DELETE FROM girls WHERE twitter_username = $1', [username.toLowerCase()])
    return NextResponse.json({ ok: true, auto_refreshed: true })
  }

  return NextResponse.json({ ok: true })
}
