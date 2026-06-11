import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import Card from './Card.jsx'

export default function BreakdownChart({ breakdown, total, unit }) {
  return (
    <Card title="Footprint Breakdown" subtitle="Where today's emissions come from" icon={PieIcon}>
      <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: '#0b0f14',
                  border: '1px solid #1e2a35',
                  borderRadius: 12,
                  color: '#e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v, n) => [`${v}%`, n]}
              />
              <Pie
                data={breakdown}
                dataKey="percentage"
                nameKey="name"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={3}
                stroke="none"
              >
                {breakdown.map((c) => (
                  <Cell key={c.name} fill={c.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{total}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">{unit}</span>
          </div>
        </div>

        <ul className="space-y-3">
          {breakdown.map((c) => (
            <li key={c.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
              <span className="font-semibold text-white">
                {c.percentage}%
                <span className="ml-2 text-xs font-normal text-slate-400">{c.kg} kg</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
