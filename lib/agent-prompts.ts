// lib/agent-prompts.ts
// ─── Full Net Worth AI Prompt Engine ────────────────────────────────────────
// Builds dense, personalized, token-efficient prompts for every agent type.

export interface NetWorthContext {
  // User identity
  user: {
    name: string
    role: string
    since?: string // account created date
  }

  // Real-time financials
  netWorth: number
  totalAssets: number

  // Asset breakdown
  liquidity: {
    total: number
    mfCorpus: number
    manualInvested: number
    manualGain: number
    breakdown: Array<{ name: string; cat: string; value: number; invested: number }>
  }

  property: {
    total: number
    purchaseTotal: number
    appreciation: number
    breakdown: Array<{ name: string; cat: string; current: number; purchase: number; year?: number }>
  }

  cash: {
    total: number
    breakdown: Array<{ name: string; cat: string; balance: number }>
  }

  // Liabilities
  liabilities: {
    total: number
    monthlyEMI: number
    avgRate: number
    breakdown: Array<{ name: string; cat: string; outstanding: number; emi: number; rate: number; endDate?: string }>
  }

  // MF Portfolio
  mf: {
    corpus: number
    invested: number
    gain: number
    gainPct: number
    xirr: number
    monthlySIP: number
    activeFunds: number
    funds: Array<{
      name: string
      category: string
      sip: number
      invested: number
      current: number
      nav: number
      gain: number
      gainPct: number
    }>
  }

  // Goals
  goals: Array<{
    name: string
    target: number
    current: number
    progress: number
    targetDate?: string
  }>

  // Projections (pre-computed)
  projections: {
    mf3mBase: number
    mf1yBase: number
    nw1yBase: number
  }

  // Historical context
  nwHistory?: Array<{ month: string; nw: number }>
  recentAlerts?: string[]
}

// ─── Token-efficient context serializer ──────────────────────────────────────
export function buildContext(ctx: NetWorthContext): string {
  const fmtL = (n: number) => {
    const a = Math.abs(n)
    if (a >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
    if (a >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
    return `₹${Math.round(n / 1000)}K`
  }

  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const debtRatio = ctx.totalAssets > 0
    ? ((ctx.liabilities.total / ctx.totalAssets) * 100).toFixed(1)
    : '0'

  // NW trend (last 3 months delta)
  const nwTrend = (() => {
    if (!ctx.nwHistory || ctx.nwHistory.length < 2) return ''
    const last  = ctx.nwHistory[ctx.nwHistory.length - 1]?.nw ?? 0
    const prev  = ctx.nwHistory[ctx.nwHistory.length - 4]?.nw ?? ctx.nwHistory[0]?.nw ?? 0
    const delta = last - prev
    return ` | NW 3M: ${delta >= 0 ? '+' : ''}${fmtL(delta)}`
  })()

  // Goals summary
  const goalsLine = ctx.goals.length > 0
    ? ctx.goals.map(g => `${g.name}(${g.progress.toFixed(0)}%→${fmtL(g.target)})`).join(', ')
    : 'none'

  // MF funds — top 5 by value
  const topFunds = [...ctx.mf.funds]
    .sort((a, b) => b.current - a.current)
    .slice(0, 7)
    .map(f => `  • ${f.name} | ${f.category} | SIP:${fmtL(f.sip)}/mo | ${fmtL(f.invested)}→${fmtL(f.current)} (${f.gainPct >= 0 ? '+' : ''}${f.gainPct.toFixed(1)}%)`)
    .join('\n')

  // Liability breakdown
  const liabLines = ctx.liabilities.breakdown
    .map(l => `  • ${l.name}(${l.cat}): ${fmtL(l.outstanding)} @ ${l.rate}% | EMI:${fmtL(l.emi)}/mo${l.endDate ? ` ends:${l.endDate}` : ''}`)
    .join('\n')

  // Property breakdown
  const propLines = ctx.property.breakdown
    .map(p => `  • ${p.name}: ${fmtL(p.current)} (bought:${fmtL(p.purchase)}${p.year ? ` in ${p.year}` : ''})`)
    .join('\n')

  // Liquidity (non-MF)
  const liqLines = ctx.liquidity.breakdown
    .map(l => `  • ${l.name}(${l.cat}): ${fmtL(l.value)} invested:${fmtL(l.invested)}`)
    .join('\n')

  // Cash
  const cashLines = ctx.cash.breakdown
    .map(c => `  • ${c.name}(${c.cat}): ${fmtL(c.balance)}`)
    .join('\n')

  return `USER: ${ctx.user.name} | DATE: ${date}
━━ NET WORTH SNAPSHOT ━━
NW=${fmtL(ctx.netWorth)} | Assets=${fmtL(ctx.totalAssets)} | Liabilities=${fmtL(ctx.liabilities.total)}
Debt/Asset=${debtRatio}% | Monthly EMI=${fmtL(ctx.liabilities.monthlyEMI)} | Avg Rate=${ctx.liabilities.avgRate.toFixed(1)}%${nwTrend}

━━ ASSET ALLOCATION ━━
MF Corpus:  ${fmtL(ctx.mf.corpus)}  (${ctx.totalAssets > 0 ? ((ctx.mf.corpus / ctx.totalAssets) * 100).toFixed(1) : 0}% of assets)
Liquidity:  ${fmtL(ctx.liquidity.total)}  (manual+MF)
Property:   ${fmtL(ctx.property.total)}
Cash:       ${fmtL(ctx.cash.total)}

━━ MF PORTFOLIO ━━
Invested=${fmtL(ctx.mf.invested)} | Current=${fmtL(ctx.mf.corpus)} | Gain=${fmtL(ctx.mf.gain)} (${ctx.mf.gainPct >= 0 ? '+' : ''}${ctx.mf.gainPct.toFixed(1)}%)
XIRR=${ctx.mf.xirr.toFixed(1)}% | SIP=₹${ctx.mf.monthlySIP.toLocaleString('en-IN')}/mo | Active=${ctx.mf.activeFunds} funds
Funds (top by value):
${topFunds || '  none'}

━━ LIABILITIES ━━
${liabLines || '  none'}

━━ PROPERTY ━━
${propLines || '  none'}
Appreciation: ${fmtL(ctx.property.appreciation)} on ${fmtL(ctx.property.purchaseTotal)} purchased

━━ LIQUIDITY (non-MF) ━━
${liqLines || '  none'}

━━ CASH ━━
${cashLines || '  none'}

━━ GOALS ━━
${goalsLine}

━━ PROJECTIONS (base 13%) ━━
MF 3M: ${fmtL(ctx.projections.mf3mBase)} | MF 1Y: ${fmtL(ctx.projections.mf1yBase)} | NW 1Y est: ${fmtL(ctx.projections.nw1yBase)}
${ctx.recentAlerts?.length ? `\n━━ RECENT ALERTS ━━\n${ctx.recentAlerts.slice(0, 3).join('\n')}` : ''}`
}

// ─── System prompt ────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are Worth IQ — an elite Indian personal finance strategist with CFA + CA-level expertise.

PERSONA: You know ${`{USER_NAME}`}'s complete financial picture. Speak to them by name occasionally. Be direct, high-signal, institutional quality.

RULES:
- Use exact ₹ amounts and fund names from the context. Never invent numbers.
- Bullets over paragraphs. Lead with the punchline.
- For MF: reference specific funds by shortened name (e.g. "Parag Parikh" not full name).
- For liabilities: flag rate arbitrage opportunities (loan rate vs MF XIRR).
- For net worth: assess debt/asset health, liquidity ratio, concentration risk.
- No generic advice. Every insight must be specific to the numbers provided.
- Indian tax context: LTCG 12.5% (equity >1yr), STCG 20%, debt indexation removed.
- Maximize insight per token. Omit pleasantries.`

// ─── Prompt templates ─────────────────────────────────────────────────────────

export type AgentType =
  | 'weekly_nw'        // Full net worth weekly review
  | 'mf_review'        // MF-specific deep dive
  | 'debt_optimizer'   // Liability strategy
  | 'goal_tracker'     // Goals progress & gap analysis
  | 'tax_optimizer'    // Tax efficiency
  | 'rebalance'        // Portfolio rebalancing
  | 'alert_scan'       // Risk & opportunity scan
  | 'cash_flow'        // Monthly cash flow & liquidity
  | 'custom'           // Free-form

export function buildPrompt(type: AgentType, ctx: string, custom?: string): {
  prompt: string
  maxTokens: number
} {
  switch (type) {

    case 'weekly_nw':
      return {
        maxTokens: 600,
        prompt: `${ctx}

Generate a WhatsApp-style weekly net worth update for this user.

Format exactly:
📊 NW Score: X/100 (1-line rationale)
📈 Best asset move this week
📉 Biggest drag
⚠️ Top risk right now
💡 #1 action this week (specific ₹ amount + fund/account)
🎯 Goal on track / at risk
💳 Debt health: rate arbitrage opportunity or EMI burden note
💰 MF SIP status

Rules: exact names, exact ₹, max 200 words, no generic lines.`
      }

    case 'mf_review':
      return {
        maxTokens: 550,
        prompt: `${ctx}

Deep MF portfolio review. Output:

🏆 Best fund (name + return %)
⚠️ Weakest fund + reason to hold/exit
📊 Category allocation gap (core/growth/satellite %)
🔄 SIP efficiency: over/under-deployed funds
💎 Lumpsum opportunity right now (fund + ₹)
📉 XIRR vs benchmark comment
🎯 Corpus needed to hit nearest unmet goal
📅 Next SIP action (date-specific)

Max 180 words. Fund names must match context exactly.`
      }

    case 'debt_optimizer':
      return {
        maxTokens: 450,
        prompt: `${ctx}

Debt optimization analysis. Output:

🔴 Highest-cost loan (rate + outstanding)
💡 Rate arbitrage: MF XIRR ${`{XIRR}`}% vs loan rates — prepay or invest?
📅 Recommended prepayment order (highest rate first)
💰 Optimal monthly allocation: EMI vs SIP vs prepayment
🏦 Refinancing opportunity (if any rate > 9%)
⚡ One action this month to reduce interest burden by most ₹

Max 150 words. Use exact loan names and ₹ amounts.`
      }

    case 'goal_tracker':
      return {
        maxTokens: 500,
        prompt: `${ctx}

Goal gap analysis. For each goal:
- Current progress %
- Monthly SIP needed to close gap by target date
- On track / at risk verdict

Then:
🎯 Goal most at risk + rescue plan
💡 Goal achievable earliest + current trajectory
📊 Overall goal funding score X/10
⚡ One reallocation to accelerate top goal

Max 180 words. Use goal names from context.`
      }

    case 'tax_optimizer':
      return {
        maxTokens: 500,
        prompt: `${ctx}

Indian tax optimization for this portfolio. Current date context: FY ending Mar 2026.

Output:
📋 LTCG harvesting opportunity (which fund, est. ₹ gain, tax saving)
💡 ELSS allocation vs current tax-saving investments
⚠️ STCG exposure (funds held < 1 year)
🏠 Property: if any sale planned, indexation note
💳 Home loan interest deduction optimization
🔄 Debt fund shift post-indexation removal
⚡ Before Mar 31 action (specific ₹ + fund)

Max 160 words. Reference actual fund names.`
      }

    case 'rebalance':
      return {
        maxTokens: 550,
        prompt: `${ctx}

Portfolio rebalancing analysis. Output:

📊 Current allocation vs ideal (equity/debt/property/cash %)
🔴 Overweight: which asset, by how much ₹
🟢 Underweight: which asset, opportunity
🔄 Specific rebalance trade:
   → Reduce: [fund/asset] by ₹X
   → Add:    [fund/asset] by ₹X
   → Timeline: [when]
💡 SIP redirection: any fund to pause/increase
⚡ One-line net worth impact of doing this

Max 160 words. Exact fund names and ₹ amounts only.`
      }

    case 'alert_scan':
      return {
        maxTokens: 500,
        prompt: `${ctx}

Scan for risks and opportunities across full net worth.

🔴 CRITICAL (act within 7 days):
🟡 WATCH (act within 30 days):
🟢 OPPORTUNITY (act within 90 days):

Scan areas: EMI burden, concentration risk, underperforming funds,
goal timeline breach, property illiquidity, cash drag,
tax deadline, rate arbitrage, SIP amount vs income proxy.

Max 3 items per category. Each item: [issue] → [specific action] → [₹ impact].
Max 160 words total.`
      }

    case 'cash_flow':
      return {
        maxTokens: 400,
        prompt: `${ctx}

Monthly cash flow & liquidity analysis.

💸 Monthly outflow: EMI (${`{EMI}`}/mo) + SIP (${`{SIP}`}/mo) = total committed
🏦 Liquid cash runway: ${`{CASH}`} ÷ monthly committed = X months
⚠️ Liquidity ratio vs recommended 6-month emergency fund
💡 Cash drag: idle cash that should be in liquid/arbitrage fund
🔄 Optimization: move ₹X from [account] to [fund] for Y% better return
📈 If corpus grows 13%: in 12M cash flow improves by ₹Z

Max 130 words.`
      }

    case 'custom':
      return {
        maxTokens: 700,
        prompt: `${ctx}\n\n${custom || 'Provide a portfolio overview.'}`
      }

    default:
      return { maxTokens: 400, prompt: ctx }
  }
}

// ─── Token cost estimation ────────────────────────────────────────────────────
// Rough: 1 token ≈ 4 chars. Input context ~800 tokens + prompt ~200 = ~1000 input.
export const DAILY_TOKEN_LIMIT = 15000   // per user per day
export const CONTEXT_TOKEN_EST = 1100    // estimated input tokens per call
export function estimateTotalTokens(maxOutputTokens: number): number {
  return CONTEXT_TOKEN_EST + maxOutputTokens
}
