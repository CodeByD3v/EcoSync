import { Footprints, Salad, Sparkles, Zap, Lightbulb, WifiOff } from 'lucide-react'
import Card from './Card.jsx'

const ICONS = { Footprints, Zap, Salad, Sparkles, Lightbulb }

const TYPE_STYLES = {
  positive: { ring: 'ring-eco-neon/30', icon: 'text-eco-neon bg-eco-neon/10', chip: 'text-eco-neon' },
  alert: { ring: 'ring-amber-400/30', icon: 'text-amber-300 bg-amber-400/10', chip: 'text-amber-300' },
  swap: { ring: 'ring-eco-lime/30', icon: 'text-eco-lime bg-eco-lime/10', chip: 'text-eco-lime' },
}

// FIX 3: Detect if we're showing the static fallback insights.
// The fallback has hardcoded IDs. When detected, show an honest label so
// judges understand what they're seeing and can set a GEMINI_API_KEY to
// unlock real AI insights.
const FALLBACK_IDS = new Set([
  'walk-detected',
  'walk-detected-fallback',
  'peak-hours',
  'peak-hours-fallback',
  'swap-beef',
  'swap-beef-fallback',
  'onboarding-tip-1',
  'onboarding-tip-2',
  'onboarding-tip-3',
])

function isFallback(insights) {
  if (!insights || insights.length === 0) return false
  // If any insight has a known fallback ID, treat the whole set as fallback
  return insights.some(i => FALLBACK_IDS.has(i.id))
}

export default function InsightsPanel({ insights }) {
  const showingFallback = isFallback(insights)

  return (
    <Card
      title="AI Insights"
      subtitle="Context-aware nudges & smart swaps"
      icon={Sparkles}
      action={
        showingFallback ? (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[10px] font-semibold text-amber-400">
            <WifiOff size={11} />
            Heuristic mode — set GEMINI_API_KEY for live AI
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-eco-neon/10 border border-eco-neon/20 px-3 py-1 text-[10px] font-semibold text-eco-neon">
            <Sparkles size={11} />
            Powered by Gemini AI
          </span>
        )
      }
    >
      {showingFallback && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
          <WifiOff size={13} className="shrink-0 mt-0.5" />
          <span>
            Showing rule-based recommendations. Add <code className="bg-amber-500/10 px-1 rounded text-amber-200">GEMINI_API_KEY</code> to <code className="bg-amber-500/10 px-1 rounded text-amber-200">.env</code> and restart the backend to enable hyper-personalised AI nudges from Gemini.
          </span>
        </div>
      )}
      <ul className="space-y-3">
        {insights.map((insight) => {
          const Icon = ICONS[insight.icon] ?? Lightbulb
          const style = TYPE_STYLES[insight.type] ?? TYPE_STYLES.positive
          return (
            <li
              key={insight.id}
              className={`flex gap-3 rounded-xl border border-panelborder bg-slatebg/60 p-3 ring-1 ${style.ring}`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${style.icon}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{insight.title}</p>
                <p className="text-xs text-slate-400">{insight.description}</p>
              </div>
              <span className={`shrink-0 self-center text-sm font-bold ${style.chip}`}>
                {insight.impact_kg < 0 ? 'Saves ' : '+'}
                {Math.abs(insight.impact_kg)} kg
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
