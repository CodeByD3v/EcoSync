import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Leaf, TrendingDown, TrendingUp } from 'lucide-react'
import ImpactGauge from './ImpactGauge.jsx'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Header({ footprint, profileName }) {
  const { user_name, total_kg, delta_kg, unit, trend } = footprint
  const improved = delta_kg <= 0
  const TrendIcon = improved ? TrendingDown : TrendingUp

  // Calculate daily averages from the annual total
  const dailyValue = Math.round((total_kg / 365.0) * 10) / 10
  const dailyDelta = Math.round((Math.abs(delta_kg) / 365.0) * 10) / 10

  return (
    <header className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {/* Greeting + headline */}
      <div className="flex flex-col justify-between rounded-2xl border border-panelborder bg-gradient-to-br from-panel to-slatebg p-6">
        <div>
          <div className="flex items-center gap-2 text-eco-neon">
            <Leaf size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">EcoSync</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            {greeting()}, {profileName || user_name}.
          </h1>
          <p className="mt-1 max-w-md text-sm text-slate-400">
            Here is your real-time carbon footprint. Small daily choices compound into a
            lighter planet.
          </p>
        </div>

        <div className="mt-6 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: '#34d399', strokeOpacity: 0.3 }}
                contentStyle={{
                  background: '#0b0f14',
                  border: '1px solid #1e2a35',
                  borderRadius: 12,
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v) => [`${v} kg`, 'Monthly Footprint']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#trendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">6-Month history</p>
      </div>

      {/* Daily Impact gauge */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-panelborder bg-panel/80 p-6 text-center backdrop-blur">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Daily Impact
        </span>
        <div className="my-2">
          <ImpactGauge value={dailyValue} unit="kg CO₂e" />
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            improved
              ? 'bg-eco-neon/10 text-eco-neon'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          <TrendIcon size={16} />
          {dailyDelta} kg {improved ? 'less than average' : 'more than average'}
        </div>
      </div>
    </header>
  )
}
