import { Plane, Beef, Home, Snowflake, Calculator } from 'lucide-react'
import Card from './Card.jsx'

// The Translation Engine only shows when we have a REAL calculated footprint —
// i.e. one derived from the user's actual onboarding inputs (km driven, diet,
// kWh, flights, shopping). It refuses to render on the hardcoded fallback.
//
// How to tell the difference: App.jsx must pass `isCalculated={true}` only when
// footprint came from calculateFootprintLocal() or the live API, NOT from
// FALLBACK_FOOTPRINT. If isCalculated is false, we prompt the user to use the
// Calculator tab first so they have a real number to translate.
//
// Emission factors (IPCC AR6 / India CEA 2023):
//   Mumbai→Delhi return flight:  ~150 kg CO₂e  (ICAO calculator)
//   1 kg beef (lifecycle):        ~27 kg CO₂e   (IPCC AR6 Ch.7)
//   India avg home electricity:  200 kWh/mo × 0.82 kg/kWh = 164 kg CO₂e/mo
//   Arctic sea ice loss:         ~3 m² per tonne CO₂ (Notz & Stroeve, Nature 2016)

export default function TranslationEngine({ annualKg, isCalculated = false }) {
  // Guard: if this is just the fallback number, don't pretend it's the user's data
  if (!isCalculated || !annualKg) {
    return (
      <Card
        title="The Translation Engine"
        subtitle="Translates your personal footprint into everyday comparisons."
        icon={Calculator}
      >
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Calculator size={36} className="text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Your footprint hasn't been calculated yet.</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Use the <span className="text-eco-neon font-bold">Calculator tab</span> to enter your transport, energy, diet and shopping habits.
            Once you have a real number, this panel will translate it into things you can actually picture.
          </p>
        </div>
      </Card>
    )
  }

  const annualTonnes = annualKg / 1000

  const flights    = (annualKg / 150).toFixed(1)           // Mumbai→Delhi return
  const beefKg     = Math.round(annualKg / 27)             // kg of beef
  const homeMonths = (annualKg / 164).toFixed(1)           // months of avg Indian home electricity
  const iceArea    = (annualTonnes * 3).toFixed(1)         // m² Arctic sea ice

  const items = [
    {
      label: 'Mumbai → Delhi Flights',
      value: flights,
      unit: 'return trips',
      desc: '150 kg CO₂e per economy return flight (ICAO)',
      icon: Plane,
      color: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    },
    {
      label: 'Beef Produced',
      value: `${beefKg} kg`,
      unit: 'of beef',
      desc: '27 kg CO₂e per kg of beef, full lifecycle (IPCC AR6)',
      icon: Beef,
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    },
    {
      label: 'Home Electricity',
      value: homeMonths,
      unit: 'months powered',
      desc: 'average Indian household at 200 kWh/mo on the national grid',
      icon: Home,
      color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    },
    {
      label: 'Arctic Sea Ice Lost',
      value: `${iceArea} m²`,
      unit: 'melted permanently',
      desc: '3 m² per tonne CO₂ emitted (Notz & Stroeve, Nature 2016)',
      icon: Snowflake,
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    },
  ]

  return (
    <Card
      title="The Translation Engine"
      subtitle={`Your ${(annualKg / 1000).toFixed(2)} t CO₂e/yr — translated into things you can picture.`}
      icon={Plane}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={`flex items-center gap-3.5 rounded-xl border bg-slatebg/40 p-4 transition-all duration-300 hover:bg-slatebg/80 group ${item.color}`}
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${item.color}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl font-black text-white tracking-tight">{item.value}</span>
                  <span className="text-xs font-semibold text-slate-400">{item.unit}</span>
                </div>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">{item.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-600 italic text-center">
        Calculated from your inputs: {annualKg.toLocaleString()} kg CO₂e/yr. Sources: IPCC AR6, ICAO, India CEA 2023, Notz &amp; Stroeve (Nature 2016).
      </p>
    </Card>
  )
}
