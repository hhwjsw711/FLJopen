'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { T, getLang, setLangStorage, type Lang } from '@/lib/i18n'
import { THEMES, getTheme, type Theme } from '@/lib/themes'

interface ScoreDetail {
  complaints: number; positives: number; detail: string
  display_name: string | null; bio: string | null; avatar_url: string | null
  media_urls: string[]; is_active: boolean | null
  engagement: 'high' | 'medium' | 'low' | null
  recent_posts: string[]; location: string | null; using_proxy: boolean | null
  is_verified?: boolean; is_manual_verified?: boolean; followers?: number; following?: number; tweets?: number; account_age_years?: number
}
interface Result { score: number; score_detail: ScoreDetail; display_name: string | null; bio: string | null; avatar_url: string | null; media_urls: string[]; cached: boolean; twitter_username: string }

function fmt(n: number | null) {
  if (n == null || n === 0) return '-'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export default function VerifyPage() {
  const { username } = useParams<{ username: string }>()
  const router = useRouter()
  const searchParamsHook = useSearchParams()

  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [tgUser, setTgUser] = useState<any>(null)
  const [pendingResult, setPendingResult] = useState<Result | null>(null)
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)
  const [myVote, setMyVote] = useState<1 | -1 | null>(null)
  const [voteStats, setVoteStats] = useState<{ vote_score: number; trust_count: number; fraud_count: number } | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showExposeModal, setShowExposeModal] = useState(false)
  const [exposeContent, setExposeContent] = useState('')
  const [exposeCategory, setExposeCategory] = useState('日常爆料')
  const [exposeImages, setExposeImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [exposeSent, setExposeSent] = useState(false)
  const [exposeLoading, setExposeLoading] = useState(false)
  const [exposeError, setExposeError] = useState('')
  const EXPOSE_CATEGORIES = ['日常爆料', '被骗经历', '门槛爆料', '同行互撕', '金主哭诉']
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [voting, setVoting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [duration, setDuration] = useState({ min: 3, max: 5 })
  const [restricted, setRestricted] = useState<{ message: string } | null>(null)
  const [remaining, setRemaining] = useState(0)
  const turnstileTokenRef = useRef<string>('')
  const turnstileWidgetId = useRef<string>('')

  // Turnstile：加载脚本并自动执行，token 存入 ref
  const TURNSTILE_SITE_KEY = 'process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY'

  useEffect(() => {
    const renderWidget = () => {
      if (!(window as any).turnstile || !document.getElementById('cf-turnstile-widget')) return
      try {
        turnstileWidgetId.current = (window as any).turnstile.render('#cf-turnstile-widget', {
          sitekey: TURNSTILE_SITE_KEY,
          execution: 'render',           // 渲染后自动执行
          appearance: 'interaction-only',
          callback: (token: string) => { turnstileTokenRef.current = token },
          'expired-callback': () => { turnstileTokenRef.current = '' },
          'error-callback': () => { turnstileTokenRef.current = '' },
        })
      } catch {}
    }

    if ((window as any).turnstile) {
      renderWidget()
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true; script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
    }
  }, [])

  // 等待 Turnstile token，最多等 6 秒；超时则返回空字符串（缓存命中时不影响）
  const getTurnstileToken = (): Promise<string> => {
    return new Promise((resolve) => {
      if (turnstileTokenRef.current) {
        const t = turnstileTokenRef.current
        turnstileTokenRef.current = ''
        return resolve(t)
      }
      let waited = 0
      const poll = setInterval(() => {
        waited += 100
        if (turnstileTokenRef.current) {
          clearInterval(poll)
          const t = turnstileTokenRef.current
          turnstileTokenRef.current = ''
          resolve(t)
        } else if (waited >= 6000) {
          clearInterval(poll)
          resolve('') // 超时降级，让请求继续（缓存命中不需要 token）
        }
      }, 100)
      // 尝试触发（如果之前没有自动执行）
      try { (window as any).turnstile?.execute?.(turnstileWidgetId.current) } catch {}
    })
  }

  useEffect(() => { 
    setTheme(getTheme())
    fetchSettings()
  }, [])
  const c = THEMES[theme]

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const d = await res.json()
      if (d.search_duration_min) {
        setDuration({ 
          min: parseInt(d.search_duration_min) || 10, 
          max: parseInt(d.search_duration_max) || 20 
        })
      }
    } catch {}
  }

  async function shareProfile() {
    const url = window.location.href
    const text = `🔍 福利鉴 · @${username} 的可信度报告`
    if (navigator.share) {
      try { await navigator.share({ title: text, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'zh'
    const urlLang = searchParamsHook.get('lang') as Lang | null
    if (urlLang && urlLang in T) { setLangStorage(urlLang); return urlLang }
    return getLang()
  })

  const t = T[lang]

  useEffect(() => {
    const saved = localStorage.getItem('flj_tg_user')
    if (saved) setTgUser(JSON.parse(saved))
    fetchComments()

    // 记录 PV
    const tgToken = localStorage.getItem('flj_tg_token') || ''
    fetch('/api/stats/pv', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tgToken}` },
      body: JSON.stringify({ path: `/verify/${username}` })
    }).catch(() => {})

    // 等待 Turnstile token 就绪后再发请求（只等待，不消费 token）
    const waitTurnstile = () => new Promise<void>(resolve => {
      if (turnstileTokenRef.current) return resolve()
      let waited = 0
      const poll = setInterval(() => {
        waited += 100
        if (turnstileTokenRef.current || waited >= 6000) { clearInterval(poll); resolve() }
      }, 100)
      try { (window as any).turnstile?.execute?.(turnstileWidgetId.current) } catch {}
    })
    waitTurnstile().then(() => doFetch())

    // 在线人数统计 Ping
    const ping = () => {
      const token = localStorage.getItem('flj_tg_token') || ''
      fetch('/api/ping', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {})
    }
    ping(); const timer = setInterval(ping, 30000)
    return () => clearInterval(timer)
  }, [username, lang]) // 重点：当语言 lang 改变时，重新触发此效应（包含 doFetch）

  async function fetchComments() {
    try {
      const res = await fetch(`/api/comments?username=${username}`)
      const d = await res.json()
      if (Array.isArray(d)) setComments(d)
    } catch {}
  }

  async function handleExposeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || exposeImages.length >= 2) return
    setUploadingImage(true)
    const localUrl = URL.createObjectURL(file)
    setExposeImages(prev => [...prev, localUrl])
    try {
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
            canvas.toBlob(b => { if (b && b.size > 5000) resolve(b); else reject(new Error('too small')) }, 'image/jpeg', 0.75)
          }
          img.onerror = reject
          img.src = localUrl
        })
        uploadBlob = compressed
      } catch { /* 压缩失败，用原图 */ }
      const form = new FormData()
      form.append('file', new File([uploadBlob], 'image.jpg', { type: 'image/jpeg' }))
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const d = await res.json()
      if (d.url) { setExposeImages(prev => prev.map(u => u === localUrl ? d.url : u)); URL.revokeObjectURL(localUrl) }
      else { setExposeImages(prev => prev.filter(u => u !== localUrl)); URL.revokeObjectURL(localUrl) }
    } catch { setExposeImages(prev => prev.filter(u => u !== localUrl)); URL.revokeObjectURL(localUrl) }
    finally { setUploadingImage(false); e.target.value = '' }
  }

  async function postComment() {
    const token = localStorage.getItem("flj_tg_token")
    if (!token || !commentText.trim()) return
    setIsPosting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ twitter_username: username, content: commentText })
      })
      const d = await res.json()
      if (d.ok) {
        setCommentText("")
        fetchComments()
      } else {
        alert(d.error || "发布失败")
      }
    } catch { alert("网络错误") }
    setIsPosting(false)
  }

  function logout() {
    localStorage.removeItem("flj_tg_token"); localStorage.removeItem("flj_tg_user")
    setTgUser(null); router.push("/")
  }

  const doFeedback = async (type: 'like' | 'dislike') => {
    if (feedback) return
    setFeedback(type)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, type })
    })
  }

  // 加载投票状态
  useEffect(() => {
    if (!username) return
    const token = localStorage.getItem('flj_tg_token') || ''
    fetch(`/api/vote?username=${username}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).then(r => r.json()).then(d => {
      setVoteStats({ vote_score: d.vote_score, trust_count: d.trust_count, fraud_count: d.fraud_count })
      if (d.my_vote !== null) setMyVote(d.my_vote)
    }).catch(() => {})
  }, [username])

  const doVote = async (v: 1 | -1) => {
    if (!tgUser || voting) return
    setVoting(true)
    const token = localStorage.getItem('flj_tg_token') || ''
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username, vote: v })
    })
    const d = await res.json()
    if (d.ok) {
      setMyVote(v)
      setVoteStats({ vote_score: d.vote_score, trust_count: d.trust_count, fraud_count: d.fraud_count })
    }
    setVoting(false)
  }

  const runFakeProgress = (waitMs: number, onDone: () => void) => {
    const interval = 80
    const steps = waitMs / interval
    let step = 0
    const timer = setInterval(() => {
      step++
      const pct = step < steps * 0.7 ? (step / (steps * 0.7)) * 70 : step < steps * 0.95 ? 70 + ((step - steps * 0.7) / (steps * 0.25)) * 25 : 95 + ((step - steps * 0.95) / (steps * 0.05)) * 5
      setProgress(Math.min(Math.round(pct), 99))
      if (step >= steps) { clearInterval(timer); setProgress(100); setTimeout(onDone, 300) }
    }, interval)
    return timer
  }

  const doFetch = async (refresh = false) => {
    setLoading(true); setError(''); setProgress(0); setPendingResult(null)
    let realStep = 0
    let fetchDone = false
    const realTimer = setInterval(() => { if (!fetchDone) { realStep++; setProgress(Math.min(Math.round((realStep / 450) * 92), 92)) } }, 80)
    try {
      const tgToken = localStorage.getItem('flj_tg_token') || ''
      const source = searchParamsHook.get('source') || 'search'
      let cfToken = ''
      try { cfToken = await getTurnstileToken() } catch {}
      const res = await fetch(`/api/verify?username=${username}&t=${Date.now()}&lang=${lang}&source=${source}${refresh ? '&refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${tgToken}`, 'x-turnstile-token': cfToken }
      })
      if (res.status === 403) {
        clearInterval(realTimer)
        setError('turnstile_failed')
        setLoading(false)
        return
      }
      if (res.status === 429) {
        clearInterval(realTimer)
        const d = await res.json().catch(() => ({}))
        if (d.error === 'too_fast') {
          setRemaining(d.remaining || 180)
          setError('too_fast')
        } else if (d.error === 'global_busy') {
          setError('global_busy')
        } else {
          setError('rate_limit')
        }
        setLoading(false)
        return
      }
      if (res.status === 503) {
        const d = await res.json().catch(() => ({}))
        if (d.error === 'grok_quota_exceeded') {
          clearInterval(realTimer)
          setError('busy')
          setLoading(false)
          return
        }
      }
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      fetchDone = true; clearInterval(realTimer)

      // 限制曝光：显示自定义文本，倒计时后跳回首页
      if (data.restricted) {
        setRestricted({ message: data.restricted_message || '该账号已申请限制曝光。' })
        setLoading(false)
        const waitS = duration.min + Math.floor(Math.random() * (duration.max - duration.min + 1))
        setTimeout(() => { window.location.href = '/' }, waitS * 1000)
        return
      }

      if (data.cached) {
        setProgress(0)
        const waitS = duration.min + Math.floor(Math.random() * (duration.max - duration.min + 1))
        runFakeProgress(waitS * 1000, () => { setResult(data); setLoading(false) })
      } else { setProgress(100); setTimeout(() => { setResult(data); setLoading(false) }, 300) }
    } catch { clearInterval(realTimer); setError('检索失败，请稍后重试'); setLoading(false) }
  }

  const d = result?.score_detail
  const score = result?.score || 0
  const scoreColor = score >= 62 ? '#4ade80' : score >= 38 ? '#facc15' : '#f87171'
  const scoreEmoji = score >= 62 ? '✅' : score >= 38 ? '⚠️' : '🚨'
  const scoreLabel = score >= 62 ? t.score_label_green : score >= 38 ? t.score_label_yellow : t.score_label_red
  const displayName = result?.display_name || d?.display_name || username
  const bio = result?.bio || d?.bio
  const avatar = result?.avatar_url || d?.avatar_url
  const media = (result?.media_urls?.length ? result.media_urls : d?.media_urls) || []

  const fRaw = (result as any)?.followers ?? (d as any)?.followers ?? 0
  const tRaw = (result as any)?.tweets ?? (d as any)?.tweets ?? 0
  const ageYears = (result as any)?.account_age_years ?? (d as any)?.account_age_years
  const ageLabel = ageYears == null ? '未知' : ageYears >= 1 ? `${Math.floor(ageYears)}年` : `${Math.round(ageYears * 12)}个月`

  const scoreItems = [
    { label: t.score_base, value: 20 },
    { label: `${t.score_age}（${ageLabel}）`, value: ageYears == null ? 0 : ageYears < 0.25 ? -5 : ageYears < 0.5 ? 2 : ageYears < 1 ? 4 : Math.min(25, Math.floor(ageYears) * 3) },
    { label: `${t.score_followers}${fRaw > 0 ? `（${fmt(fRaw)}）` : ''}`, value: fRaw > 0 ? Math.min(20, Math.max(0, Math.round((Math.log10(Math.max(1, fRaw)) - 2) * 5))) : 0 },
    { label: `${t.score_tweets}${tRaw > 0 ? `（${fmt(tRaw)}）` : ''}`, value: tRaw > 0 ? Math.min(8, Math.max(0, Math.round((Math.log10(Math.max(1, tRaw)) - 1.5) * 4))) : 0 },
    { label: t.score_verified, value: (d as any)?.is_verified ? 10 : 0 },
    { label: t.score_active, value: d?.is_active ? 5 : 0 },
    { label: `${t.score_engagement}（${d?.engagement === 'high' ? t.engage_high : d?.engagement === 'medium' ? t.engage_mid : d?.engagement === 'low' ? t.engage_low : '-'}）`, value: d?.engagement === 'high' ? 8 : d?.engagement === 'medium' ? 4 : 0 },
    { label: `${t.score_positive}${(d?.positives ?? 0) > 0 ? ` ×${d?.positives}` : ''}`, value: (d?.positives ?? 0) > 0 ? 10 : 0 },
    { label: `${t.score_complaint}${(d?.complaints ?? 0) > 0 ? ` ×${d?.complaints}` : ''}`, value: (d?.complaints ?? 0) > 0 ? -8 : 0 },
    ...((d as any)?.complaint_types?.includes('scam')          ? [{ label: '💸 骗钱跑路（严重）', value: -20 }] : []),
    ...((d as any)?.complaint_types?.includes('impersonation') ? [{ label: '🎭 冒充他人（严重）', value: -20 }] : []),
    // fake_gender / stolen_photo 仅显示标签，不计入扣分项
    ...(d?.using_proxy === true ? [{ label: t.score_vpn, value: -5 }] : []),
    ...((d as any)?.pinned_tweet_has_url === true ? [{ label: '📌 置顶推含外链', value: -10 }] : []),
    ...((d as any)?.is_manual_verified === true ? [{ label: '🏅 官方人工验证', value: 30 }] : []),
  ]

  const STEPS = (t as any).loading_steps || ['🔍 正在搜索 X 账号...', '📊 分析账号数据...', '🗣 检索他人评价...', '🔒 风险评估中...', '✅ 生成报告...']
  const stepIdx = Math.min(Math.floor(progress / 20), 4)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: c.bg }}>
      <div className="text-center" style={{ width: 300 }}>
        <div className="w-14 h-14 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ border: `2px solid ${c.accentSolid}`, borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium mb-1" style={{ color: c.textMuted }}>{t.loading_msg} @{username}...</p>
        <p className="text-xs mb-6" style={{ color: c.textFaint }}>{STEPS[stepIdx]}</p>
        <div className="w-full h-1 rounded-full overflow-hidden mb-2" style={{ background: c.cardBg }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: c.accent }} />
        </div>
        <p className="text-xs" style={{ color: c.textFaint }}>{progress}%</p>
      </div>
    </div>
  )

  // 限制曝光页面
  if (restricted) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">🔒</div>
        <h2 className="text-xl font-bold mb-4" style={{ color: c.textPrimary }}>账号已限制曝光</h2>
        <p className="text-sm leading-relaxed mb-8 px-4 py-4 rounded-2xl whitespace-pre-wrap" style={{ color: c.textMuted, background: c.sectionBg, border: `1px solid ${c.cardBorder}` }}>
          {restricted.message}
        </p>
        <p className="text-xs" style={{ color: c.textFaint }}>即将返回首页...</p>
      </div>
    </div>
  )

  if (error === 'turnstile_failed') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">🤖</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>人机验证未通过</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          系统检测到异常请求，请刷新页面后重试。<br />
          如果问题持续出现，请通过 Telegram 登录后使用。
        </p>
        <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl text-white font-bold" style={{ background: c.accent }}>
          刷新重试
        </button>
      </div>
    </div>
  )

  if (error === 'busy') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">🌊</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>同时搜索的人数过多</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          AI 分析服务当前繁忙，请稍后再试。<br />
          排行榜里的账号可以正常浏览，仅新检索受影响。
        </p>
        <button onClick={() => doFetch()} className="w-full py-3 rounded-xl text-white font-bold mb-3" style={{ background: c.accent }}>
          重新尝试
        </button>
        <button onClick={() => router.push('/')} className="text-sm w-full py-2" style={{ color: c.textFaint }}>
          ← 返回首页
        </button>
      </div>
    </div>
  )

  if (error === 'global_busy') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">🚦</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>当前访问量过大</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          本小时内的 AI 分析额度已用完（保护公益资源）。<br />
          请在 <strong style={{ color: c.accentText }}>下一整点</strong> 后再尝试新的检索。<br />
          排行榜内账号不受影响。
        </p>
        <button onClick={() => router.push('/')} className="w-full py-3 rounded-xl text-white font-bold" style={{ background: c.accent }}>
          返回首页
        </button>
      </div>
    </div>
  )

  if (error === 'too_fast') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">☕</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>搜索频率过高</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          当前全站搜索量过大，请休息一下。<br />
          为了保证 AI 分析质量，请在 <strong style={{ color: c.accentText }}>{remaining} 秒</strong> 后再尝试新的搜索。
        </p>
        <button onClick={() => doFetch()} className="w-full py-3 rounded-xl text-white font-bold mb-3" style={{ background: c.accent }}>
          重新尝试
        </button>
        <button onClick={() => router.push('/')} className="text-sm w-full py-2" style={{ color: c.textFaint }}>
          ← 返回首页
        </button>
      </div>
    </div>
  )

  if (error === 'rate_limit') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">⏳</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>今日搜索次数已用完</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          {tgUser ? (
            <>高级会员每天可搜索 <strong style={{ color: c.accentText }}>100 次</strong> 新账号。<br />你今日的配额已用完，明天请继续使用。</>
          ) : (
            <>游客每天最多可搜索 <strong style={{ color: c.accentText }}>15 次</strong>，明天可继续使用。<br />登录后享受会员专属功能。</>
          )}
        </p>
        {!tgUser && (
          <a href="/tg-widget.html"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold mb-3"
            style={{ background: c.tgBtn, textDecoration: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/></svg>
            使用 Telegram 登录
          </a>
        )}
        {/* 自助检索引导 */}
        <a href="/byok"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold mb-3 text-sm"
          style={{ background: 'rgba(244,63,138,0.1)', border: '1px solid rgba(244,63,138,0.25)', color: c.accentText, textDecoration: 'none' }}>
          🔑 使用自己的 API Key 无限搜索
        </a>
        <button onClick={() => router.push('/')} className="text-sm w-full py-2" style={{ color: c.textFaint }}>
          ← 返回首页
        </button>
      </div>
    </div>
  )

  if (error === 'login_required') return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: c.bg }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">🔒</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: c.textPrimary }}>该账号尚未被检索过</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
          @{username} 暂无缓存数据。<br />
          登录后即可触发 AI 分析，结果将永久保存供所有人查看。
        </p>
        <button onClick={() => router.push('/')} className="w-full py-3 rounded-xl text-white font-bold" style={{ background: c.accent }}>
          登录并开始检索
        </button>
        <button onClick={() => router.push('/')} className="mt-3 text-sm w-full py-2" style={{ color: c.textFaint }}>
          ← 返回首页
        </button>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: c.bg }}>
      <div className="text-center px-6">
        <p className="text-white/50 mb-6">{error}</p>
        <button onClick={() => doFetch()} className="px-8 py-3 rounded-xl text-white font-bold" style={{ background: 'linear-gradient(135deg,#f43f8a,#e0368c)' }}>重试</button>
      </div>
    </div>
  )

  return (
    <>
    <div className="min-h-screen py-8 px-4" style={{ background: c.bg }}>
      {/* Cloudflare Turnstile 挂载点（不可见） */}
      <div id="cf-turnstile-widget" style={{ position: 'fixed', bottom: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
      <div className="max-w-6xl mx-auto">
        {/* 顶部导航栏 */}
        <div className="flex items-center gap-2 mb-8">
          {/* 返回按钮 */}
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1 text-sm flex-shrink-0 px-2 py-1.5 rounded-lg transition-all"
            style={{ color: c.textFaint, background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
            ← <span className="hidden sm:inline">{t.back}</span>
          </button>

          {/* 账号名（截断） */}
          <span className="text-sm min-w-0 truncate" style={{ color: c.textFaint }}>@{username}</span>

          {/* 右侧按钮组 */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* X 主页（手机只显示图标） */}
            <a href={`https://x.com/${username}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ background: c.cardBg, color: c.textFaint, border: `1px solid ${c.cardBorder}`, textDecoration: 'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span className="hidden sm:inline">查看主页</span>
            </a>

            {/* 分享按钮 */}
            {result && (
              <button onClick={shareProfile}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
                style={{ background: copied ? 'rgba(74,222,128,0.15)' : c.cardBg, color: copied ? '#4ade80' : c.textFaint, border: copied ? '1px solid rgba(74,222,128,0.3)' : `1px solid ${c.cardBorder}` }}>
                {copied ? '✅' : '🔗'}<span className="hidden sm:inline">{copied ? ' 已复制' : ' 分享'}</span>
              </button>
            )}

            {/* 退出按钮（手机隐藏名字） */}
            {tgUser && (
              <button onClick={logout}
                className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                style={{ color: 'rgba(239,68,68,0.6)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                退出
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-6 mb-6" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
          <div className="flex items-start gap-3 sm:gap-5 mb-4">
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={displayName || ''} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover" style={{ border: '2px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl" style={{ background: 'rgba(244,63,138,0.15)', border: '2px solid rgba(244,63,138,0.2)' }}>
                  {(displayName || username)[0]?.toUpperCase()}
                </div>
              )}
              {(d as any)?.is_manual_verified && (
                <div className="absolute -right-1 -bottom-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-[#0e0e10] flex items-center justify-center shadow-lg" title="官方认证">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`https://x.com/${username}`} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 min-w-0" style={{ textDecoration: 'none' }}>
                  <h1 className="text-lg sm:text-xl font-bold leading-tight truncate group-hover:underline" style={{ color: c.textPrimary }}>{displayName}</h1>
                  <svg className="flex-shrink-0 opacity-30 group-hover:opacity-80 transition-opacity" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: c.textPrimary }}>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                {((result as any)?.negative_tags || (d as any)?.negative_tags || []).includes('scam') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                    🚨 诈骗账号
                  </span>
                )}
                <button onClick={() => { setShowExposeModal(true); setExposeSent(false); setExposeContent(''); setExposeError('') }}
                  className="flex-shrink-0 text-[11px] font-semibold transition-all hover:opacity-80"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px' }}>
                  🔥 我要爆料
                </button>
                <button onClick={() => { setShowReportModal(true); setReportSent(false); setReportReason('') }}
                  className="flex-shrink-0 text-[11px] transition-all hover:opacity-80"
                  style={{ color: c.textFaint, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="纠错反馈">
                  纠错
                </button>
              </div>
              <p className="text-sm" style={{ color: c.textFaint }}>@{username}</p>
            </div>
            <div className="flex-shrink-0">
              <div className="inline-flex flex-col items-center rounded-xl px-3 py-2 sm:px-5 sm:py-3" style={{ background: `${scoreColor}12`, border: `2px solid ${scoreColor}30` }}>
                <span className="text-3xl sm:text-4xl font-black font-mono leading-none" style={{ color: scoreColor }}>{score}</span>
                <span className="text-[10px] sm:text-xs mt-0.5 font-medium whitespace-nowrap uppercase tracking-tighter" style={{ color: scoreColor }}>{scoreLabel}</span>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-3">
                {d?.is_active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">✅ {t.tag_active}</span>}
                {d?.using_proxy === true && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">🔒 VPN/代理</span>}
                {d?.using_proxy !== true && d?.location && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.tagBg, color: c.textMuted, border: `1px solid ${c.cardBorder}` }}>📍 {d.location}</span>}
                {(d as any)?.primary_language && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.tagBg, color: c.textMuted, border: `1px solid ${c.cardBorder}` }}>🗣 {(d as any).primary_language}</span>}
                {(d as any)?.gender === 'female' && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(244,63,138,0.12)', color: '#f472b6', border: '1px solid rgba(244,63,138,0.25)' }}>♀ 女性</span>}
                {(d as any)?.gender === 'male' && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>♂ 男性</span>}
                {(d as any)?.is_fushi && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>🔞 {t.tag_fushi}</span>}
                {(d as any)?.is_offline && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>📍 {t.tag_offline}</span>}
                {(d as any)?.has_threshold && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>🚪 {t.tag_threshold}</span>}
                {(d as any)?.is_welfare === false && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.tagBg, color: c.textMuted, border: `1px solid ${c.cardBorder}` }}>🌱 普通博主</span>}
                {((d as any)?.account_tags || []).includes('AV女優') && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.3)' }}>🎬 {(t as any).tag_av || 'AV女优'}</span>
                )}
                {((d as any)?.account_tags || []).includes('福利博主') && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>📦 {(t as any).tag_welfare_blogger || '福利博主'}</span>
                )}
                {((d as any)?.account_tags || [])
                  .filter((tag: string) => !['風俗業者','可线下','有门槛费','AV女優','福利博主'].includes(tag))
                  .map((tag: string) => (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.tagBg, color: c.textMuted, border: `1px solid ${c.cardBorder}` }}>{tag}</span>
                  ))}
                {((d as any)?.complaint_types || []).map((tag: string) => {
                  const label = (t as any)[`tag_${tag}`] || tag;
                  return (
                    <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.25)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>🚨 {label}</span>
                  );
                })}
                {((result as any)?.content_tags || (d as any)?.content_tags || []).length > 0 && (
                  <>
                    <div className="w-full" />
                    {((result as any)?.content_tags || (d as any)?.content_tags || []).map((tag: string) => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                        {tag}
                      </span>
                    ))}
                  </>
                )}
            </div>
            {/* 免责提示 */}
            <p className="text-[11px] leading-relaxed mt-2 px-2 py-1.5 rounded-lg" style={{ color: theme === 'light' ? '#92600a' : 'rgba(255,200,50,0.75)', background: theme === 'light' ? 'rgba(234,179,8,0.1)' : 'rgba(255,200,50,0.05)', border: theme === 'light' ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,200,50,0.1)' }}>
              {t.risk_tip}
            </p>
            {bio && <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap line-clamp-3 sm:line-clamp-none" style={{ color: c.textMuted }}>{bio}</p>}
            <div className="flex gap-5 mt-4 flex-wrap pt-4" style={{ borderTop: `1px solid ${c.cardBorder}` }}>
              {fRaw > 0 && <div><p className="font-bold text-sm sm:text-base" style={{ color: c.textPrimary }}>{fmt(fRaw)}</p><p className="text-[10px] sm:text-xs" style={{ color: c.textFaint }}>{t.followers}</p></div>}
              {(d as any)?.following > 0 && <div><p className="font-bold text-sm sm:text-base" style={{ color: c.textPrimary }}>{fmt((d as any).following)}</p><p className="text-[10px] sm:text-xs" style={{ color: c.textFaint }}>{t.following}</p></div>}
              {tRaw > 0 && <div><p className="font-bold text-sm sm:text-base" style={{ color: c.textPrimary }}>{fmt(tRaw)}</p><p className="text-[10px] sm:text-xs" style={{ color: c.textFaint }}>{t.tweets}</p></div>}
              {ageYears && <div><p className="font-bold text-sm sm:text-base" style={{ color: c.textPrimary }}>{ageLabel}</p><p className="text-[10px] sm:text-xs" style={{ color: c.textFaint }}>账龄</p></div>}
            </div>
          </div>
        </div>

        {d?.detail && (
          <div className="mb-6 p-5 sm:p-6 rounded-2xl border-l-4" style={{ background: 'rgba(255,255,255,0.03)', borderColor: scoreColor }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: c.textFaint }}>🤖 AI {t.section_eval}</h3>
            <p className="leading-relaxed text-base sm:text-lg" style={{ color: c.textPrimary }}>{'"'}{d.detail}{'"'}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: c.sectionBg, border: `1px solid ${c.cardBorder}` }}>
              <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: c.textPrimary }}>{t.section_score}</h3>
              <div className="space-y-4">
                {scoreItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: c.textMuted }}>{item.label}</span>
                    <span className={`text-sm font-mono ${item.value > 0 ? 'text-green-400' : item.value < 0 ? 'text-red-400' : 'text-white/20'}`}>
                      {item.value > 0 ? `+${item.value}` : item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: c.sectionBg, border: `1px solid ${c.cardBorder}` }}>
              <h3 className="font-bold mb-2" style={{ color: c.textPrimary }}>🗳️ 用户评价</h3>
              {voteStats && (voteStats.trust_count > 0 || voteStats.fraud_count > 0) && (
                <p className="text-xs mb-3" style={{ color: c.textFaint }}>
                  <span style={{ color: '#4ade8099' }}>{voteStats.trust_count} 人觉得可信</span>
                  <span className="mx-2" style={{ color: c.cardBorder }}>·</span>
                  <span style={{ color: '#f8717199' }}>{voteStats.fraud_count} 人觉得有诈</span>
                </p>
              )}
              {tgUser ? (
                <div className="flex gap-3">
                  <button onClick={() => doVote(1)} disabled={voting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: myVote === 1 ? 'rgba(34,197,94,0.2)' : c.tagBg, color: myVote === 1 ? '#4ade80' : c.textMuted, border: myVote === 1 ? '1px solid rgba(74,222,128,0.3)' : `1px solid ${c.cardBorder}`, opacity: voting ? 0.6 : 1 }}>
                    ✅ 此人可信{myVote === 1 ? ' ✓' : ''}
                  </button>
                  <button onClick={() => doVote(-1)} disabled={voting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: myVote === -1 ? 'rgba(239,68,68,0.2)' : c.tagBg, color: myVote === -1 ? '#f87171' : c.textMuted, border: myVote === -1 ? '1px solid rgba(248,113,113,0.3)' : `1px solid ${c.cardBorder}`, opacity: voting ? 0.6 : 1 }}>
                    🚨 此人有诈{myVote === -1 ? ' ✓' : ''}
                  </button>
                </div>
              ) : (
                <p className="text-xs py-3 text-center rounded-xl" style={{ color: c.textFaint, background: c.tagBg, border: `1px solid ${c.cardBorder}` }}>
                  登录后即可为该账号打分
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {media.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: c.sectionBg, border: `1px solid ${c.cardBorder}` }}>
                <h3 className="font-bold mb-4" style={{ color: c.textPrimary }}>{t.section_media}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {media.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} className="w-full h-32 object-cover rounded-lg" style={{ border: `1px solid ${c.cardBorder}` }} />
                  ))}
                </div>
              </div>
            )}
            {/* 刷新按钮已移除 */}
          </div>
        </div>

        {/* 评价详情引用 */}
        {( (d as any)?.complaint_examples?.length > 0 || (d as any)?.positive_examples?.length > 0 ) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 负面评价 */}
            {(d as any)?.complaint_examples?.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">🚨 {t.section_neg}</h3>
                <div className="space-y-3">
                  {(d as any).complaint_examples.map((txt: string, i: number) => (
                    <div key={i} className="text-sm leading-relaxed p-3 rounded-xl border-l-2 border-red-500/30" style={{ color: c.textMuted, background: c.sectionBg }}>
                      {'"'}{txt}{'"'}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 正面评价 */}
            {(d as any)?.positive_examples?.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: 'rgba(34,197,94,0.02)', border: '1px solid rgba(34,197,94,0.1)' }}>
                <h3 className="text-green-400 font-bold mb-4 flex items-center gap-2">👍 {t.section_pos}</h3>
                <div className="space-y-3">
                  {(d as any).positive_examples.map((txt: string, i: number) => (
                    <div key={i} className="text-sm leading-relaxed p-3 rounded-xl border-l-2 border-green-500/30" style={{ color: c.textMuted, background: c.sectionBg }}>
                      {'"'}{txt}{'"'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 mb-24">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold" style={{ color: c.textPrimary }}>{(t as any).comment_title || '🔥 网友爆料'}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.tagBg, color: c.textFaint }}>{comments.length}</span>
          </div>



          <div className="space-y-4">
            {comments.map((cm: any) => {
              const score = (cm.upvotes||0) - (cm.downvotes||0)
              const collapsed = cm.is_expose && (cm.downvotes||0) > 10 && (cm.upvotes||0) < 100
              return (
              <div key={cm.id} className="p-4 rounded-2xl" style={{
                background: cm.is_expose ? 'rgba(239,68,68,0.06)' : c.sectionBg,
                border: `1px solid ${cm.is_expose ? 'rgba(239,68,68,0.2)' : c.cardBorder}`,
                opacity: collapsed ? 0.5 : 1
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{ background: c.tagBg, border: `1px solid ${c.cardBorder}`, color: c.textFaint }}>
                    {cm.is_expose ? '🔥' : '👤'}
                  </div>
                  {cm.is_expose
                    ? <span className="text-xs font-bold" style={{ color: '#f87171' }}>匿名爆料</span>
                    : <span className="text-xs font-medium" style={{ color: c.textFaint }}>{cm.user_name || (t as any).comment_anon || '匿名用户'}</span>
                  }
                  <span className="text-[10px] ml-auto" style={{ color: c.textFaint }}>{new Date(cm.created_at).toLocaleString()}</span>
                </div>
                {collapsed
                  ? <p className="text-[11px] pl-9 italic" style={{ color: c.textFaint }}>此爆料已被多人标记为不实，点击查看</p>
                  : <p className="text-[13px] leading-relaxed pl-9 whitespace-pre-wrap" style={{ color: cm.is_expose ? c.textPrimary : c.textMuted }}>{cm.content}</p>
                }
                {cm.is_expose && (
                  <div className="mt-2 pl-9">
                  <div className="flex items-center gap-3">
                    <button onClick={async () => {
                      const res = await fetch('/api/expose/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({comment_id:cm.id, vote:1}) })
                      const d = await res.json()
                      if (d.ok) setComments((prev:any[]) => prev.map(c => c.id===cm.id ? {...c, upvotes:d.upvotes, downvotes:d.downvotes} : c))
                    }} className="flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ fontSize:11, color:'#4ade80', background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>
                      👍 坐实了 {cm.upvotes||0}
                    </button>
                    <button onClick={async () => {
                      const res = await fetch('/api/expose/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({comment_id:cm.id, vote:-1}) })
                      const d = await res.json()
                      if (d.ok) setComments((prev:any[]) => prev.map(c => c.id===cm.id ? {...c, upvotes:d.upvotes, downvotes:d.downvotes} : c))
                    }} className="flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ fontSize:11, color:'rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>
                      👎 瞎说 {cm.downvotes||0}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(251,146,60,0.7)', marginTop: 5 }}>
                    每人每条限投1票 · 票差低于 -30 进入人工审核
                  </p>
                  </div>
                )}
              </div>
              )
            })}
            {comments.length === 0 && (
              <div className="py-20 text-center" style={{ opacity: 0.3 }}>
                <p className="text-sm" style={{ color: c.textPrimary }}>{(t as any).comment_empty || '这人没啥料可爆的'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-8 text-center text-sm" style={{ borderTop: `1px solid ${c.cardBorder}`, color: c.textFaint }}>
        <p style={{ fontSize: 11, lineHeight: 1.7, opacity: 0.5, maxWidth: 340, margin: '0 auto 10px' }}>{t.footer}</p>
        <p>
          <a href="https://x.com/iam678" target="_blank" rel="noopener noreferrer"
            className="font-semibold transition-opacity hover:opacity-80"
            style={{ color: c.accentText, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            produced by @iam678
          </a>
        </p>
        <p className="mt-3 flex items-center justify-center gap-4">
          <a href="/rankings" className="text-[11px] opacity-60">🏆 排行榜</a>
          <span className="text-[11px] opacity-20">·</span>
          <a href="/byok" className="text-[11px] opacity-60">🔑 自助检索</a>
        </p>
      </footer>
    </div>
    {/* 爆料弹窗 */}
    {showExposeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) setShowExposeModal(false) }}>
        <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
          {exposeSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">🔥</div>
              <p className="font-semibold mb-1" style={{ color: c.textPrimary }}>爆料已提交</p>
              <p className="text-sm mb-4" style={{ color: c.textMuted }}>感谢你的爆料，管理员会审核处理</p>
              <button onClick={() => setShowExposeModal(false)}
                className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none', cursor: 'pointer' }}>关闭</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base" style={{ color: c.textPrimary }}>🔥 我要爆料</h3>
                <button onClick={() => setShowExposeModal(false)} style={{ color: c.textFaint, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>

              {/* TG 身份 */}
              {(() => { const tgUser = (() => { try { const s = localStorage.getItem('flj_tg_user'); return s ? JSON.parse(s) : null } catch { return null } })(); return tgUser ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-3"
                  style={{ background: tgUser.is_member ? 'rgba(250,204,21,0.1)' : 'rgba(96,165,250,0.1)', border: tgUser.is_member ? '1px solid rgba(250,204,21,0.2)' : '1px solid rgba(96,165,250,0.2)', color: tgUser.is_member ? '#facc15' : '#60a5fa' }}>
                  {tgUser.photo_url && <img src={tgUser.photo_url} className="w-5 h-5 rounded-full" alt="" />}
                  {tgUser.is_member ? '⭐ 天龙人' : '🔵 居委会'} · 以 <b>{tgUser.first_name}</b> 身份匿名爆料
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.cardBorder}`, color: c.textFaint }}>
                  👤 匿名爆料 · 每天最多 5 条
                </div>
              )})()}

              {/* 爆料分类 */}
              <div className="mb-3">
                <p className="text-xs mb-1.5" style={{ color: c.textMuted }}>爆料分类 <span className="text-red-400">*</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPOSE_CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => setExposeCategory(cat)}
                      className="text-xs px-2.5 py-1 rounded-full transition-all"
                      style={{ background: exposeCategory === cat ? 'rgba(244,63,138,0.2)' : 'rgba(255,255,255,0.05)', color: exposeCategory === cat ? '#f43f8a' : c.textMuted, border: exposeCategory === cat ? '1px solid rgba(244,63,138,0.4)' : `1px solid ${c.cardBorder}`, fontWeight: exposeCategory === cat ? 600 : 400 }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内容 */}
              <textarea
                className="w-full rounded-xl p-3 text-sm resize-none outline-none mb-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.cardBorder}`, color: c.textPrimary, minHeight: 100 }}
                placeholder="请描述具体事件、经历或证据，至少10个字..."
                value={exposeContent}
                onChange={e => setExposeContent(e.target.value)}
                maxLength={500}
              />
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs" style={{ color: c.textFaint }}>{exposeContent.length}/500</span>
                {exposeError && <span className="text-xs text-red-400">{exposeError}</span>}
              </div>

              {/* 图片上传 */}
              <div className="mb-4">
                <p className="text-xs mb-1.5" style={{ color: c.textMuted }}>附图（最多2张{(() => { try { return localStorage.getItem('flj_tg_token') ? '，登录用户免审核直接公开' : '，审核通过后公开' } catch { return '，审核通过后公开' } })()}）</p>
                <div className="flex gap-2 flex-wrap">
                  {exposeImages.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden" style={{ border: `1px solid ${c.cardBorder}` }}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setExposeImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10 }}>×</button>
                    </div>
                  ))}
                  {exposeImages.length < 2 && (
                    <label className="w-16 h-16 rounded-lg flex flex-col items-center justify-center cursor-pointer gap-0.5"
                      style={{ border: `1px dashed ${c.cardBorder}`, color: c.textFaint, background: 'rgba(255,255,255,0.03)' }}>
                      {uploadingImage ? <span className="text-[10px]">上传中</span> : <><span className="text-lg">📷</span><span className="text-[9px]">添加</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={handleExposeImageUpload} disabled={uploadingImage} />
                    </label>
                  )}
                </div>
              </div>

              <button disabled={exposeLoading}
                onClick={async () => {
                  if (exposeContent.trim().length < 10) { setExposeError('至少10个字'); return }
                  setExposeLoading(true); setExposeError('')
                  try {
                    const token = localStorage.getItem('flj_tg_token') || ''
                    const validImages = exposeImages.filter(u => u.startsWith('/uploads/'))
                    const res = await fetch('/api/expose', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ twitter_username: username, content: exposeContent.trim(), expose_category: exposeCategory, image_urls: validImages })
                    })
                    const d = await res.json()
                    if (!res.ok) { setExposeError(d.error || '提交失败'); return }
                    setExposeSent(true); setExposeImages([]); setExposeCategory('日常爆料')
                  } catch { setExposeError('网络错误') } finally { setExposeLoading(false) }
                }}
                className="w-full py-2.5 rounded-xl font-bold text-sm"
                style={{ background: exposeLoading ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.85)', color: 'white', border: 'none', cursor: exposeLoading ? 'not-allowed' : 'pointer' }}>
                {exposeLoading ? '提交中...' : '🔥 提交爆料'}
              </button>
            </>
          )}
        </div>
      </div>
    )}

    {/* 报告错误弹窗 */}
    {showReportModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) setShowReportModal(false) }}>
        <div className="w-full max-w-sm rounded-2xl p-5" onClick={e => e.stopPropagation()}
          style={{ background: theme === 'light' ? '#fff' : '#1e1e22', border: `1px solid ${c.headerBorder}` }}>
          {reportSent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-semibold mb-1" style={{ color: c.textPrimary }}>纠错已提交</p>
              <p className="text-xs mb-4" style={{ color: c.textMuted }}>我们会尽快核查，感谢你的反馈！</p>
              <button onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: c.accentBg, color: c.accentText }}>关闭</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base" style={{ color: c.textPrimary }}>纠错反馈</h3>
                <button onClick={() => setShowReportModal(false)} style={{ color: c.textFaint, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              <p className="text-xs mb-3" style={{ color: c.textMuted }}>
                发现 <span style={{ color: c.accentText }}>@{username}</span> 的信息有误？请简述原因（如冒名顶替、评分有误等）：
              </p>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)', border: `1px solid ${c.headerBorder}`, color: c.textPrimary, minHeight: 80, display: 'block', boxSizing: 'border-box' }}
                placeholder="例：这个账号是冒充某某的假号..."
                maxLength={200}
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
              />
              <div className="flex items-center justify-between mt-1 mb-3">
                <span className="text-[10px]" style={{ color: c.textFaint }}>{reportReason.length}/200</span>
              </div>
              <button
                disabled={reportLoading || reportReason.trim().length < 5}
                onClick={async () => {
                  setReportLoading(true)
                  try {
                    const tgToken = localStorage.getItem('flj_tg_token') || ''
                    const res = await fetch('/api/report', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tgToken}` },
                      body: JSON.stringify({ twitter_username: username, reason: reportReason.trim() })
                    })
                    if (res.ok) setReportSent(true)
                    else {
                      const d = await res.json()
                      alert(d.error === 'too_many_reports' ? '你今天已经报告过这个账号了' : '提交失败，请稍后再试')
                    }
                  } finally { setReportLoading(false) }
                }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: reportReason.trim().length >= 5 ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.2)', color: reportReason.trim().length >= 5 ? '#fff' : 'rgba(239,68,68,0.4)', cursor: reportReason.trim().length >= 5 ? 'pointer' : 'not-allowed' }}>
                {reportLoading ? '提交中...' : '提交报告'}
              </button>
            </>
          )}
        </div>
      </div>
    )}
    </>
  )
}

