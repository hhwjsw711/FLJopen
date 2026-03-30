// BYOK (Bring Your Own Key) — 用户自带 xAI API Key 进行无限制搜索
// API Key 仅用于当次请求，绝不持久化存储；结果照常入库供全站缓存
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { checkReputation, calcScore } from '@/lib/grok'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function filterSelfDefense(examples: string[]): string[] {
  if (!Array.isArray(examples)) return []
  return examples.filter(e => {
    if (!e || typeof e !== 'string') return false
    const lower = e.toLowerCase()
    return !lower.includes('なぜ') && !lower.includes('为什么我') && !lower.includes('why do people think i')
  })
}

function reconcileComplaintTypes(types: string[], examples: string[]): string[] {
  const filtered = filterSelfDefense(examples)
  if (filtered.length === 0 && types.includes('scam')) return types.filter(t => t !== 'scam')
  return types
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.replace('@', '').trim().toLowerCase()
  const lang = (searchParams.get('lang') || 'zh').toLowerCase()
  const byokKey = req.headers.get('x-byok-key') || ''

  if (!username || !/^[a-zA-Z0-9_]{1,50}$/.test(username))
    return NextResponse.json({ error: 'invalid_username' }, { status: 400 })
  if (!byokKey.startsWith('process.env.XAI_API_KEY'))
    return NextResponse.json({ error: 'invalid_key', message: 'API Key 格式错误，必须以 process.env.XAI_API_KEY 开头' }, { status: 400 })

  // 命中缓存直接返回（给用户省 token）
  const cached = await pool.query(`SELECT * FROM girls WHERE twitter_username = $1`, [username])
  if (cached.rows.length > 0) {
    const row = cached.rows[0]
    let i18n: any = {}
    try { i18n = (typeof row.user_eval_i18n === 'string') ? JSON.parse(row.user_eval_i18n) : (row.user_eval_i18n || {}) } catch { i18n = {} }
    const currentEval = i18n[lang] || i18n['zh'] || row.user_eval || ''
    pool.query(`UPDATE girls SET last_searched_at = NOW() WHERE twitter_username = $1`, [username]).catch(() => {})
    return NextResponse.json({ ...row, user_eval: currentEval, score_detail: { ...(row.score_detail || {}), detail: currentEval }, cached: true, byok: true })
  }

  // 无缓存：用用户的 key 调用 Grok
  try {
    const rep = await checkReputation(username, 'zh', byokKey)

    const finalComplaintEx = filterSelfDefense(rep.complaint_examples)
    const finalPositiveEx = filterSelfDefense(rep.positive_examples)
    const finalComplaintTypes = reconcileComplaintTypes(rep.complaint_types, finalComplaintEx)
    const finalMerged: any = { ...rep, complaint_examples: finalComplaintEx, positive_examples: finalPositiveEx, complaint_types: finalComplaintTypes }

    const score = calcScore(20, finalMerged)
    const tags: string[] = finalMerged.account_tags || []
    const zhText = finalMerged.detail || ''

    const r = await pool.query(`
      INSERT INTO girls (
        twitter_username, display_name, bio, avatar_url, score, score_detail,
        media_urls, account_language, is_fushi, is_offline, has_threshold, active_cities,
        negative_tags, positive_tags, user_eval, user_eval_i18n, cached_lang,
        cached_at, updated_at, gender, is_welfare, last_searched_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW(),$18,$19,NOW())
      ON CONFLICT (twitter_username) DO UPDATE SET
        display_name=EXCLUDED.display_name, bio=EXCLUDED.bio, avatar_url=EXCLUDED.avatar_url,
        score=EXCLUDED.score, score_detail=EXCLUDED.score_detail,
        media_urls=EXCLUDED.media_urls, account_language=EXCLUDED.account_language,
        is_fushi=EXCLUDED.is_fushi, is_offline=EXCLUDED.is_offline,
        has_threshold=EXCLUDED.has_threshold, active_cities=EXCLUDED.active_cities,
        negative_tags=EXCLUDED.negative_tags, positive_tags=EXCLUDED.positive_tags,
        user_eval=EXCLUDED.user_eval, user_eval_i18n=EXCLUDED.user_eval_i18n,
        cached_lang=EXCLUDED.cached_lang, cached_at=NOW(), updated_at=NOW(),
        gender=EXCLUDED.gender, is_welfare=EXCLUDED.is_welfare, last_searched_at=NOW()
      RETURNING *`,
      [
        username, finalMerged.display_name || null, finalMerged.bio || null,
        finalMerged.avatar_url || null, score, JSON.stringify(finalMerged),
        JSON.stringify(rep.media_urls || []), finalMerged.primary_language || null,
        tags.includes('風俗業者'), tags.includes('可线下'), tags.includes('有门槛费'),
        JSON.stringify((finalMerged.active_cities || []).filter((c: string) => c && c.length <= 5)),
        JSON.stringify(finalMerged.complaint_types || []),
        JSON.stringify(finalMerged.positive_types || []),
        zhText, JSON.stringify({ zh: zhText }), 'zh',
        finalMerged.gender || 'unknown', finalMerged.is_welfare !== false
      ]
    )
    const row = r.rows[0]
    return NextResponse.json({ ...row, user_eval: zhText, score_detail: { ...finalMerged, detail: zhText }, cached: false, byok: true })
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('401') || msg.includes('Unauthorized'))
      return NextResponse.json({ error: 'key_invalid', message: 'API Key 无效，请检查是否正确' }, { status: 401 })
    if (msg.includes('quota') || msg.includes('402') || msg.includes('429'))
      return NextResponse.json({ error: 'key_quota', message: 'API Key 余额不足或超限' }, { status: 402 })
    if (msg.includes('grok_quota_exceeded'))
      return NextResponse.json({ error: 'key_quota', message: 'API Key 超出配额限制' }, { status: 402 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
