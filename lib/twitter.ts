// X API v2 - User Lookup (requires Basic plan)
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN!

export interface TwitterUser {
  id: string
  display_name: string
  username: string
  bio: string | null
  avatar_url: string | null
  followers: number | null
  following: number | null
  tweets: number | null
  is_verified: boolean | null
  verified_type: string | null  // 'blue' | 'business' | 'government' | null
  joined: string | null
  account_age_years: number | null
}

export async function fetchTwitterUser(username: string): Promise<TwitterUser | null> {
  if (!BEARER_TOKEN) return null
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}` +
      `?user.fields=public_metrics,verified,verified_type,created_at,description,name,profile_image_url`,
      {
        headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
        signal: AbortSignal.timeout(8000),
      }
    )
    const d = await res.json()
    if (!d.data || d.errors || d.title) return null  // credits depleted or user not found

    const u = d.data
    const m = u.public_metrics || {}

    let account_age_years: number | null = null
    let joined: string | null = null
    if (u.created_at) {
      joined = u.created_at
      const ms = Date.now() - new Date(u.created_at).getTime()
      account_age_years = Math.round(ms / (365.25 * 24 * 3600 * 1000) * 100) / 100
    }

    return {
      id: u.id,
      display_name: u.name || null,
      username: u.username,
      bio: u.description || null,
      avatar_url: u.profile_image_url?.replace('_normal', '_400x400') || null,
      followers: m.followers_count ?? null,
      following: m.following_count ?? null,
      tweets: m.tweet_count ?? null,
      is_verified: u.verified ?? null,
      verified_type: u.verified_type || null,
      joined,
      account_age_years,
    }
  } catch {
    return null
  }
}
