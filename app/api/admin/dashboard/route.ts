import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'
const JWT_SECRET = process.env.JWT_SECRET || 'process.env.JWT_SECRET'

function auth(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    return token ? jwt.verify(token, JWT_SECRET) : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') || '24h' // 1h, 3h, 12h, 24h, 1w, 1m

  let interval = '1 hour'
  let timeFormat = 'YYYY-MM-DD HH:00'
  let limit = 24

  if (range === '1h') { interval = '1 hour'; limit = 60; timeFormat = 'HH:MI' } // 虽然是1h，按分钟计
  else if (range === '3h') { interval = '3 hours'; limit = 180; timeFormat = 'HH:MI' }
  else if (range === '12h') { interval = '12 hours'; limit = 12; timeFormat = 'HH:00' }
  else if (range === '24h') { interval = '24 hours'; limit = 24; timeFormat = 'MM-DD HH:00' }
  else if (range === '1w') { interval = '7 days'; limit = 7; timeFormat = 'MM-DD' }
  else if (range === '1m') { interval = '30 days'; limit = 30; timeFormat = 'MM-DD' }

  try {
    // 基础统计
    const statsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(DISTINCT ip) FROM site_events) as total_uv,
        (SELECT COUNT(*) FROM girls) as total_girls,
        (SELECT COUNT(*) FROM site_events WHERE event_type = 'search_ai') as total_search_ai,
        (SELECT COUNT(*) FROM site_events WHERE event_type = 'search_cache') as total_search_cache,
        (SELECT COUNT(*) FROM site_events WHERE event_type = 'pv') as total_pv
    `)

    // 账号分类统计
    const girlStatsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE score >= 60) as trusted_count,
        COUNT(*) FILTER (WHERE score <= 40) as suspicious_count,
        COUNT(*) FILTER (WHERE has_threshold = true) as threshold_count,
        COUNT(*) FILTER (WHERE negative_tags @> '["scam"]'::jsonb) as scam_count,
        COUNT(*) FILTER (WHERE negative_tags @> '["fake_gender"]'::jsonb) as male_count,
        COUNT(*) FILTER (WHERE negative_tags @> '["stolen_photo"]'::jsonb) as stolen_count
      FROM girls
    `)

    // 时间序列数据（根据 range 决定聚合粒度）
    let seriesSql = ''
    if (range === '1h' || range === '3h') {
        // 按分钟聚合
        seriesSql = `
          SELECT 
            to_char(created_at, 'HH24:MI') as time_key,
            COUNT(*) FILTER (WHERE event_type = 'pv') as pv,
            COUNT(*) FILTER (WHERE event_type = 'search_ai') as search_ai,
            COUNT(*) FILTER (WHERE event_type = 'search_cache') as search_cache
          FROM site_events
          WHERE created_at > NOW() - INTERVAL '${interval}'
          GROUP BY 1 ORDER BY 1 ASC
        `
    } else if (range === '1w' || range === '1m') {
        // 按天聚合
        seriesSql = `
          SELECT 
            to_char(created_at, 'MM-DD') as time_key,
            COUNT(*) FILTER (WHERE event_type = 'pv') as pv,
            COUNT(*) FILTER (WHERE event_type = 'search_ai') as search_ai,
            COUNT(*) FILTER (WHERE event_type = 'search_cache') as search_cache
          FROM site_events
          WHERE created_at > NOW() - INTERVAL '${interval}'
          GROUP BY 1 ORDER BY 1 ASC
        `
    } else {
        // 按小时聚合
        seriesSql = `
          SELECT 
            to_char(created_at, '${timeFormat}') as time_key,
            COUNT(*) FILTER (WHERE event_type = 'pv') as pv,
            COUNT(*) FILTER (WHERE event_type = 'search_ai') as search_ai,
            COUNT(*) FILTER (WHERE event_type = 'search_cache') as search_cache
          FROM site_events
          WHERE created_at > NOW() - INTERVAL '${interval}'
          GROUP BY 1 ORDER BY 1 ASC
        `
    }

    const seriesRes = await pool.query(seriesSql)

    return NextResponse.json({
      summary: statsRes.rows[0],
      girl_stats: girlStatsRes.rows[0],
      series: seriesRes.rows
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
