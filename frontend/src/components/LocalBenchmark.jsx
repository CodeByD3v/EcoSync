import { MapPin, TrendingDown, Info } from 'lucide-react'
import Card from './Card.jsx'

export default function LocalBenchmark({ userFootprint, zipCode, avgAnnualKg }) {
  const userVal = userFootprint // e.g. 3100 kg
  const zipAvg = avgAnnualKg // e.g. 2000 kg
  const greenTarget = Math.round(zipAvg * 0.45) // Top 10% target

  const maxVal = Math.max(userVal, zipAvg, greenTarget) * 1.15

  const userPct = Math.round((userVal / maxVal) * 100)
  const avgPct = Math.round((zipAvg / maxVal) * 100)
  const greenPct = Math.round((greenTarget / maxVal) * 100)

  const isMoreEfficient = userVal <= zipAvg
  const diffPct = Math.round(Math.abs((userVal - zipAvg) / zipAvg) * 100)

  return (
    <Card
      title={`Zip Code ${zipCode || '560001'} Benchmarking`}
      subtitle="How you compare to similar households in your immediate zip-code."
      icon={MapPin}
    >
      <div className="space-y-5">
        {/* Efficiency summary badge */}
        <div className={`flex items-start gap-2.5 rounded-xl p-3 border ${
          isMoreEfficient 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <TrendingDown size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">
              {isMoreEfficient ? 'Eco Leader: ' : 'Opportunity: '}
            </span>
            You are emitting {diffPct}% {isMoreEfficient ? 'less' : 'more'} carbon than the local baseline average in your neighborhood.
          </div>
        </div>

        {/* Custom Bar Graphs */}
        <div className="space-y-4">
          {/* USER */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-white">
              <span>You (Alex)</span>
              <span>{(userVal / 1000).toFixed(2)} tonnes/yr</span>
            </div>
            <div className="h-3 w-full bg-panelborder/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-glow ${
                  isMoreEfficient ? 'bg-gradient-to-r from-emerald-500 to-eco-neon' : 'bg-gradient-to-r from-orange-500 to-rose-500'
                }`}
                style={{ width: `${userPct}%` }}
              />
            </div>
          </div>

          {/* ZIP AVG */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Zip {zipCode || '560001'} Average</span>
              <span>{(zipAvg / 1000).toFixed(2)} tonnes/yr</span>
            </div>
            <div className="h-3 w-full bg-panelborder/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-500 transition-all duration-700"
                style={{ width: `${avgPct}%` }}
              />
            </div>
          </div>

          {/* TOP 10% GREEN */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-eco-lime">
              <span>Greenest 10% (Neighborhood Goal)</span>
              <span>{(greenTarget / 1000).toFixed(2)} tonnes/yr</span>
            </div>
            <div className="h-3 w-full bg-panelborder/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${greenPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Anonymized metrics disclaimer */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
          <Info size={12} className="shrink-0" />
          <span>Calculated using anonymized electricity grid inputs and public zip-level censuses.</span>
        </div>
      </div>
    </Card>
  )
}
