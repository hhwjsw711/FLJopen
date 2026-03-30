const XAI_API_KEY = process.env.XAI_API_KEY!

const CITY_KEYWORDS: Record<string, string[]> = {
  tokyo:    ['东京', '東京'],
  osaka:    ['大阪'],
  hokkaido: ['北海道', '札幌'],
  fukuoka:  ['福冈', '福岡'],
  nagano:   ['长野', '長野'],
  sendai:   ['仙台'],
  nagoya:   ['名古屋'],
  kyoto:    ['京都'],
  kobe:     ['神户', '神戸'],
}

export async function searchGirls(city: string, lang: string = 'zh') {
  const keywords = CITY_KEYWORDS[city] || [city]
  const cityKw = keywords.join(' OR ')
  const query = `(${cityKw}) (线下 OR 门槛 OR 🚪 OR 约 OR 实拍 OR 実撮) lang:${lang === 'ja' ? 'ja' : 'zh'} -is:retweet`

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_API_KEY}` },
    body: JSON.stringify({
      model: 'grok-4-1-fast-non-reasoning',
      tools: [{ type: 'x_search' }],
      input: `请在X（推特）上搜索以下关键词，找出真实存在的推特用户账号：${query}。请列出你找到的具体推特用户名（@username格式），包括她们的简介和最新推文内容。只需列出账号信息，不要解释或科普。`
    })
  })
  const data = await res.json()
  const text = data.output?.find((o: {type: string}) => o.type === 'message')?.content?.[0]?.text || ''

  // 直接用正则从文本提取 @username，省掉第二次 API 调用
  const usernameMatches = text.match(/@([a-zA-Z0-9_]{3,50})/g) || []
  const usernameSet: Record<string, boolean> = {}
  usernameMatches.forEach((u: string) => { usernameSet[u.replace('@', '')] = true })
  const usernames = Object.keys(usernameSet)

  return usernames.slice(0, 10).map((username: string) => {
    // 提取该用户名附近的简介文字
    const regex = new RegExp(`@${username}[^@]{0,150}`, 'i')
    const bioMatch = text.match(regex)
    const bio = bioMatch ? bioMatch[0].replace(`@${username}`, '').replace(/[（(【\n]/g, ' ').trim().slice(0, 80) : ''
    // 提取门槛
    const thresholdMatch = bio.match(/[🚪门槛](\d+)/) || text.match(new RegExp(`@${username}[^@]*?[🚪门槛](\\d+)`))
    const threshold = thresholdMatch ? thresholdMatch[1] : null
    return { twitter_username: username, display_name: null, bio, avatar_url: null, threshold, media_urls: [], score: 75 }
  }).filter((g: {twitter_username: string}) => /^[a-zA-Z0-9_]{3,50}$/.test(g.twitter_username))
}

export interface Reputation {
  complaints: number
  positives: number
  detail: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  media_urls: string[]
  followers: number | null
  following: number | null
  tweets: number | null
  account_age_years: number | null
  is_verified: boolean | null
  is_active: boolean | null
  engagement: 'high' | 'medium' | 'low' | null
  big_v_interaction: boolean | null
  blue_v_interaction_pct: number | null  // 与该账号互动的蓝V占比估算 0-100
  pinned_tweet_has_url: boolean | null  // 置顶推文是否包含外部链接
  primary_language: string | null  // e.g. "日本語", "中文", "English", "韓国語"
  active_cities: string[]  // e.g. ["東京", "大阪"] or ["全球可飞"] or []
  account_tags: string[]   // e.g. ["風俗娘", "可线下", "有门槛费"]
  content_tags: string[]   // e.g. ["巨乳", "黑丝", "SM"] — max 5, from preset list
  recent_posts: string[]
  location: string | null
  using_proxy: boolean | null
  complaint_examples: string[]
  positive_examples: string[]
  complaint_types: string[]  // e.g. ["stolen_photo", "fake_gender", "scam", "impersonation"]
  positive_types: string[]   // e.g. ["recommended", "verified_real", "praised", "trusted"]
  gender: 'female' | 'male' | 'unknown'  // inferred from name, bio, content
  is_welfare: boolean  // true if this account is mainly for adult/welfare/NSFW/erotic/福利 content. false if it's a normal lifestyle/fashion/travel/non-adult account.
  is_manual_verified?: boolean // 官方人工验证
}

// 只查 detail 文字（用于多语言缓存）
export async function fetchDetailOnly(username: string, lang: string): Promise<string> {
  const text = await grokSearch(`Search X for @${username} profile and recent tweets. Write 3-4 sentences in ${lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : lang === 'zh-tw' ? 'Traditional Chinese' : 'Simplified Chinese'} objectively describing what this account posts about, their style, and any notable positives or negatives. Return ONLY JSON: {"detail": "your description here"}`)
  try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]).detail || '' } catch {}
  return ''
}

async function grokSearch(input: string, maxTokens = 900, apiKey?: string): Promise<string> {
  const key = apiKey || XAI_API_KEY
  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'grok-4-1-fast-non-reasoning', tools: [{ type: 'x_search' }], input, max_output_tokens: maxTokens })
  })
  if (res.status === 429 || res.status === 402 || res.status === 503) {
    const err = new Error('grok_quota_exceeded') as any
    err.code = 'grok_quota_exceeded'
    err.status = res.status
    throw err
  }
  const data = await res.json()
  const text = data.output?.find((o: {type: string}) => o.type === 'message')?.content?.[0]?.text || ''
  // 去除 Grok 内部引用标签 <grok:render ...>...</grok:render>
  return text.replace(/<grok:[^>]*>[\s\S]*?<\/grok:[^>]*>/g, '').replace(/<grok:[^/]*\/>/g, '').trim()
}

export async function checkReputation(username: string, lang = 'zh', apiKey?: string): Promise<Reputation> {
  // 两次并行搜索：1) 账号资料  2) 他人对该账号的评价
  const [profileText, mentionText] = await Promise.all([
    grokSearch(`Look up @${username} on X. Return ONLY valid JSON (no markdown):
{"display_name":"name","bio":"bio text","avatar_url":"url or null","media_urls":["url1","url2"],"is_active":true/false,"engagement":"high/medium/low","recent_posts":["post1","post2"],"location":"city/country or null","using_proxy":true if VPN suspected else false,"detail":"3-4 sentences in Chinese: what they post, engagement style, any red flags or complaints found","blue_v_interaction_pct":0-100 or null,"primary_language":"日本語/中文/English etc or null","active_cities":["東京"] — major cities only, normalize districts to city (渋谷→東京, 難波→大阪), ["全球可飞"] if global, [] if unknown,"account_tags":include matching tags only — "風俗業者"(sex/nightlife industry: 風俗/夜職/パパ活/メンエス/デリヘル/ソープ/キャバ/ホスト etc),"可线下"(offline meetups),"有门槛费"(🚪 or deposit fee),"AV女優"(AV actress/studio),"福利博主"(sells photo/video packs: OnlyFans/Fanbox/Fantia/图包 etc) — [] if none,"content_tags":select 3–5 matching tags from this list based on their content/media/bio — try to pick at least 3 if the account has any adult/welfare content — ["巨乳","童颜","御姐","萝莉","美腿","黑丝","不露脸","多人","SM","调教","女同","4P","熟女","美臀","纯爱","情侣","NTR","小狗"] — [] only if truly no relevant content,"gender":"female/male/unknown","follower_count":int or null,"following_count":int or null,"tweet_count":int or null,"is_blue_verified":true/false/null,"account_age_years":decimal or null,"is_welfare":true if adult/NSFW/nightlife content else false,"pinned_tweet_has_url":true if pinned tweet has any link else false}`, 800, apiKey),

    grokSearch(`Search X for third-party tweets mentioning @${username}. Count complaints (盗图/皮下男/詐欺骗钱跑路/偽物なりすまし/差评踩雷) and positives (推荐好评/会えた本物/かわいい信頼).
EXCLUDE: tweets BY @${username} themselves (including self-defense or rhetorical questions), pure speculation without victim firsthand account.
complaint_types (strict evidence required): "stolen_photo"(explicit claim of stolen photos),"fake_gender"(direct interaction proving male),"scam"(≥2 independent victims with payment+disappear),"impersonation"(confirmed fake identity).
positive_types: "recommended","verified_real","praised","trusted".
Examples must be verbatim third-party tweets only. Return ONLY JSON:
{"complaints":0,"positives":0,"complaint_types":[],"positive_types":[],"complaint_examples":[],"positive_examples":[]}`, 600, apiKey)
  ])

  let profile: Partial<Reputation> = {}
  let mentions: { complaints?: number; positives?: number } = {}

  try {
    const m = profileText.match(/\{[\s\S]*\}/)
    if (m) profile = JSON.parse(m[0])
  } catch { /* ignore */ }

  try {
    const m = mentionText.match(/\{[\s\S]*\}/)
    if (m) mentions = JSON.parse(m[0])
  } catch { /* ignore */ }

  return {
    complaints: (mentions as any).complaints || 0,
    positives: (mentions as any).positives || 0,
    complaint_examples: (mentions as any).complaint_examples || [],
    positive_examples: (mentions as any).positive_examples || [],
    complaint_types: (mentions as any).complaint_types || [],
    positive_types: (mentions as any).positive_types || [],
    detail: profile.detail || '',
    display_name: profile.display_name || null,
    bio: profile.bio || null,
    avatar_url: profile.avatar_url || null,
    media_urls: profile.media_urls || [],
    // 三项全为 0 说明 Grok 未能读取 profile 统计数据，视为 null
    followers: ((profile as any).follower_count || (profile as any).following_count || (profile as any).tweet_count)
      ? ((profile as any).follower_count ?? null) : null,
    following: ((profile as any).follower_count || (profile as any).following_count || (profile as any).tweet_count)
      ? ((profile as any).following_count ?? null) : null,
    tweets: ((profile as any).follower_count || (profile as any).following_count || (profile as any).tweet_count)
      ? ((profile as any).tweet_count ?? null) : null,
    account_age_years: (profile as any).account_age_years || null,
    is_verified: (profile as any).is_blue_verified ?? null,
    is_active: profile.is_active || null,
    engagement: profile.engagement || null,
    big_v_interaction: null,
    blue_v_interaction_pct: profile.blue_v_interaction_pct ?? null,
    primary_language: profile.primary_language ?? null,
    active_cities: profile.active_cities ?? [],
    account_tags: profile.account_tags ?? [],
    content_tags: profile.content_tags ?? [],
    recent_posts: profile.recent_posts || [],
    location: profile.location || null,
    using_proxy: profile.using_proxy || null,
    gender: (['female','male','unknown'].includes(profile.gender ?? '') ? profile.gender : 'unknown') as 'female' | 'male' | 'unknown',
    is_welfare: (profile as any).is_welfare !== false, // 除非明确返回 false，否则默认为 true
    pinned_tweet_has_url: (profile as any).pinned_tweet_has_url ?? null,
  }
}

export function calcScore(_base: number, rep: Reputation): number {
  let score = 20  // 基础分：账号存在即起点

  // ── 账号寿命（线性，每年+3，上限25）──
  const age = rep.account_age_years
  if (age != null) {
    if (age < 0.25) {
      // 3个月内新号：小扣分
      score -= 5
    } else if (age < 0.5) {
      // 3~6个月：轻微正分
      score += 2
    } else if (age < 1) {
      // 6~12个月：有一定基础
      score += 4
    } else {
      // 满1年开始按年计算
      score += Math.min(25, Math.floor(age) * 3)
    }
  }
  // age == null：完全未知，不加也不扣

  // ── 粉丝数（对数平滑，上限20）──
  // log10(followers) 让中等账号也有合理加分，避免硬阶梯
  const f = rep.followers
  if (f != null && f > 0) {
    const logScore = (Math.log10(Math.max(1, f)) - 2) * 5  // 100粉=0, 1k=5, 10k=10, 100k=15, 1M=20
    score += Math.min(20, Math.max(0, Math.round(logScore)))
  }

  // ── 发帖量（对数平滑，上限8）──
  // 发帖多 = 真实在用，作为辅助信号
  const t = rep.tweets
  if (t != null && t > 0) {
    const tScore = (Math.log10(Math.max(1, t)) - 1.5) * 4  // 30条=0, 200=3, 1k=6, 5k=8
    score += Math.min(8, Math.max(0, Math.round(tScore)))
  }

  // ── 蓝V认证（真实数据）+10 ──
  if (rep.is_verified === true) score += 10

  // ── 近期活跃（Grok判断）+5 ──
  if (rep.is_active === true) score += 5

  // ── 互动率（Grok判断，作为加成不作为扣分）──
  if (rep.engagement === 'high')        score += 8
  else if (rep.engagement === 'medium') score += 4

  // ── 他人好评（有即 +10）──
  if ((rep.positives || 0) > 0) score += 10

  // ── 他人差评（按严重程度分级扣分）──
  const complaintTypes: string[] = (rep as any).complaint_types || []
  if ((rep.complaints || 0) > 0) {
    // 基础投诉：-8
    score -= 8
    // 严重投诉额外扣分（可叠加）
    if (complaintTypes.includes('scam'))          score -= 20  // 骗钱跑路
    if (complaintTypes.includes('impersonation')) score -= 20  // 冒充他人
    // fake_gender 和 stolen_photo 仅保留标签警示，不扣分
  }

  // ── VPN/代理（-5）──
  if (rep.using_proxy === true) score -= 5

  // ── 置顶推文含外链（-10，诈骗账号高频特征）──
  if ((rep as any).pinned_tweet_has_url === true) score -= 10

  // ── 官方人工验证（+30）──
  if (rep.is_manual_verified === true) score += 30

  return Math.max(0, Math.min(200, score))
}
