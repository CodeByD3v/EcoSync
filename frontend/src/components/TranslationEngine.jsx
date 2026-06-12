import { Smartphone, Utensils, Car, Trees } from 'lucide-react'
import Card from './Card.jsx'

export default function TranslationEngine({ dailyValue }) {
  // Equivalents logic based on standard emissions factors:
  // 1. Smartphone Charge: ~0.008 kg CO2e
  const smartphones = Math.round(dailyValue / 0.008)

  // 2. Cheeseburger: ~6.6 kg CO2e
  const burgers = (dailyValue / 6.6).toFixed(1)

  // 3. Indian Petrol Car: ~0.21 kg CO2e / km
  const kmDriven = Math.round(dailyValue / 0.21)

  // 4. Tree Absorption: ~0.06 kg CO2e / day (22 kg / year)
  const treeDays = Math.round(dailyValue / 0.06)

  const items = [
    {
      label: 'Smartphone Charges',
      value: smartphones.toLocaleString(),
      desc: 'power cycles of a mobile battery',
      icon: Smartphone,
      color: 'text-sky-400 bg-sky-400/10',
    },
    {
      label: 'Cheeseburger Index',
      value: burgers,
      desc: 'standard beef burgers consumed',
      icon: Utensils,
      color: 'text-amber-400 bg-amber-400/10',
    },
    {
      label: 'Petrol Car Travel',
      value: `${kmDriven} km`,
      desc: 'distance driven in an average petrol car',
      icon: Car,
      color: 'text-indigo-400 bg-indigo-400/10',
    },
    {
      label: 'Tree Absorption',
      value: `${treeDays} trees`,
      desc: 'absorbing your carbon for an entire day',
      icon: Trees,
      color: 'text-emerald-400 bg-emerald-400/10',
    },
  ]

  return (
    <Card
      title="The Translation Engine"
      subtitle="Converting abstract carbon weights into daily physical equivalents."
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
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
