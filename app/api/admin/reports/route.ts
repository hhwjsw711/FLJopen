import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  try { jwt.verify(token, JWT_SECRET); return true } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = new URL(req.url).searchParams.get('status') || 'pending'
  const rows = await pool.query(
    `SELECT r.*, g.score, g.display_name
     FROM reports r
     LEFT JOIN girls g ON g.twitter_username = r.twitter_username
     WHERE r.status = $1
     ORDER BY r.created_at DESC LIMIT 100`,
    [status]
  )
  return NextResponse.json(rows.rows)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id, action, twitter_username } = await req.json()
  // action: 'resolve' (扣100分) | 'dismiss' (忽略)
  if (action === 'resolve' && twitter_username) {
    await pool.query(
      `UPDATE girls SET score = GREATEST(0, score - 100),
        negative_tags = CASE
          WHEN NOT (negative_tags @> '"reported"'::jsonb)
          THEN negative_tags || '["reported"]'::jsonb
          ELSE negative_tags
        END
       WHERE twitter_username = $1`,
      [twitter_username]
    )
  }
  await pool.query(`UPDATE reports SET status = $1 WHERE id = $2`, [action === 'resolve' ? 'resolved' : 'dismissed', id])
  return NextResponse.json({ ok: true })
}
