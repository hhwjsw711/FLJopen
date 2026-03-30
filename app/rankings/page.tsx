'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiUrl } from '@/lib/apiUrl'
import { THEMES, getTheme, type Theme } from '@/lib/themes'
import { T, getLang, type Lang } from '@/lib/i18n'

// ── 类型 ──
interface RankItem {
  twitter_username: string; display_name: string | null; avatar_url: string | null
  score: number; search_count: number; is_fushi: boolean; is_offline: boolean
  has_threshold: boolean; negative_tags: string[]; comment_count: number; expose_count: number; score_detail: any
  account_language?: string | null
}
interface Category { id: string; label: string; items: RankItem[] }

const PAGE_SIZE = 50

// ── 评分徽章 ──
function ScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'xs' }) {
  const color = score >= 62 ? '#4ade80' : score >= 38 ? '#facc15' : '#f87171'
  return (
    <div className="flex flex-col items-center rounded-md flex-shrink-0"
      style={{ background: `${color}18`, border: `1px solid ${color}44`, minWidth: size === 'sm' ? 38 : 30, padding: size === 'sm' ? '2px 5px' : '1px 4px' }}>
      <span className={`font-black font-mono leading-none ${size === 'sm' ? 'text-sm' : 'text-xs'}`} style={{ color }}>{score}</span>
    </div>
  )
}

// ── 单行用户条目 ──
function RankRow({ item, rank, onClick }: { item: RankItem; rank: number; onClick: () => void }) {
  const accountTags: string[] = item.score_detail?.account_tags || []
  const isFushi = item.is_fushi || accountTags.includes('風俗業者')
  const hasThreshold = item.has_threshold || accountTags.includes('有门槛费')
  const isAV = accountTags.includes('AV女優')
  const isWelfare = accountTags.includes('福利博主')
  const hasComplaint = (item.negative_tags || []).length > 0

  return (
    <div onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-xl transition-all"
      style={{ background: 'rgba(255,255,255,0.0)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.0)')}>

      {/* 排名 */}
      <span className="text-xs font-black flex-shrink-0 w-5 text-center"
        style={{ color: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.2)' }}>
        {rank <= 3 ? ['①','②','③'][rank-1] : rank}
      </span>

      {/* 头像 */}
      <div className="relative flex-shrink-0">
        {item.avatar_url ? (
          <img src={item.avatar_url} className="w-8 h-8 rounded-full object-cover" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(244,63,138,0.15)', border: '1px solid rgba(244,63,138,0.2)' }}>
            {(item.display_name || item.twitter_username)[0]?.toUpperCase()}
          </div>
        )}
        {item.score_detail?.is_manual_verified && <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">🔵</span>}
      </div>

      {/* 名称 + 标签 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-white text-xs font-medium truncate">{item.display_name || `@${item.twitter_username}`}</span>
          {(() => {
            const lang = item.account_language || item.score_detail?.primary_language || ''
            const flag = lang.includes('中') || lang.toLowerCase().includes('zh') ? '🇨🇳' : 
                         lang.includes('日') || lang.toLowerCase().includes('ja') ? '🇯🇵' : 
                         lang.toLowerCase().includes('en') || lang.toLowerCase().includes('英') ? '🇬🇧' : ''
            return flag && <span className="text-[10px] grayscale-[0.2] opacity-70">{flag}</span>
          })()}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>@{item.twitter_username}</span>
          {isFushi && <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>🔞</span>}
          {hasThreshold && <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>🚪</span>}
          {isAV && <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>🎬</span>}
          {isWelfare && <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>📦</span>}
          {hasComplaint && <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>🚨</span>}
        </div>
      </div>

      {/* 评分 */}
      <ScoreBadge score={item.score} size="xs" />
    </div>
  )
}

// ── 分类卡片 ──
function CategoryCard({ cat, onViewAll, onUserClick }: { cat: Category; onViewAll: () => void; onUserClick: (u: string) => void }) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* 卡片头 */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
        <span className="text-sm font-bold text-white">{cat.label}</span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>TOP {cat.items.length}</span>
      </div>

      {/* 列表 */}
      <div className="flex-1 py-1">
        {cat.items.length === 0 ? (
          <p className="text-center py-8 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>暂无数据</p>
        ) : (
          cat.items.map((item, idx) => (
            <RankRow key={item.twitter_username} item={item} rank={idx + 1} onClick={() => onUserClick(item.twitter_username)} />
          ))
        )}
      </div>

      {/* 查看全部按钮 */}
      <div className="px-3 pb-3 pt-1">
        <button onClick={onViewAll}
          className="w-full py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: 'rgba(244,63,138,0.2)', color: '#f43f8a', border: '1px solid rgba(244,63,138,0.25)' }}>
          查看全部 →
        </button>
      </div>
    </div>
  )
}

// ── 全量列表视图 ──
function FullListView({ catId, catLabel, onBack }: { catId: string; catLabel: string; onBack: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState<RankItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(apiUrl(`/api/rankings?category=${catId}&page=${page}`))
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0) })
      .finally(() => setLoading(false))
  }, [catId, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>← 返回</button>
        <span className="text-white font-bold">{catLabel}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{total > 0 ? `共 ${total} 个账号` : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const rank = (page - 1) * PAGE_SIZE + idx + 1
            const accountTags: string[] = item.score_detail?.account_tags || []
            const isFushi = item.is_fushi || accountTags.includes('風俗業者')
            const hasThreshold = item.has_threshold || accountTags.includes('有门槛费')
            const isAV = accountTags.includes('AV女優')
            const isWelfare = accountTags.includes('福利博主')
            const hasComplaint = (item.negative_tags || []).length > 0
            return (
              <div key={item.twitter_username}
                onClick={() => router.push(`/verify/${item.twitter_username}?source=rankings`)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                <span className="text-sm font-black flex-shrink-0 w-6 text-center"
                  style={{ color: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'rgba(255,255,255,0.2)' }}>
                  {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}
                </span>
                {item.avatar_url ? (
                  <img src={item.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(244,63,138,0.15)', border: '1px solid rgba(244,63,138,0.2)' }}>
                    {(item.display_name || item.twitter_username)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white text-sm font-semibold truncate">{item.display_name || `@${item.twitter_username}`}</span>
                    {hasComplaint && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>🚨 有投诉</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>@{item.twitter_username}</span>
                    {isFushi && <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>🔞</span>}
                    {hasThreshold && <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>🚪</span>}
                    {isAV && <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>🎬 AV</span>}
                    {isWelfare && <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>📦 卖图</span>}
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>👁 {item.search_count}</span>
                    {(catId === 'comments' ? item.expose_count : item.comment_count) > 0 && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{catId === 'comments' ? `🔥 ${item.expose_count}` : `💬 ${item.comment_count}`}</span>}
                  </div>
                </div>
                <ScoreBadge score={item.score} />
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-20"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>← 上一页</button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = totalPages <= 5 ? i+1 : page <= 3 ? i+1 : page >= totalPages-2 ? totalPages-4+i : page-2+i
            return (
              <button key={p} onClick={() => setPage(p)}
                className="w-9 h-9 rounded-lg text-sm font-medium"
                style={{ background: page===p ? 'rgba(244,63,138,0.25)' : 'rgba(255,255,255,0.06)', color: page===p ? '#f43f8a' : 'rgba(255,255,255,0.4)' }}>
                {p}
              </button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-20"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>下一页 →</button>
        </div>
      )}
    </div>
  )
}

interface CityItem { city: string; count: number }

// ── 城市列表视图 ──
function CityListView({ city, onBack }: { city: string; onBack: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState<RankItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(apiUrl(`/api/rankings?city=${encodeURIComponent(city)}&page=${page}`))
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0) })
      .finally(() => setLoading(false))
  }, [city, page])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>← 返回</button>
        <span className="text-white font-bold">📍 {city}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{total > 0 ? `共 ${total} 人` : ''}</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const rank = (page - 1) * 50 + idx + 1
            const tags: string[] = item.score_detail?.account_tags || []
            const isFushi = item.is_fushi || tags.includes('風俗業者')
            const hasThreshold = item.has_threshold || tags.includes('有门槛费')
            const hasComplaint = (item.negative_tags || []).length > 0
            return (
              <div key={item.twitter_username}
                onClick={() => router.push(`/verify/${item.twitter_username}?source=rankings`)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                <span className="text-sm font-black w-6 text-center flex-shrink-0"
                  style={{ color: rank===1?'#FFD700':rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.2)' }}>
                  {rank<=3?['🥇','🥈','🥉'][rank-1]:rank}
                </span>
                {item.avatar_url ? (
                  <img src={item.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(244,63,138,0.15)', border: '1px solid rgba(244,63,138,0.2)' }}>
                    {(item.display_name || item.twitter_username)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white text-sm font-semibold truncate">{item.display_name || `@${item.twitter_username}`}</span>
                    {hasComplaint && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background:'rgba(239,68,68,0.2)',color:'#f87171' }}>🚨</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color:'rgba(255,255,255,0.25)' }}>@{item.twitter_username}</span>
                    {isFushi && <span className="text-[10px] px-1.5 rounded-full" style={{ background:'rgba(139,92,246,0.15)',color:'#a78bfa' }}>🔞</span>}
                    {hasThreshold && <span className="text-[10px] px-1.5 rounded-full" style={{ background:'rgba(245,158,11,0.12)',color:'#fbbf24' }}>🚪</span>}
                  </div>
                </div>
                <ScoreBadge score={item.score} />
              </div>
            )
          })}
          {items.length === 0 && <p className="text-center py-16 text-sm" style={{ color:'rgba(255,255,255,0.15)' }}>暂无数据</p>}
        </div>
      )}
      {Math.ceil(total/50) > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page<=1}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-20" style={{ background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)' }}>← 上一页</button>
          <button onClick={() => setPage(p=>Math.min(Math.ceil(total/50),p+1))} disabled={page>=Math.ceil(total/50)}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-20" style={{ background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)' }}>下一页 →</button>
        </div>
      )}
    </div>
  )
}

// ── 主页面 ──
export default function RankingsWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e0e10' }}>
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RankingsPage />
    </Suspense>
  )
}

function RankingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [overview, setOverview] = useState<Category[]>([])
  const [cities, setCities] = useState<CityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'rankings' | 'city'>('rankings')
  const [activeCat, setActiveCat] = useState<{ id: string; label: string } | null>(
    searchParams.get('cat') ? { id: searchParams.get('cat')!, label: '' } : null
  )
  const [activeCity, setActiveCity] = useState<string | null>(searchParams.get('city') || null)

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/rankings/overview')).then(r => r.json()),
      fetch(apiUrl('/api/rankings/cities')).then(r => r.json()),
    ]).then(([overview, cities]) => {
      if (Array.isArray(overview)) {
        setOverview(overview)
        const cat = searchParams.get('cat')
        if (cat) {
          const found = overview.find((c: Category) => c.id === cat)
          if (found) setActiveCat({ id: found.id, label: found.label })
        }
      }
      if (Array.isArray(cities)) setCities(cities)
      if (searchParams.get('city')) setActiveTab('city')
    }).finally(() => setLoading(false))
  }, [])

  function openCat(id: string, label: string) {
    setActiveCat({ id, label }); setActiveCity(null)
    window.history.pushState({}, '', `/rankings?cat=${id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCity(city: string) {
    setActiveCity(city); setActiveCat(null)
    window.history.pushState({}, '', `/rankings?city=${encodeURIComponent(city)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setActiveCat(null); setActiveCity(null)
    window.history.pushState({}, '', '/rankings')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen" style={{ background: '#0e0e10' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5"
        style={{ background: 'rgba(14,14,16,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-sm transition-colors flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>← 首页</button>
          <span className="text-white font-bold">🏆 排行榜</span>
        </div>
        {/* Tab 切换：排行榜 / 按城市 */}
        {!activeCat && !activeCity && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2">
            <button onClick={() => setActiveTab('rankings')}
              className="text-sm px-4 py-1.5 rounded-full font-medium transition-all"
              style={{ background: activeTab==='rankings' ? 'rgba(244,63,138,0.2)' : 'rgba(255,255,255,0.05)', color: activeTab==='rankings' ? '#f43f8a' : 'rgba(255,255,255,0.35)', border: activeTab==='rankings' ? '1px solid rgba(244,63,138,0.3)' : '1px solid transparent' }}>
              🏆 排行榜
            </button>
            <button onClick={() => setActiveTab('city')}
              className="text-sm px-4 py-1.5 rounded-full font-medium transition-all"
              style={{ background: activeTab==='city' ? 'rgba(244,63,138,0.2)' : 'rgba(255,255,255,0.05)', color: activeTab==='city' ? '#f43f8a' : 'rgba(255,255,255,0.35)', border: activeTab==='city' ? '1px solid rgba(244,63,138,0.3)' : '1px solid transparent' }}>
              📍 按城市找
            </button>
          </div>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeCat ? (
          <FullListView catId={activeCat.id} catLabel={activeCat.label} onBack={goBack} />
        ) : activeCity ? (
          <CityListView city={activeCity} onBack={goBack} />
        ) : activeTab === 'city' ? (
          /* 城市选择网格 */
          <div>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.25)' }}>选择城市，查看该城市下的账号（按评分排序）</p>
            <div className="flex flex-wrap gap-3">
              {cities.map(({ city, count }) => (
                <button key={city} onClick={() => openCity(city)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(244,63,138,0.15)'; e.currentTarget.style.borderColor='rgba(244,63,138,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}>
                  <span className="text-base">📍</span>
                  <span className="text-sm">{city}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)' }}>{count}</span>
                </button>
              ))}
              {cities.length === 0 && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>暂无城市数据</p>
              )}
            </div>
          </div>
        ) : (
          /* 多栏卡片网格 */
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {overview.map(cat => (
              <CategoryCard key={cat.id} cat={cat}
                onViewAll={() => openCat(cat.id, cat.label)}
                onUserClick={u => router.push(`/verify/${u}?source=rankings`)} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 py-10 text-center text-sm border-t border-white/5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <p className="mb-2">AI驱动的X/Twitter账号可信度分析平台</p>
          <p>
            <a href="https://x.com/iam678" target="_blank" rel="noopener noreferrer"
              className="font-semibold text-pink-400 underline underline-offset-4 hover:opacity-80 transition-opacity">
              produced by @iam678
            </a>
          </p>
          <p className="mt-4">
            <a href="/" className="text-xs opacity-50">🏠 返回首页</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
