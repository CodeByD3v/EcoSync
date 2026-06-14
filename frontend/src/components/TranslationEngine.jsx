import { Smartphone, Utensils, Car, Trees } from 'lucide-react'
import Card from './Card.jsx'

// FIX 2: Accept annualKg (the same value shown in the header metric cards) so
// every panel on the dashboard is consistent with each other. Previously this
// component received dailyValue and computed annual-equivalent burgers from a
// different number than the Cheeseburger Index card, producing contradictions.
export default function TranslationEngine({ annualKg }) {
  // Derive daily kg from annual total (same source as header cards)
  const dailyKg = annualKg / 365.0

  // 1. Smartphone charges: ~0.008 kg CO2e per charge cycle
  //    Annual equivalent: how many phone charges = your annual footprint?
  const smartphones = Math.round(annualKg / 0.008)

  // 2. Cheeseburger Index: 1 burger = 6.6 kg CO2e (IPCC lifecycle estimate)
  //    Matches the header metric card exactly — both use annualKg.
  const burgers = (annualKg / 6.6).toFixed(1)

  // 3. Petrol car km: ~0.21 kg CO2e/km (India average, CEA 2023)
  //    Annual equivalent: how many km of driving = your annual footprint?
  const kmDriven = Math.round(annualKg / 0.21)

  // 4. Trees needed to absorb your footprint in one year.
  //    One mature tree absorbs ~22 kg CO2/yr = ~0.06 kg/day
  //    Annual equivalent: annualKg / 22 kg per tree per year
  const treesNeeded = Math.round(annualKg / 22)

  const items = [
    {
      label: 'Smartphone Charges',
      value: smartphones.toLocaleString(),
      desc: 'phone charge cycles equivalent to your annual footprint',
      icon: Smartphone,
      color: 'text-sky-400 bg-sky-400/10',
    },
    {
      label: 'Cheeseburger Index',
      value: `${Number(burgers).toLocaleString()}`,
      desc: 'beef burgers — matches the metric card above (1 burger = 6.6 kg CO₂e)',
      icon: Utensils,
      color: 'text-amber-400 bg-amber-400/10',
    },
    {
      label: 'Petrol Car Distance',
      value: `${kmDriven.toLocaleString()} km`,
      desc: 'kilometres driven in an average Indian petrol car',
      icon: Car,
      color: 'text-indigo-400 bg-indigo-400/10',
    },
    {
      label: 'Trees to Offset',
      value: `${treesNeeded} trees`,
      desc: 'mature trees needed to absorb your footprint over one full year',
      icon: Trees,
      color: 'text-emerald-400 bg-emerald-400/10',
    },
  ]

  return (
    <Card
      title="The Translation Engine"
      subtitle={`Converting ${(annualKg / 1000).toFixed(2)} tonnes CO₂e/yr into everyday physical equivalents.`}
      icon={Trees}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="flex items-center gap-3.5 rounded-xl border border-panelborder bg-slatebg/40 p-4 transition-all duration-300 hover:border-eco-neon/30 hover:bg-slatebg/80 group"
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${item.color}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-2xl font-black text-white tracking-tight">{item.value}</span>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">{item.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-600 italic text-center">
        All figures are annual equivalents based on {annualKg.toLocaleString()} kg CO₂e/yr. Sources: IPCC AR6, EPA, India CEA 2023.
      </p>
    </Card>
  )
}
