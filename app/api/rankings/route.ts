import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const CATEGORY_SQL: Record<string, { where: string; order: string }> = {
  latest:    { where: '1=1',             order: 'g.last_searched_at DESC' },
  threshold: { where: 'g.has_threshold = true OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->\'account_tags\') = \'array\' THEN g.score_detail->\'account_tags\' ELSE \'[]\'::jsonb END) t WHERE t = \'有门槛费\')', order: 'g.score DESC' },
  fushi:     { where: 'g.is_fushi = true OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->\'account_tags\') = \'array\' THEN g.score_detail->\'account_tags\' ELSE \'[]\'::jsonb END) t WHERE t = \'風俗業者\')', order: 'g.score DESC' },
  av:        { where: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags') = 'array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t = 'AV女優')`, order: 'g.score DESC' },
  welfare:   { where: `EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.score_detail->'account_tags') = 'array' THEN g.score_detail->'account_tags' ELSE '[]'::jsonb END) t WHERE t = '福利博主')`, order: 'g.score DESC' },
  comments:  { where: 'EXISTS (SELECT 1 FROM comments ec WHERE ec.twitter_username = g.twitter_username AND ec.is_expose = true AND ec.is_collapsed = false) AND (g.is_welfare = true OR g.is_fushi = true OR g.is_offline = true OR g.has_threshold = true) AND (g.gender IS NULL OR g.gender != \'male\')', order: 'latest_expose_at DESC' },
  zh:        { where: "(g.account_language ILIKE '%中%' OR g.account_language ILIKE '%zh%' OR (g.score_detail->>'primary_language') ILIKE '%中%')", order: 'g.score DESC' },
  ja:        { where: "(g.account_language ILIKE '%日%' OR g.account_language = 'ja' OR (g.score_detail->>'primary_language') ILIKE '%日%')", order: 'g.score DESC' },
  score:     { where: '1=1',             order: 'g.score DESC' },
  risky:     { where: 'g.score < 38',    order: 'g.score ASC' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || 'latest'
  const city = searchParams.get('city') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const offset = (page - 1) * PAGE_SIZE

  // 城市筛选模式
  if (city) {
    const safeCityPattern = city.replace(/'/g, "''")
    const sql = `
      SELECT g.id, g.twitter_username, g.display_name, g.avatar_url,
        g.score, g.search_count, g.cached_at, g.is_fushi, g.is_offline,
        g.has_threshold, g.gender, g.account_language, g.active_cities,
        g.negative_tags, g.positive_tags, g.score_detail, g.is_promoted,
        COUNT(c.id)::int AS comment_count,
        COUNT(CASE WHEN c.is_expose = true THEN 1 END)::int AS expose_count
      FROM girls g
      LEFT JOIN comments c ON c.twitter_username = g.twitter_username
      WHERE g.cached_at IS NOT NULL 
        AND g.gender = 'female'
        AND g.is_restricted IS NOT TRUE
        AND (g.is_welfare IS NOT FALSE) -- 仅显示福利/夜职相关账号
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(g.active_cities) = 'array' THEN g.active_cities ELSE '[]'::jsonb END
          ) t WHERE t = '${safeCityPattern}'
        )
      GROUP BY g.id
      ORDER BY g.score DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `
    const countSql = `
      SELECT COUNT(*)::int AS total FROM girls g
      WHERE g.cached_at IS NOT NULL 
        AND g.gender = 'female'
        AND g.is_restricted IS NOT TRUE
        AND (g.is_welfare IS NOT FALSE)
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(g.active_cities) = 'array' THEN g.active_cities ELSE '[]'::jsonb END
          ) t WHERE t = '${safeCityPattern}'
        )
    `
    const [rows, countRow] = await Promise.all([pool.query(sql), pool.query(countSql)])
    return NextResponse.json({ items: rows.rows, total: countRow.rows[0]?.total || 0, page, pageSize: PAGE_SIZE })
  }

  const cfg = CATEGORY_SQL[category] || CATEGORY_SQL.latest

  try {
    const sql = `
      SELECT
        g.id, g.twitter_username, g.display_name, g.avatar_url,
        g.score, g.search_count, g.cached_at, g.is_fushi, g.is_offline,
        g.has_threshold, g.gender, g.account_language,
        g.negative_tags, g.positive_tags, g.score_detail,
        g.is_promoted,
        COUNT(c.id)::int AS comment_count,
        COUNT(CASE WHEN c.is_expose = true THEN 1 END)::int AS expose_count,
        MAX(CASE WHEN c.is_expose = true THEN c.created_at END) AS latest_expose_at
      FROM girls g
      LEFT JOIN comments c ON c.twitter_username = g.twitter_username
      WHERE g.cached_at IS NOT NULL AND g.gender = 'female' AND g.is_restricted IS NOT TRUE AND ${cfg.where}
      GROUP BY g.id
      ORDER BY ${cfg.order}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM girls g
      WHERE g.cached_at IS NOT NULL AND g.gender = 'female' AND g.is_restricted IS NOT TRUE AND ${cfg.where}
    `
    const [rows, countRow] = await Promise.all([
      pool.query(sql),
      pool.query(countSql),
    ])

    let items = rows.rows

    // 第一页：把推荐账号随机插入，而不是置顶
    if (page === 1) {
      // 分离出已在列表里的推荐账号和不在列表里的推荐账号
      const inListPromoted = items.filter((r: any) => r.is_promoted)
      const notInList = inListPromoted.length === 0
        ? await pool.query(`
            SELECT g.id, g.twitter_username, g.display_name, g.avatar_url,
              g.score, g.search_count, g.cached_at, g.is_fushi, g.is_offline,
              g.has_threshold, g.gender, g.account_language,
              g.negative_tags, g.positive_tags, g.score_detail, g.is_promoted,
              COUNT(c.id)::int AS comment_count,
              COUNT(CASE WHEN c.is_expose = true THEN 1 END)::int AS expose_count
            FROM girls g
            LEFT JOIN comments c ON c.twitter_username = g.twitter_username
            WHERE g.is_promoted = true AND g.cached_at IS NOT NULL
              AND g.is_restricted IS NOT TRUE
            GROUP BY g.id LIMIT 5
          `).then(r => r.rows.filter((p: any) => !items.find((i: any) => i.id === p.id)))
        : []

      const promoItems = [...inListPromoted, ...notInList]
      if (promoItems.length > 0) {
        // 先从原列表移除已有的推荐账号，再随机插回
        items = items.filter((r: any) => !r.is_promoted)
        promoItems.forEach((promo: any) => {
          const pos = Math.floor(Math.random() * Math.min(items.length + 1, PAGE_SIZE))
          items.splice(pos, 0, promo)
        })
        items = items.slice(0, PAGE_SIZE)
      }
    }

    return NextResponse.json({
      items,
      total: countRow.rows[0]?.total || 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
