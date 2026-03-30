import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

// 内存缓存，5分钟有效
let overviewCache: { data: any; ts: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

const CATEGORIES = [
  { id: 'comments',  label: '🔥 最新爆料', order: 'latest_expose_at DESC', where: `EXISTS (SELECT 1 FROM comments ec WHERE ec.twitter_username = g.twitter_username AND ec.is_expose = true)` },
  { id: 'latest',    label: '🕐 最新检索', order: 'g.last_searched_at DESC', where: '1=1' },
  { id: 'score',     label: '⭐ 评分最高', order: 'g.score DESC',         where: 'g.score >= 60' },
  { id: 'fushi',     label: '🔞 风俗业者', order: 'g.score DESC',         where: `(g.is_fushi = true OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags')='array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t='風俗業者'))` },
  { id: 'threshold', label: '🚪 门槛妹',   order: 'g.score DESC',         where: `(g.has_threshold = true OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags')='array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t='有门槛费'))` },
  { id: 'av',        label: '🎬 AV女优',   order: 'g.score DESC',         where: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags')='array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t='AV女優')` },
  { id: 'welfare',   label: '📦 福利博主', order: 'g.score DESC',         where: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags')='array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t='福利博主')` },
  { id: 'ja',        label: '🇯🇵 日文区',  order: 'g.score DESC',         where: `(g.account_language ILIKE '%日%' OR g.account_language='ja' OR (g.score_detail->>'primary_language') ILIKE '%日%')` },
  { id: 'zh',        label: '🇨🇳 中文区',  order: 'g.score DESC',         where: `(g.account_language ILIKE '%中%' OR g.account_language ILIKE '%zh%' OR (g.score_detail->>'primary_language') ILIKE '%中%')` },
  { id: 'risky',     label: '🚨 风险账号', order: 'g.score ASC',          where: 'g.score < 38' },
]

export async function GET() {
  // 命中缓存直接返回
  if (overviewCache && Date.now() - overviewCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(overviewCache.data)
  }

  try {
    const results = await Promise.all(
      CATEGORIES.map(async cat => {
        const rows = await pool.query(`
          SELECT g.twitter_username, g.display_name, g.avatar_url,
            g.score, g.search_count, g.is_fushi, g.is_offline,
            g.has_threshold, g.negative_tags, g.score_detail,
            COUNT(c.id)::int AS comment_count,
            COUNT(CASE WHEN c.is_expose = true THEN 1 END)::int AS expose_count,
            MAX(CASE WHEN c.is_expose = true THEN c.created_at END) AS latest_expose_at
          FROM girls g
          LEFT JOIN comments c ON c.twitter_username = g.twitter_username
          WHERE g.cached_at IS NOT NULL
            AND g.gender = 'female'
            AND g.is_restricted IS NOT TRUE
            AND ${cat.where}
          GROUP BY g.id
          ORDER BY ${cat.order}
          LIMIT 10
        `)
        return { id: cat.id, label: cat.label, items: rows.rows }
      })
    )
    overviewCache = { data: results, ts: Date.now() }
    return NextResponse.json(results)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
