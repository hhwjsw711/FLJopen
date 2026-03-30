'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { THEMES, getTheme } from '@/lib/themes'

const TABS = [
  { id: 'latest', label: '🕐 最新' },
  { id: 'hot', label: '🔥 最热' },
  { id: 'controversial', label: '⚡ 争议' },
]

const PAGE_SIZE = 10

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 62 ? '#4ade80' : score >= 38 ? '#facc15' : '#f87171'
  return <span className="font-black font-mono text-xs" style={{ color }}>{score}</span>
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

export default function BoomPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState('latest')
  const [categoryFilter, setCategoryFilter] = useState('')
  const EXPOSE_CATEGORIES = ['日常爆料', '被骗经历', '门槛爆料', '同行互撕', '金主哭诉']
  const [tgUser, setTgUser] = useState<{ first_name: string; photo_url?: string; is_member?: boolean } | null>(null)
  const [userPoints, setUserPoints] = useState<number | null>(null)
  const [userRank, setUserRank] = useState<string | null>(null)
  const [isModerator, setIsModerator] = useState(false)
  const [showExposeModal, setShowExposeModal] = useState(false)
  const [exposeUsername, setExposeUsername] = useState('')
  const [exposeContent, setExposeContent] = useState('')
  const [exposeSubmitting, setExposeSubmitting] = useState(false)
  const [exposeMsg, setExposeMsg] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [modalOpenedAt, setModalOpenedAt] = useState(0)
  const [exposeImages, setExposeImages] = useState<string[]>([])
  const [exposeCategory, setExposeCategory] = useState('日常爆料')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [today, setToday] = useState(0)
  const [hidden, setHidden] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const c = THEMES[theme]
  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { setTheme(getTheme() as 'dark' | 'light') }, [])

  useEffect(() => {
    const saved = localStorage.getItem('flj_tg_user')
    const token = localStorage.getItem('flj_tg_token')
    if (saved && token) {
      setTgUser(JSON.parse(saved))
      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
      fetch(`${base}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.points !== undefined) { setUserPoints(d.points); setUserRank(d.rank); setIsModerator(!!d.is_moderator) } }).catch(() => {})
    }
  }, [])

  function logout() {
    localStorage.removeItem('flj_tg_user')
    localStorage.removeItem('flj_tg_token')
    setTgUser(null)
    setUserPoints(null)
    setUserRank(null)
    setIsModerator(false)
  }

  const fetchData = useCallback(async (t: string, p: number, cat?: string) => {
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const catParam = (cat !== undefined ? cat : categoryFilter) ? `&category=${encodeURIComponent(cat !== undefined ? cat : categoryFilter)}` : ''
      const res = await fetch(`${base}/api/boom?tab=${t}&page=${p}&pageSize=${PAGE_SIZE}${catParam}`)
      const d = await res.json()
      setItems(d.items || [])
      setTotal(d.total || 0)
      setToday(d.today || 0)
      setHidden(d.hidden || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchData(tab, 1, categoryFilter)
  }, [tab, categoryFilter])

  function goPage(p: number) {
    setPage(p)
    fetchData(tab, p, categoryFilter)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || exposeImages.length >= 2) return
    setUploadingImage(true)
    // 立即显示本地预览（不管后续是否压缩成功）
    const localUrl = URL.createObjectURL(file)
    setExposeImages(prev => [...prev, localUrl])
    try {
      // 尝试 canvas 压缩；iOS HEIC 等格式可能失败，失败时直接用原图
      let uploadBlob: Blob = file
      try {
        const compressed = await new Promise<Blob>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            const maxW = 800
            const scale = img.width > maxW ? maxW / img.width : 1
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('no ctx')); return }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(b => {
              // 压缩结果小于 5KB 视为失败，回退原图
              if (b && b.size > 5000) resolve(b)
              else reject(new Error('compression too small'))
            }, 'image/jpeg', 0.75)
          }
          img.onerror = reject
          img.src = localUrl
        })
        uploadBlob = compressed
      } catch {
        // canvas 压缩失败，静默回退到原图上传
      }

      const form = new FormData()
      form.append('file', new File([uploadBlob], 'image.jpg', { type: 'image/jpeg' }))
      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${base}/api/upload`, { method: 'POST', body: form })
      const d = await res.json()
      if (d.url) {
        setExposeImages(prev => prev.map(u => u === localUrl ? d.url : u))
        URL.revokeObjectURL(localUrl)
      } else {
        setExposeImages(prev => prev.filter(u => u !== localUrl))
        URL.revokeObjectURL(localUrl)
        setExposeMsg('图片上传失败，请重试')
      }
    } catch {
      setExposeImages(prev => prev.filter(u => u !== localUrl))
      URL.revokeObjectURL(localUrl)
      setExposeMsg('图片上传失败，请重试')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  async function submitExpose() {
    const username = exposeUsername.trim().replace(/^@/, '')
    if (!username) { setExposeMsg('请输入推特用户名'); return }
    if (exposeContent.trim().length < 10) { setExposeMsg('爆料内容至少10个字'); return }
    setExposeSubmitting(true)
    setExposeMsg('')
    try {
      const tgToken = typeof window !== 'undefined' ? localStorage.getItem('flj_tg_token') || '' : ''
      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
      const res = await fetch(`${base}/api/expose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tgToken ? { Authorization: `Bearer ${tgToken}` } : {}) },
        body: JSON.stringify({
          twitter_username: username,
          content: exposeContent.trim(),
          expose_category: exposeCategory,
          _hp: honeypot,
          _t: Date.now() - modalOpenedAt,
          image_urls: exposeImages,
        }),
      })
      const d = await res.json()
      if (d.ok) {
        setExposeMsg('✅ 爆料已提交！')
        setExposeContent('')
        setExposeUsername('')
        setExposeImages([])
        setExposeCategory('日常爆料')
        setTimeout(() => { setShowExposeModal(false); setExposeMsg(''); fetchData(tab, page, categoryFilter) }, 1500)
      } else {
        setExposeMsg(d.error || '提交失败，请稍后重试')
      }
    } catch {
      setExposeMsg('提交失败，请稍后重试')
    } finally {
      setExposeSubmitting(false)
    }
  }

  async function vote(id: number, v: number) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
    const tgToken = typeof window !== 'undefined' ? localStorage.getItem('flj_tg_token') || '' : ''
    const res = await fetch(`${base}/api/expose/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tgToken ? { Authorization: `Bearer ${tgToken}` } : {}) },
      body: JSON.stringify({ comment_id: id, vote: v }),
    })
    const d = await res.json()
    if (d.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, upvotes: d.upvotes, downvotes: d.downvotes } : i))
    }
  }

  return (
    <div className="min-h-screen" style={{ background: c.bg, color: c.textPrimary }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: c.bg, borderBottom: `1px solid ${c.headerBorder}`, backdropFilter: 'blur(12px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-xl opacity-60 hover:opacity-100">←</button>
            <div>
              <h1 className="text-base font-bold">🔥 爆料广场</h1>
              <p className="text-[10px]" style={{ color: c.textFaint }}>
                今日 +{today} · 共 {total} 条{hidden > 0 && <span style={{ color: 'rgba(239,68,68,0.5)' }}> · 🚫{hidden}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tgUser ? (
              <>
                <div className="flex flex-col items-center">
                  {tgUser.photo_url && <img src={tgUser.photo_url} className="w-7 h-7 rounded-full" alt="" />}
                  {userPoints !== null && !tgUser.is_member && (
                    <span className="text-[9px] font-bold leading-none mt-0.5" style={{ color: '#60a5fa' }}>{userPoints}分</span>
                  )}
                  {tgUser.is_member && (
                    <span className="text-[9px] font-bold leading-none mt-0.5" style={{ color: '#facc15' }}>天龙人</span>
                  )}
                </div>
                <button onClick={logout} className="text-xs px-2 py-1 rounded-lg"
                  style={{ color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.08)' }}>
                  退出
                </button>
              </>
            ) : (
              <a href="/tg-widget.html"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#2AABEE,#229ED9)', color: 'white', textDecoration: 'none' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/></svg>
                登录
              </a>
            )}
            <button onClick={() => { setShowExposeModal(true); setModalOpenedAt(Date.now()) }}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: 'rgba(244,63,138,0.15)', color: '#f43f8a', border: '1px solid rgba(244,63,138,0.3)' }}>
              🔥 我要爆料
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="text-xs px-3 py-1 rounded-full transition-all"
              style={{
                background: tab === t.id ? 'rgba(244,63,138,0.2)' : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#f43f8a' : c.textMuted,
                border: tab === t.id ? '1px solid rgba(244,63,138,0.3)' : '1px solid transparent',
                fontWeight: tab === t.id ? 600 : 400,
              }}>{t.label}</button>
          ))}
          <button onClick={() => setTab('guide')}
            className="text-xs px-3 py-1 rounded-full transition-all ml-auto"
            style={{
              background: tab === 'guide' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
              color: tab === 'guide' ? '#60a5fa' : c.textMuted,
              border: tab === 'guide' ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
            }}>❓ 说明</button>
        </div>
      </div>

      {/* 免责声明 */}
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <div className="flex gap-2 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.75)' }}>
          <span className="flex-shrink-0">⚠️</span>
          <span>爆料广场为用户自主爆料，内容真实性需自行判断。若认为信息不实请点击<b>瞎说</b>，若认为属实请点击<b>坐实了</b>。当瞎说票数比坐实了多出30票以上，该爆料将进入人工审核，由管理员决定是否折叠。每个账号只能评价一次。</span>
        </div>
      </div>

      {/* 分类筛选 pills（说明页不显示） */}
      {tab !== 'guide' && (
        <div className="max-w-3xl mx-auto px-4 pt-2 pb-1">
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCategoryFilter('')}
              className="text-xs px-3 py-1 rounded-full transition-all"
              style={{ background: !categoryFilter ? 'rgba(244,63,138,0.18)' : 'rgba(255,255,255,0.05)', color: !categoryFilter ? '#f43f8a' : c.textMuted, border: !categoryFilter ? '1px solid rgba(244,63,138,0.3)' : '1px solid transparent', fontWeight: !categoryFilter ? 600 : 400 }}>
              全部
            </button>
            {EXPOSE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                className="text-xs px-3 py-1 rounded-full transition-all"
                style={{ background: categoryFilter === cat ? 'rgba(244,63,138,0.18)' : 'rgba(255,255,255,0.05)', color: categoryFilter === cat ? '#f43f8a' : c.textMuted, border: categoryFilter === cat ? '1px solid rgba(244,63,138,0.3)' : '1px solid transparent', fontWeight: categoryFilter === cat ? 600 : 400 }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 说明页 */}
      {tab === 'guide' && (
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 text-sm" style={{ color: c.textMuted }}>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            <h3 className="font-bold text-base text-white">📋 爆料广场使用说明</h3>
            <div className="space-y-2 leading-relaxed">
              <p>爆料广场支持<b className="text-white">匿名爆料</b>，也支持 Telegram 登录后以身份爆料。</p>
              <p>登录 Telegram 后分为两种身份：</p>
              <div className="pl-3 space-y-1">
                <p><span className="text-yellow-400 font-bold">⭐ 天龙人</span> — 高级频道会员，爆料享最高公信力权重</p>
                <p><span className="text-blue-400 font-bold">🔵 居委会</span> — 普通 TG 用户，可通过积分升级</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-4 space-y-2" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            <h3 className="font-bold text-white">💰 居委会积分规则</h3>
            <div className="space-y-1 leading-relaxed">
              <p>• 新注册赠送：<span className="text-green-400 font-bold">+100 分</span></p>
              <p>• 发布爆料需要：<span className="text-yellow-400 font-bold">50 分</span>（不足则无法发布）</p>
              <p>• 每次发布爆料：<span className="text-red-400 font-bold">-50 分</span></p>
              <p>• 每次投票（坐实了/瞎说）：<span className="text-green-400 font-bold">+1 分</span></p>
              <p>• 爆料获得第 11 次及以上「坐实了」：<span className="text-green-400 font-bold">每次 +1 分</span></p>
              <p>• 爆料累计获得 100 次「坐实了」：额外奖励 <span className="text-green-400 font-bold">+500 分</span></p>
              <p>• 爆料被判定 10 次「瞎说」：不退分</p>
              <p className="text-xs pt-2 text-yellow-400/70">⭐ 天龙人无积分限制，始终可以发布爆料</p>
              <p className="text-xs" style={{ color: c.textFaint }}>※ 积分鼓励大家发布有价值的真实信息，瞎说内容将被社区淘汰</p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            <h3 className="font-bold text-white mb-2">🏅 等级与投票权重</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['居委会','0','1 票'],
                ['副科','1,000','2 票'],
                ['正科','3,000','4 票'],
                ['副处','5,000','8 票'],
                ['正处','10,000','10 票'],
                ['副厅','20,000','15 票'],
                ['正厅','50,000','20 票'],
                ['副部','100,000','25 票'],
                ['正部','500,000','30 票'],
                ['⭐ 天龙人','会员','30 票'],
              ].map(([rank, pts, weight]) => (
                <div key={rank} className="flex justify-between px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className={rank.includes('⭐') ? 'text-yellow-400 font-bold' : 'text-blue-400 font-medium'}>{rank}</span>
                  <span className="font-bold text-white/80">{weight}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2 px-1" style={{ color: c.textFaint }}>等级越高，点击「坐实了」或「瞎说」时的投票权重越大。</p>
          </div>

          <div className="rounded-2xl p-4 space-y-1" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            <h3 className="font-bold text-white mb-2">⚖️ 爆料可信度规则</h3>
            <p>• 坐实了与瞎说票差低于 -30 → 进入人工审核队列</p>
            <p>• 管理员确认后才会折叠，误判可随时恢复</p>
            <p>• 个人投票权重随等级提升，最高单次可投 30 票</p>
            <p>• 天龙人爆料的「最热」排序权重是普通用户的 2 倍</p>
            <p>• 每个 IP 账号只能对同一条爆料评价一次</p>
          </div>

          <div className="rounded-2xl p-5 space-y-3 leading-relaxed"
            style={{ background: 'rgba(244,63,138,0.04)', border: '1px solid rgba(244,63,138,0.12)' }}>
            <h3 className="font-bold text-white flex items-center gap-2">💬 来自作者的话</h3>
            <p>这个项目的初衷，是让大家不要被各种黄推和诈骗账号欺骗。很多人入门没有参考，很多人想约线下心里没有底气。</p>
            <p>爆料广场看起来是个真实经历与恶意造谣混杂的是非之地——但只要能劝退一些在消费上犹豫不决的人，帮他们避免一次金钱损失，这个项目的使命也就达到了。</p>
            <p style={{ color: c.textFaint }}>至于是福利姬为了宣传瞎写，是同行之间相互诋毁，还是仇家眼红搞事——<span style={{ color: c.textMuted }}>不傻的人自有明辨是非的能力。</span></p>
            <p>爆料是真是假，每个人都有权参与投票。我加入的点评系统，就是把这个判断权交还给人民群众。</p>
            <p className="font-medium" style={{ color: '#f43f8a' }}>人民群众的眼睛是雪亮的。爆料是否真实、是否有价值、是否值得留存以警醒后人——就让时间和大众来检验吧。</p>
          </div>
        </div>
      )}

      {/* 卡片列表 */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3" style={{ display: tab === 'guide' ? 'none' : undefined }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: c.textFaint }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center" style={{ opacity: 0.3 }}>
            <p className="text-4xl mb-3">🔥</p>
            <p className="text-sm">还没有爆料</p>
          </div>
        ) : items.map(item => {
          const score = (item.upvotes || 0) - (item.downvotes || 0)
          const isScam = Array.isArray(item.negative_tags) && item.negative_tags.includes('scam')
          return (
            <div key={item.id} className="rounded-2xl p-4"
              style={{ background: c.sectionBg, border: `1px solid rgba(239,68,68,0.15)` }}>

              {/* 顶部：匿名爆料人 + 时间 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'rgba(244,63,138,0.15)', border: '1px solid rgba(244,63,138,0.25)' }}>
                  🕵️
                </div>
                <span className="text-xs font-medium" style={{ color: c.textMuted }}>
                  {item.user_tier === 'member' ? '⭐ 天龙人爆料' : item.user_tier === 'tg_user' ? '🔵 居委会爆料' : '匿名用户爆料'}
                </span>
                {item.user_tier === 'member' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1"
                    style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)' }}>
                    天龙人
                  </span>
                )}
                {item.user_tier === 'tg_user' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1"
                    style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                    {(item as any).user_rank ?? '居委会'}
                  </span>
                )}
                {item.expose_category && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1"
                    style={{ background: 'rgba(244,63,138,0.1)', color: 'rgba(244,63,138,0.8)', border: '1px solid rgba(244,63,138,0.2)' }}>
                    {item.expose_category}
                  </span>
                )}
                <span className="text-[10px] ml-auto" style={{ color: c.textFaint }}>{timeAgo(item.created_at)}</span>
              </div>

              {/* 爆料内容 */}
              <p className="text-sm leading-relaxed mb-3"
                style={{ color: c.textPrimary }}>
                {item.content}
              </p>

              {/* 审核通过的图片 */}
              {item.image_urls?.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {item.image_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-24 h-24 rounded-xl object-cover"
                        style={{ border: `1px solid ${c.cardBorder}` }} />
                    </a>
                  ))}
                </div>
              )}
              {/* 待审核提示（仅投稿人可见，实际无法区分，简单加状态标记即可） */}

              {/* 被曝光账号引用块 */}
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.cardBorder}` }}
                onClick={() => router.push(`/verify/${item.twitter_username}`)}>
                <span className="text-[10px] flex-shrink-0" style={{ color: c.textFaint }}>曝光对象</span>
                <div className="w-px h-3 flex-shrink-0" style={{ background: c.cardBorder }} />
                {item.avatar_url
                  ? <img src={item.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs" style={{ background: c.tagBg }}>👤</div>
                }
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold truncate" style={{ color: c.textPrimary }}>
                    {item.display_name || item.twitter_username}
                  </span>
                  <span className="text-[11px] truncate" style={{ color: c.textFaint }}>@{item.twitter_username}</span>
                  {item.score != null && <ScoreBadge score={item.score} />}
                  {isScam && <span className="text-[9px] px-1 rounded font-bold flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>🚨诈骗</span>}
                </div>
                <span className="text-[11px] flex-shrink-0" style={{ color: c.accentText }}>→</span>
              </div>

              {/* 纪检委折叠按钮 */}
              {isModerator && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={async () => {
                      if (!confirm('确认折叠这条爆料？')) return
                      const token = localStorage.getItem('flj_tg_token')
                      const base = process.env.NEXT_PUBLIC_BASE_PATH || ''
                      const res = await fetch(`${base}/api/boom/moderate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ comment_id: item.id })
                      })
                      if (res.ok) setItems(prev => prev.filter(i => i.id !== item.id))
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                    style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
                    🛡️ 折叠违规
                  </button>
                </div>
              )}

              {/* 投票行 */}
              <div className="flex items-center gap-2">
                <button onClick={() => vote(item.id, 1)}
                  className="flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ fontSize: 12, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  👍 坐实了 {item.upvotes || 0}
                </button>
                <button onClick={() => vote(item.id, -1)}
                  className="flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  👎 瞎说 {item.downvotes || 0}
                </button>
                {score > 0 && <span className="text-[11px] ml-1" style={{ color: '#4ade80', opacity: 0.7 }}>+{score} 已坐实</span>}
              </div>
            </div>
          )
        })}

        {/* 翻页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2 pb-4">
            <button onClick={() => goPage(page - 1)} disabled={page <= 1}
              className="text-xs px-4 py-2 rounded-xl transition-all"
              style={{ background: c.sectionBg, color: c.textMuted, border: `1px solid ${c.cardBorder}`, opacity: page <= 1 ? 0.4 : 1 }}>
              ← 上一页
            </button>
            <span className="text-xs" style={{ color: c.textFaint }}>{page} / {totalPages}</span>
            <button onClick={() => goPage(page + 1)} disabled={page >= totalPages}
              className="text-xs px-4 py-2 rounded-xl transition-all"
              style={{ background: c.sectionBg, color: c.textMuted, border: `1px solid ${c.cardBorder}`, opacity: page >= totalPages ? 0.4 : 1 }}>
              下一页 →
            </button>
          </div>
        )}
      </div>
      {/* 爆料弹窗 */}
      {showExposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowExposeModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: c.sectionBg, border: `1px solid ${c.cardBorder}` }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">🔥 匿名爆料</h2>
              <button onClick={() => setShowExposeModal(false)} style={{ color: c.textFaint }}>✕</button>
            </div>
            {tgUser ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{
                  background: (tgUser as any).is_member ? 'rgba(250,204,21,0.1)' : 'rgba(96,165,250,0.1)',
                  border: (tgUser as any).is_member ? '1px solid rgba(250,204,21,0.2)' : '1px solid rgba(96,165,250,0.2)',
                  color: (tgUser as any).is_member ? '#facc15' : '#60a5fa'
                }}>
                {tgUser.photo_url && <img src={tgUser.photo_url} className="w-5 h-5 rounded-full" alt="" />}
                {(tgUser as any).is_member ? '⭐ 天龙人' : '🔵 居委会'} · 以 <b>{tgUser.first_name}</b> 身份匿名爆料
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.cardBorder}`, color: c.textFaint }}>
                👤 匿名爆料 · <a href="/tg-widget.html" style={{ color: c.accentText }}>登录后显示会员标签</a>
              </div>
            )}

            {/* 蜜罐（机器人陷阱，人眼不可见） */}
            <input tabIndex={-1} aria-hidden="true" value={honeypot} onChange={e => setHoneypot(e.target.value)}
              style={{ position: 'absolute', left: -9999, opacity: 0, height: 0, pointerEvents: 'none' }}
              autoComplete="off" name="website" />

            {/* 爆料分类（必选） */}
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: c.textMuted }}>爆料分类 <span style={{ color: '#f87171' }}>*</span></label>
              <div className="flex flex-wrap gap-2">
                {EXPOSE_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setExposeCategory(cat)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    style={{ background: exposeCategory === cat ? 'rgba(244,63,138,0.2)' : 'rgba(255,255,255,0.05)', color: exposeCategory === cat ? '#f43f8a' : c.textMuted, border: exposeCategory === cat ? '1px solid rgba(244,63,138,0.4)' : `1px solid ${c.cardBorder}`, fontWeight: exposeCategory === cat ? 600 : 400 }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 用户名输入 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: c.textMuted }}>推特用户名（不用加 @）</label>
              <input
                value={exposeUsername}
                onChange={e => setExposeUsername(e.target.value)}
                placeholder="例如：meihui2005"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none placeholder:opacity-50"
                style={{ background: c.inputBg, border: `1px solid ${c.inputBorder}`, color: c.textPrimary }}
              />
            </div>

            {/* 爆料内容 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: c.textMuted }}>爆料内容（至少10字）</label>
              <textarea
                value={exposeContent}
                onChange={e => setExposeContent(e.target.value)}
                placeholder="说说你的经历或知道的黑料..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none placeholder:opacity-50"
                style={{ background: c.inputBg, border: `1px solid ${c.inputBorder}`, color: c.textPrimary }}
              />
              <p className="text-xs mt-1.5" style={{ color: c.textMuted }}>
                匿名提交 · 每IP每天限5条 · 内容公开展示
              </p>
            </div>

            {/* 图片上传 */}
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: c.textMuted }}>附图（最多2张{tgUser ? '，登录用户免审核直接公开' : '，审核通过后公开'}）</label>
              <div className="flex gap-2 flex-wrap">
                {exposeImages.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden" style={{ border: `1px solid ${c.cardBorder}` }}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setExposeImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>×</button>
                  </div>
                ))}
                {exposeImages.length < 2 && (
                  <label className="w-20 h-20 rounded-lg flex flex-col items-center justify-center cursor-pointer gap-1"
                    style={{ border: `1px dashed ${c.cardBorder}`, color: c.textFaint, background: c.inputBg }}>
                    {uploadingImage ? <span className="text-xs">上传中...</span> : <>
                      <span className="text-xl">📷</span>
                      <span className="text-[10px]">添加图片</span>
                    </>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: c.textFaint }}>图片经压缩处理，需人工审核后展示</p>
            </div>

            {exposeMsg && (
              <p className="text-sm" style={{ color: exposeMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>
                {exposeMsg}
              </p>
            )}

            <button onClick={submitExpose} disabled={exposeSubmitting}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: exposeSubmitting ? 'rgba(244,63,138,0.3)' : 'rgba(244,63,138,0.85)', color: '#fff', opacity: exposeSubmitting ? 0.7 : 1 }}>
              {exposeSubmitting ? '提交中...' : '🔥 提交爆料'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
