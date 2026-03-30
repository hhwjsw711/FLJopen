'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

interface Girl {
  id: string
  twitter_username: string
  display_name: string
  bio: string
  avatar_url: string
  threshold: string
  score: number
  score_detail: { complaints: number; positives: number; detail: string }
  media_urls: string[]
  is_promoted: boolean
  status: string
}

const CITY_LABELS: Record<string, string> = {
  tokyo: '東京', osaka: '大阪', kyoto: '京都', kobe: '神戸',
  nagoya: '名古屋', fukuoka: '福岡', sendai: '仙台', hokkaido: '北海道', nagano: '長野'
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400 bg-green-400/10 border-green-400/20'
    : score >= 60 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  const label = score >= 80 ? '✅ 可信' : score >= 60 ? '⚠️ 待定' : '🚨 风险'
  return (
    <span className={`badge border ${color}`}>{label} {score}</span>
  )
}

function GirlCard({ girl }: { girl: Girl }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    fetch(`/api/like?girl_id=${girl.id}`).then(r => r.json()).then(d => {
      setLikeCount(d.count || 0); setLiked(d.liked || false)
    })
  }, [girl.id])

  async function handleLike() {
    const res = await fetch('/api/like', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ girl_id: girl.id })
    })
    const d = await res.json()
    if (d.success) { setLiked(true); setLikeCount(d.count) }
  }

  const media = girl.media_urls || []

  return (
    <div className={`card overflow-hidden ${girl.is_promoted ? 'border-pink-500/40' : ''}`}>
      {girl.is_promoted && (
        <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 px-4 py-1.5 text-xs text-pink-400 flex items-center gap-1">
          ⭐ 推荐
        </div>
      )}
      {/* 媒体预览 */}
      {media.length > 0 && (
        <div className={`grid gap-0.5 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {media.slice(0, 2).map((url, i) => (
            <div key={i} className="relative aspect-square bg-white/5 overflow-hidden">
              {!imgError && (
                <Image src={url} alt="" fill className="object-cover"
                  onError={() => setImgError(true)} unoptimized />
              )}
              {imgError && (
                <div className="absolute inset-0 flex items-center justify-center text-white/10 text-3xl">📷</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 信息区 */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
            {girl.avatar_url && !imgError ? (
              <Image src={girl.avatar_url} alt="" width={40} height={40} className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 text-lg">👤</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">{girl.display_name || `@${girl.twitter_username}`}</span>
              {girl.threshold && (
                <span className="text-pink-400 text-xs font-bold">🚪{girl.threshold}</span>
              )}
            </div>
            <p className="text-white/30 text-xs mt-0.5">@{girl.twitter_username}</p>
          </div>
        </div>

        {girl.bio && (
          <p className="text-white/50 text-xs mt-3 leading-relaxed line-clamp-2">{girl.bio}</p>
        )}

        {/* 评分 + 投诉 */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <ScoreBadge score={girl.score} />
          {girl.score_detail?.complaints > 0 && (
            <span className="badge bg-red-400/10 border border-red-400/20 text-red-400">
              🚨 {girl.score_detail.complaints} 条吐槽
            </span>
          )}
          {girl.score_detail?.positives > 0 && (
            <span className="badge bg-green-400/10 border border-green-400/20 text-green-400">
              👍 {girl.score_detail.positives} 好评
            </span>
          )}
        </div>

        {/* 操作 */}
        <div className="flex items-center gap-2 mt-3">
          <a href={`https://x.com/${girl.twitter_username}`} target="_blank" rel="noopener noreferrer"
            className="btn btn-pink text-xs flex-1 text-center">
            🐦 查看 X 主页
          </a>
          <button onClick={handleLike}
            className={`btn btn-ghost text-xs flex items-center gap-1 ${liked ? 'text-pink-400' : ''}`}>
            {liked ? '❤️' : '🤍'} {likeCount}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CityPage() {
  const { city } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = searchParams.get('lang') || 'zh'
  const [girls, setGirls] = useState<Girl[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/search?city=${city}&lang=${lang}`)
      .then(r => r.json())
      .then(d => { setGirls(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [city, lang])

  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 sticky top-0 z-10"
        style={{ background: '#0e0e10' }}>
        <button onClick={() => router.push('/')} className="text-white/40 hover:text-white text-sm">← 返回</button>
        <span className="text-white font-semibold">{CITY_LABELS[city as string] || city}</span>
        <span className="text-white/20 text-xs ml-auto">{girls.length} 个结果</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/30 text-sm">AI 正在检索中...</p>
          </div>
        ) : girls.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/20 text-4xl mb-4">🔍</p>
            <p className="text-white/30">暂无数据，稍后刷新试试</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {girls.map(g => <GirlCard key={g.id} girl={g} />)}
          </div>
        )}
      </div>
    </main>
  )
}
