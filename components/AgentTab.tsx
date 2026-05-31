// components/AgentTab.tsx  (works in both /mf and / pages)
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const DAILY_LIMIT = 15000

const AGENT_ACTIONS = [
  {
    type:  'weekly_nw',
    label: 'Weekly NW Review',
    icon:  '📊',
    desc:  'Full net worth health check',
    color: '#1E3A8A',
  },
  {
    type:  'mf_review',
    label: 'MF Deep Dive',
    icon:  '📈',
    desc:  'Fund-level analysis & SIP efficiency',
    color: '#7C3AED',
  },
  {
    type:  'debt_optimizer',
    label: 'Debt Optimizer',
    icon:  '💳',
    desc:  'EMI vs invest, prepayment strategy',
    color: '#E8195A',
  },
  {
    type:  'goal_tracker',
    label: 'Goal Tracker',
    icon:  '🎯',
    desc:  'Gap analysis + rescue plans',
    color: '#059669',
  },
  {
    type:  'tax_optimizer',
    label: 'Tax Optimizer',
    icon:  '🏛️',
    desc:  'LTCG harvesting, ELSS, FY actions',
    color: '#D97706',
  },
  {
    type:  'rebalance',
    label: 'Rebalance',
    icon:  '⚖️',
    desc:  'Allocation drift + trade plan',
    color: '#0891B2',
  },
  {
    type:  'alert_scan',
    label: 'Risk Scanner',
    icon:  '⚠️',
    desc:  'Critical, watch, opportunity flags',
    color: '#D97706',
  },
  {
    type:  'cash_flow',
    label: 'Cash Flow',
    icon:  '💸',
    desc:  'Monthly liquidity & idle cash',
    color: '#059669',
  },
]

interface UsageInfo {
  tokensUsedToday: number
  remaining: number
  tokenLimit: number
}

export function AgentTab({ alerts }: { alerts?: any[] }) {
  const [userId, setUserId]       = useState<string | null>(null)
  const [output, setOutput]       = useState('')
  const [busy, setBusy]           = useState(false)
  const [activeType, setActive]   = useState<string | null>(null)
  const [customQ, setCustomQ]     = useState('')
  const [usage, setUsage]         = useState<UsageInfo | null>(null)
  const [limitError, setLimitErr] = useState(false)

  // Load user + today's usage
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id
      if (!uid) return
      setUserId(uid)

      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('agent_usage')
        .select('tokens_used')
        .eq('user_id', uid)
        .eq('date', today)
        .maybeSingle()
      
        if (!data) {
  const { data, error } = await supabase
  .from('agent_usage')
  .select('tokens_used')
  .maybeSingle()

const used = data?.tokens_used ?? 0

setUsage({
  tokensUsedToday: used,
  remaining: DAILY_LIMIT - used,
  tokenLimit: DAILY_LIMIT,
})
}

      const used = data?.tokens_used ?? 0
      setUsage({
        tokensUsedToday: used,
        remaining:       DAILY_LIMIT - used,
        tokenLimit:      DAILY_LIMIT,
      })
    })
  }, [])

  const run = useCallback(async (type: string, custom?: string) => {
    if (!userId) return
    if (busy) return

    setBusy(true)
    setActive(type)
    setOutput('')
    setLimitErr(false)

    try {
      const res = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, customPrompt: custom, userId }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setLimitErr(true)
        setOutput('')
      } else if (data.result) {
        setOutput(data.result)
        if (data.usage) setUsage(data.usage)
      } else {
        setOutput(data.error || 'No response from advisor.')
      }
    } catch {
      setOutput('Connection error. Please try again.')
    }

    setBusy(false)
  }, [userId, busy])

  const usedPct    = usage ? (usage.tokensUsedToday / DAILY_LIMIT) * 100 : 0
  const barColor   = usedPct > 85 ? '#E8195A' : usedPct > 60 ? '#D97706' : '#059669'
  const callsLeft  = usage ? Math.floor(usage.remaining / 1300) : '—'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Usage meter ───────────────────────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: 14, padding: '14px 18px',
        border: '1px solid #E8ECF4', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              🤖 AI Advisor — Daily Token Budget
            </span>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
              {usage ? `${usage.tokensUsedToday.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()}` : '—'}
            </span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, usedPct)}%`, height: '100%',
              background: barColor, borderRadius: 3, transition: 'width .4s',
            }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
            ~{callsLeft} calls left today
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Resets midnight UTC</div>
        </div>
      </div>

      {/* ── Rate limit error ──────────────────────────────────────────── */}
      {limitError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 18px', marginBottom: 16, fontSize: 13, color: '#DC2626',
        }}>
          ⚠️ Daily AI limit reached ({DAILY_LIMIT.toLocaleString()} tokens).
          Resets at midnight UTC. Your data is safe — come back tomorrow for fresh insights.
        </div>
      )}

      {/* ── Action grid ───────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10, marginBottom: 20,
      }}>
        {AGENT_ACTIONS.map(a => {
          const isActive = activeType === a.type && busy
          return (
            <button
              key={a.type}
              onClick={() => run(a.type)}
              disabled={busy || usedPct >= 100}
              style={{
                background:  activeType === a.type && !busy ? `${a.color}10` : 'white',
                border:      `1.5px solid ${activeType === a.type ? a.color : '#E8ECF4'}`,
                borderRadius: 12, padding: '14px 14px', textAlign: 'left',
                cursor:  busy || usedPct >= 100 ? 'not-allowed' : 'pointer',
                opacity: busy && activeType !== a.type ? 0.5 : 1,
                transition: '.15s',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>
                {isActive ? '⏳' : a.icon}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B1E4F', marginBottom: 2 }}>
                {a.label}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
                {a.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Custom question ───────────────────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: 14, padding: '16px 18px',
        border: '1px solid #E8ECF4', marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
          💬 Ask anything about your portfolio
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={customQ}
            onChange={e => setCustomQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && customQ.trim() && run('custom', customQ)}
            placeholder="e.g. Should I prepay my home loan or increase SIP?"
            style={{
              flex: 1, padding: '10px 14px',
              border: '1.5px solid #E8ECF4', borderRadius: 10,
              fontSize: 13, outline: 'none', color: '#111',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            onClick={() => customQ.trim() && run('custom', customQ)}
            disabled={busy || !customQ.trim() || usedPct >= 100}
            style={{
              padding: '10px 18px', background: '#0B1E4F', color: 'white',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: busy || !customQ.trim() ? 'not-allowed' : 'pointer',
              opacity: busy || !customQ.trim() ? 0.5 : 1,
            }}
          >
            {busy && activeType === 'custom' ? '⏳' : '→'}
          </button>
        </div>
      </div>

      {/* ── AI Output ────────────────────────────────────────────────── */}
      {(busy || output) && (
        <div style={{
          background: 'white', borderRadius: 16, padding: '20px 22px',
          border: '1px solid #E8ECF4', marginBottom: 20,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1E4F' }}>
              {AGENT_ACTIONS.find(a => a.type === activeType)?.icon ?? '🤖'}{' '}
              {AGENT_ACTIONS.find(a => a.type === activeType)?.label ?? 'AI Advisor'}
            </div>
            {output && (
              <button
                onClick={() => navigator.clipboard?.writeText(output)}
                style={{
                  fontSize: 11, color: '#9CA3AF', background: 'none',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Copy
              </button>
            )}
          </div>

          {busy ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF' }}>
              <div style={{
                width: 14, height: 14,
                border: '2px solid #7C3AED',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin .7s linear infinite',
              }} />
              <span style={{ fontSize: 13 }}>Analysing your full net worth…</span>
            </div>
          ) : (
            <pre style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize:   14, color: '#1F2937',
              whiteSpace: 'pre-wrap', lineHeight: 1.75,
              margin: 0, wordBreak: 'break-word',
            }}>
              {output}
            </pre>
          )}
        </div>
      )}

      {/* ── Recent AI alerts ──────────────────────────────────────────── */}
      {alerts && alerts.length > 0 && (
        <div style={{
          background: 'white', borderRadius: 16,
          border: '1px solid #E8ECF4', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 18px', borderBottom: '1px solid #F3F4F6',
            fontSize: 13, fontWeight: 700, color: '#0B1E4F',
          }}>
            📋 Recent Advisor Logs
          </div>
          {alerts.slice(0, 5).map((a: any) => (
            <div key={a.id} style={{
              padding: '11px 18px', borderBottom: '1px solid #F9FAFB',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {a.alert_type === 'weekly_nw' ? '📊'
                  : a.alert_type === 'mf_review'      ? '📈'
                  : a.alert_type === 'debt_optimizer'  ? '💳'
                  : a.alert_type === 'goal_tracker'    ? '🎯'
                  : a.alert_type === 'tax_optimizer'   ? '🏛️'
                  : '🤖'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                  {(a.message ?? '').slice(0, 120)}…
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                  {new Date(a.triggered_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
