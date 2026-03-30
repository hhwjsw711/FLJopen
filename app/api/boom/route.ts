import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getTgUserRank } from '@/lib/rank'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 10

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') || 'latest' // latest | hot | controversial
  const categoryFilter = searchParams.get('category') || '' // 分类筛选
  const VALID_CATEGORIES = ['日常爆料', '被骗经历', '门槛爆料', '同行互撕', '金主哭诉']
  const pageSize = parseInt(searchParams.get('pageSize' ) || String(DEFAULT_PAGE_SIZE))
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const offset = (page - 1) * pageSize
  const categoryWhere = (categoryFilter && VALID_CATEGORIES.includes(categoryFilter))
    ? `AND expose_category = '${categoryFilter.replace(/'/g, "''")}'`
    : ''

  const orderMap: Record<string, string> = {
    latest: 'c.created_at DESC',
    hot: '(c.upvotes - c.downvotes) * CASE WHEN c.user_tier = \'member\' THEN 2 ELSE 1 END DESC, c.created_at DESC',
    controversial: 'LEAST(c.upvotes, c.downvotes) DESC, c.created_at DESC',
  }
  const order = orderMap[tab] || orderMap.latest

  try {
    const [rows, countRow] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.content, c.created_at, c.upvotes, c.downvotes,
          c.twitter_username, c.user_tier, c.expose_category,
          CASE WHEN c.images_status = 'approved' THEN c.image_urls ELSE '{}'::text[] END AS image_urls,
          c.images_status,
          COALESCE(u.points, 0) AS user_points,
          g.display_name, g.avatar_url, g.score,
          g.negative_tags, g.score_detail
        FROM comments c
        INNER JOIN girls g ON g.twitter_username = c.twitter_username
          AND (g.gender IS NULL OR g.gender != 'male')
          AND (g.is_welfare = true OR g.is_fushi = true OR g.is_offline = true OR g.has_threshold = true)
        LEFT JOIN users u ON u.telegram_id = c.tg_user_id
        WHERE c.is_expose = true
          AND c.is_collapsed = false
          ${categoryWhere}
        ORDER BY ${order}
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total FROM comments
        WHERE is_expose = true AND is_collapsed = false ${categoryWhere}
      `),
    ])

    // 今日新增（东京时间午夜重置）
    const todayRow = await pool.query(`
      SELECT COUNT(*)::int AS today
      FROM comments
      WHERE is_expose = true
        AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'
    `)

    // 被人工折叠的数量
    const hiddenRow = await pool.query(`
      SELECT COUNT(*)::int AS hidden
      FROM comments
      WHERE is_expose = true AND is_collapsed = true
    `)

    const items = rows.rows.map(r => ({
      ...r,
      user_rank: r.user_tier === 'tg_user' ? getTgUserRank(r.user_points) : null,
    }))

    return NextResponse.json({
      items,
      total: countRow.rows[0]?.total || 0,
      today: todayRow.rows[0]?.today || 0,
      hidden: hiddenRow.rows[0]?.hidden || 0,
      page,
      pageSize: pageSize,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
