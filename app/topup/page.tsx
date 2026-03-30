'use client'
import { useState, useEffect } from 'react'

interface Tier {
  label: string
  usd: number
  points: number
  flj_needed: number
  price_usd: number
}

const RANK_LABELS: [number, string][] = [
  [500000,'正部'],[100000,'副部'],[50000,'正厅'],[20000,'副厅'],
  [10000,'正处'],[5000,'副处'],[3000,'正科'],[1000,'副科'],[0,'居委会']
]
function getNextRank(pts: number) {
  for (const [n, label] of RANK_LABELS) if (pts >= n) return label
  return '居委会'
}

export default function TopupPage() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [wallet, setWallet] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [quote, setQuote] = useState<{ id: string; flj_needed: number; expires_at: string; tier_label: string; points: number } | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; points?: number; label?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [tgToken, setTgToken] = useState<string | null>(null)
  const [tgUser, setTgUser] = useState<any>(null)
  const [currentPoints, setCurrentPoints] = useState<number | null>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('flj_tg_token')
    setTgToken(token)
    const user = localStorage.getItem('flj_tg_user')
    if (user) try { setTgUser(JSON.parse(user)) } catch {}
    fetch('/api/topup').then(r => r.json()).then(d => {
      if (d.tiers) { setTiers(d.tiers); setWallet(d.wallet); setPrice(d.price_usd) }
    })
    if (token) {
      fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if (d.points !== undefined) setCurrentPoints(d.points); if (d.is_member) setIsMember(true) })
    }
  }, [])

  async function selectTier(i: number) {
    setSelected(i); setQuote(null); setResult(null); setTxHash('')
    if (!tgToken) return
    const res = await fetch('/api/topup/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tgToken}` },
      body: JSON.stringify({ tier_index: i })
    })
    const d = await res.json()
    if (d.quote_id) {
      setQuote({ id: d.quote_id, flj_needed: d.flj_needed, expires_at: d.expires_at, tier_label: d.tier_label, points: d.points })
      setCountdown(300)
    }
  }

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function submit() {
    if (!quote || !txHash.trim() || !tgToken) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tgToken}` },
        body: JSON.stringify({ tx_hash: txHash.trim(), quote_id: quote.id })
      })
      const d = await res.json()
      if (d.ok) {
        setResult({ ok: true, points: d.points_granted, label: d.tier_label })
        setCurrentPoints(p => (p ?? 0) + d.points_granted)
        setTxHash(''); setSelected(null)
      } else {
        const msg: Record<string, string> = {
          already_used: '该 TX Hash 已被兑换过',
          tx_not_found: '未找到该交易，请确认 Hash 正确且已上链',
          wrong_recipient: '收款地址不匹配',
          wrong_token: '代币合约不匹配，请确认发送的是 $FLJ',
          insufficient_amount: `金额不足，请选择正确档位`,
          unauthorized: '请先登录 TG',
        }
        setResult({ error: msg[d.error] || d.error })
      }
    } catch { setResult({ error: '网络错误，请重试' }) }
    setLoading(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const dark = { bg: '#0a0a0f', card: '#13131a', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.85)', muted: 'rgba(255,255,255,0.4)', faint: 'rgba(255,255,255,0.2)' }

  function logout() {
    localStorage.removeItem('flj_tg_token')
    localStorage.removeItem('flj_tg_user')
    setTgToken(null); setTgUser(null); setCurrentPoints(null); setIsMember(false)
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: dark.bg, color: dark.text }}>
      <div className="max-w-lg mx-auto">

        {/* 顶部状态栏 */}
        <div className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl" style={{ background: dark.card, border: `1px solid ${dark.border}` }}>
          {tgUser ? (
            <div className="flex items-center gap-2.5">
              {tgUser.photo_url && <img src={tgUser.photo_url} className="w-8 h-8 rounded-full" />}
              <div>
                <p className="text-sm font-medium">{tgUser.first_name}</p>
                <p className="text-xs" style={{ color: dark.muted }}>
                  {isMember ? <span style={{ color: '#facc15' }}>⭐ 天龙人</span> : currentPoints !== null ? <span style={{ color: '#60a5fa' }}>🔵 {getNextRank(currentPoints)} · {currentPoints.toLocaleString()} 积分</span> : '加载中...'}
                </p>
              </div>
            </div>
          ) : (
            <a href="/tg-widget.html" className="text-sm" style={{ color: '#60a5fa' }}>点此登录 Telegram</a>
          )}
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs px-2.5 py-1 rounded-lg" style={{ color: dark.muted, background: 'rgba(255,255,255,0.05)' }}>首页</a>
            {tgUser && <button onClick={logout} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>退出</button>}
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">$FLJ 积分充值</h1>
          <p className="text-sm" style={{ color: dark.muted }}>用 $FLJ 代币充值积分，解锁更快的搜索速度</p>
          {isMember ? (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)' }}>
              <span style={{ color: '#facc15' }}>⭐ 您已是天龙人账户，享受最高等级搜索速度（10秒冷却），无需充值</span>
            </div>
          ) : currentPoints !== null && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <span style={{ color: '#60a5fa' }}>当前积分：{currentPoints.toLocaleString()} · {getNextRank(currentPoints)}</span>
            </div>
          )}
        </div>



        {/* 价格 */}
        {price && (
          <div className="text-xs mb-4" style={{ color: dark.faint }}>
            当前 $FLJ 价格：<span style={{ color: dark.muted }}>${price.toFixed(8)}</span>
            <span className="ml-2 opacity-50">· 实时汇率，每次充值重新计算</span>
          </div>
        )}

        {/* 档位选择 */}
        <div className="space-y-2 mb-6">
          {tiers.map((tier, i) => (
            <button key={i} onClick={() => selectTier(i)}
              className="w-full rounded-xl p-4 text-left transition-all"
              style={{
                background: selected === i ? 'rgba(168,85,247,0.1)' : dark.card,
                border: `1px solid ${selected === i ? 'rgba(168,85,247,0.4)' : dark.border}`,
              }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm">{tier.label}</span>
                  <span className="ml-2 text-xs" style={{ color: dark.muted }}>${tier.usd} USDT 等值</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm" style={{ color: '#c084fc' }}>+{tier.points.toLocaleString()} 积分</p>
                  <p className="text-xs" style={{ color: dark.faint }}>{tier.flj_needed.toLocaleString()} FLJ</p>
                </div>
              </div>
              <p className="text-xs mt-1" style={{ color: dark.faint }}>
                到达等级：{getNextRank((currentPoints ?? 0) + tier.points)}
              </p>
            </button>
          ))}
        </div>

        {/* 收款地址 */}
        {selected !== null && quote && (
          <div className="rounded-xl p-4 mb-5" style={{ background: dark.card, border: `1px solid ${countdown > 60 ? 'rgba(250,204,21,0.2)' : countdown > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.5)'}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: 'rgba(250,204,21,0.8)' }}>
                第①步：发送 <span className="font-bold text-base" style={{ color: '#facc15' }}>{quote.flj_needed.toLocaleString()} FLJ</span> 到以下地址
              </p>
              <div className="text-right">
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: countdown > 60 ? 'rgba(250,204,21,0.1)' : 'rgba(239,68,68,0.15)', color: countdown > 60 ? '#facc15' : '#f87171' }}>
                  {countdown > 0 ? `${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')}` : '已过期'}
                </span>
                {countdown > 0 && <p className="text-[10px] mt-0.5" style={{ color: dark.faint }}>价格已锁定</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-xs font-mono flex-1 break-all" style={{ color: dark.muted }}>{wallet}</span>
              <button onClick={() => copy(wallet)}
                className="text-xs px-2.5 py-1 rounded-lg shrink-0 font-medium"
                style={{ background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(250,204,21,0.15)', color: copied ? '#22c55e' : '#facc15' }}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: dark.faint }}>请在 BNB Smart Chain (BSC) 网络转账，其他网络无效</p>
          </div>
        )}

        {/* 提交 TX Hash */}
        {selected !== null && quote && countdown > 0 && (
          <div className="rounded-xl p-4 mb-5" style={{ background: dark.card, border: `1px solid ${dark.border}` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: dark.muted }}>第②步：粘贴交易 Hash</p>
            <input
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg px-3 py-2.5 text-xs font-mono outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${dark.border}`, color: dark.text }}
            />
            <button
              onClick={submit}
              disabled={!txHash.trim() || loading || !tgToken}
              className="w-full mt-3 py-2.5 rounded-lg font-bold text-sm transition-all"
              style={{ background: txHash.trim() && tgToken ? 'rgba(168,85,247,0.8)' : 'rgba(255,255,255,0.06)', color: txHash.trim() && tgToken ? 'white' : dark.faint }}>
              {loading ? '验证中...' : '确认兑换积分'}
            </button>
          </div>
        )}

        {selected !== null && quote && countdown === 0 && (
          <div className="rounded-xl p-4 mb-5 text-sm text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            报价已过期，请重新选择档位获取最新汇率
          </div>
        )}

        {/* 结果 */}
        {result && (
          <div className="rounded-xl p-4 text-sm" style={{
            background: result.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: result.ok ? '#4ade80' : '#f87171'
          }}>
            {result.ok ? `✅ 兑换成功！+${result.points?.toLocaleString()} 积分已到账` : `❌ ${result.error}`}
          </div>
        )}

        {/* 等级冷却说明 */}
        <div className="mt-6 rounded-xl p-4 text-xs" style={{ background: dark.card, border: `1px solid ${dark.border}` }}>
          <p className="font-semibold mb-3" style={{ color: dark.muted }}>🔍 积分等级与搜索冷却时间</p>
          <div className="space-y-1.5">
            {[
              ['居委会', '0', '120秒'],
              ['副科', '1,000', '90秒'],
              ['正科', '3,000', '70秒'],
              ['副处', '5,000', '50秒'],
              ['正处', '10,000', '30秒'],
              ['副厅及以上', '20,000', '10秒'],
            ].map(([rank, pts, cd]) => (
              <div key={rank} className="flex items-center justify-between">
                <span style={{ color: dark.muted }}>{rank}</span>
                <span style={{ color: dark.faint }}>{pts} 积分起</span>
                <span className="font-medium" style={{ color: '#60a5fa' }}>冷却 {cd}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${dark.border}` }}>
              <span style={{ color: '#facc15' }}>⭐ 天龙人</span>
              <span style={{ color: dark.faint }}>频道会员专属</span>
              <span className="font-medium" style={{ color: '#facc15' }}>冷却 10秒</span>
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="mt-4 rounded-xl p-4 text-xs space-y-1.5" style={{ background: dark.card, border: `1px solid ${dark.border}`, color: dark.faint }}>
          <p className="font-semibold mb-2" style={{ color: dark.muted }}>说明</p>
          <p>• 充值使用 $FLJ 代币（BNB Smart Chain）</p>
          <p>• 每笔交易只能兑换一次，不可重复提交</p>
          <p>• 转账金额需符合所选档位（允许 ±20% 误差）</p>
          <p>• 积分到账后可立即使用，提升搜索等级和冷却时间</p>
          <p>• 如有问题请联系管理员</p>
        </div>
      </div>
    </div>
  )
}
