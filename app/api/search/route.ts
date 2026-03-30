import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') || 'tokyo'

  const result = await pool.query(
    `SELECT * FROM girls WHERE city = $1 AND status != 'deleted'
     ORDER BY is_promoted DESC, score DESC LIMIT 20`,
    [city]
  )
  return NextResponse.json(result.rows)
}
