import { Footprints, Salad, Sparkles, Zap, Lightbulb } from 'lucide-react'
import Card from './Card.jsx'

// Map backend icon names to concrete lucide-react components.
const ICONS = { Footprints, Zap, Salad, Sparkles, Lightbulb }

const TYPE_STYLES = {
  positive: { ring: 'ring-eco-neon/30', icon: 'text-eco-neon bg-eco-neon/10', chip: 'text-eco-neon' },
  alert: { ring: 'ring-amber-400/30', icon: 'text-amber-300 bg-amber-400/10', chip: 'text-amber-300' },
  swap: { ring: 'ring-eco-lime/30', icon: 'text-eco-lime bg-eco-lime/10', chip: 'text-eco-lime' },
}

export default function InsightsPanel({ insights }) {
  return (
    <Card
      title="AI Insights"
      subtitle="Context-aware nudges & smart swaps"
      icon={Sparkles}
    >
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
                {insight.impact_kg < 0 ? 'Saved ' : '+'}
                {Math.abs(insight.impact_kg)} kg
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
