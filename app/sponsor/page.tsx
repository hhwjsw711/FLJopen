'use client'
import { useState } from 'react'

const FLJ_CONTRACT = 'process.env.FLJ_CONTRACT_ADDRESS'
const BNB_ADDRESS  = 'process.env.FLJ_WALLET_ADDRESS'
const PANCAKESWAP_URL = `https://flap.sh/bnb/${FLJ_CONTRACT}`
const FLAP_URL = 'https://flap.sh/bnb/process.env.FLJ_CONTRACT_ADDRESS/taxinfo'

export default function SponsorPage() {
  const [copiedContract, setCopiedContract] = useState(false)
  const [copiedBnb, setCopiedBnb] = useState(false)

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f', color: '#fff' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">支持 flj.info</h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
            这个项目由一名开发者独立维护，所有收入用于服务器与 AI API 开销。
            <br />感谢每一位支持者。
          </p>
        </div>

        {/* 项目说明 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="font-bold text-base mb-3">关于这个项目</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            flj.info 是一个帮助大家鉴别福利姬账号真实性的工具，通过 AI 分析 X（Twitter）账号数据，提供可信度评分、爆料广场和用户评价系统。目标是减少诈骗、让用户做出更明智的判断。
          </p>
        </div>

        {/* $FLJ 代币 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.15)' }}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-base">$FLJ 代币</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>BSC Chain</span>
          </div>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            由社区发起，交易税收直接支持本项目。在 flap.sh 购买即为支持。
          </p>

          <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xs font-mono flex-1 break-all" style={{ color: 'rgba(255,255,255,0.6)' }}>{FLJ_CONTRACT}</span>
            <button onClick={() => copy(FLJ_CONTRACT, setCopiedContract)}
              className="text-xs px-3 py-1.5 rounded-lg shrink-0 font-medium transition-colors"
              style={{ background: copiedContract ? 'rgba(34,197,94,0.2)' : 'rgba(250,204,21,0.15)', color: copiedContract ? '#22c55e' : '#facc15' }}>
              {copiedContract ? '已复制' : '复制'}
            </button>
          </div>

          <div className="flex gap-2">
            <a href={PANCAKESWAP_URL} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-bold py-2.5 rounded-xl transition-colors"
              style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)' }}>
              在 flap.sh 购买
            </a>
            <a href={FLAP_URL} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium py-2.5 px-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
              查看税收
            </a>
          </div>
        </div>

        {/* BNB 直接打赏 */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-base">BNB 直接打赏</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>BSC Chain</span>
          </div>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            直接向开发者钱包转账，100% 用于项目维护。
          </p>

          <div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xs font-mono flex-1 break-all" style={{ color: 'rgba(255,255,255,0.6)' }}>{BNB_ADDRESS}</span>
            <button onClick={() => copy(BNB_ADDRESS, setCopiedBnb)}
              className="text-xs px-3 py-1.5 rounded-lg shrink-0 font-medium transition-colors"
              style={{ background: copiedBnb ? 'rgba(34,197,94,0.2)' : 'rgba(96,165,250,0.15)', color: copiedBnb ? '#22c55e' : '#60a5fa' }}>
              {copiedBnb ? '已复制' : '复制'}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>请确认在 BNB Smart Chain (BSC) 网络转账</p>
        </div>

        {/* 积分兑换入口 */}
        <div className="rounded-2xl p-5 mt-5" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <h2 className="font-bold text-base mb-1">🎁 $FLJ 兑换积分</h2>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
            持有 $FLJ 代币的用户可以将代币兑换为平台积分，积分越高等级越高，搜索冷却时间越短（最低 10 秒）。
          </p>
          <div className="text-xs mb-4 space-y-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <p>居委会 → 120秒冷却 &nbsp;|&nbsp; 副科（1000积分）→ 90秒 &nbsp;|&nbsp; 正科（3000积分）→ 70秒</p>
            <p>副处（5000积分）→ 50秒 &nbsp;|&nbsp; 正处（10000积分）→ 30秒 &nbsp;|&nbsp; 副厅+（20000积分）→ 10秒</p>
          </div>
          <a href="/topup"
            className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.35)' }}>
            前往积分充值页面 →
          </a>
        </div>

        {/* 底部 */}
        <div className="text-center mt-8">
          <a href="/" className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>← 返回首页</a>
        </div>

      </div>
    </div>
  )
}
