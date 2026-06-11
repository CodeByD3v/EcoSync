import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from 'recharts'

// Radial "Daily Impact" gauge. The arc fills relative to a daily target so a
// lower footprint visually reads as a smaller, calmer arc.
export default function ImpactGauge({ value, target = 20, unit = 'kg CO2e' }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  const data = [{ name: 'impact', value: pct, fill: '#34d399' }]

  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="78%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: '#1e2a35' }} dataKey="value" cornerRadius={12} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tracking-tight text-white">{value}</span>
        <span className="text-xs font-medium text-slate-400">{unit}</span>
        <span className="mt-1 text-[10px] uppercase tracking-widest text-eco-neon">today</span>
      </div>
    </div>
  )
}
