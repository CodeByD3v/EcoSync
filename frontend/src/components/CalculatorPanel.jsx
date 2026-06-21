import { Car, Plane, Zap, Salad, ShoppingBag, Leaf } from 'lucide-react'
import Card from './Card.jsx'

const CATEGORY_ICONS = {
  energy: Zap,
  transport: Car,
  flights: Plane,
  diet: Salad,
  shopping: ShoppingBag,
}

const CATEGORY_COLORS = {
  energy: 'text-sky-400',
  transport: 'text-amber-500',
  flights: 'text-red-400',
  diet: 'text-emerald-400',
  shopping: 'text-indigo-400',
}

function SliderRow({ label, icon: Icon, color, min, max, step, value, unit, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <Icon size={16} className={color} />
          {label}
        </span>
        <span className="font-semibold text-white">
          {value}
          <span className="ml-1 text-xs text-slate-400">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-eco-neon bg-panelborder rounded-lg appearance-none h-1.5"
      />
    </div>
  )
}

export default function CalculatorPanel({ inputs, onChange, footprint }) {
  return (
    <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
      {/* Input Sliders */}
      <Card
        title="Lifestyle Inputs"
        subtitle="Adjust the sliders to update your carbon footprint in real-time."
        icon={Leaf}
      >
        <div className="space-y-6">
          {/* Transport */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transport</h3>
            <SliderRow
              label="Weekly Driving Distance"
              icon={Car}
              color={CATEGORY_COLORS.transport}
              min={0}
              max={1000}
              step={10}
              value={inputs.km_driven_per_week}
              unit=" km"
              onChange={(val) => onChange('km_driven_per_week', val)}
            />
            <SliderRow
              label="Flights Per Year"
              icon={Plane}
              color={CATEGORY_COLORS.flights}
              min={0}
              max={20}
              step={1}
              value={inputs.flights_per_year}
              unit=" flights"
              onChange={(val) => onChange('flights_per_year', val)}
            />
          </div>

          <hr className="border-panelborder" />

          {/* Home Energy */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Home Energy</h3>
            <SliderRow
              label="Monthly Electricity Use"
              icon={Zap}
              color={CATEGORY_COLORS.energy}
              min={0}
              max={1000}
              step={10}
              value={inputs.kwh_per_month}
              unit=" kWh"
              onChange={(val) => onChange('kwh_per_month', val)}
            />
          </div>

          <hr className="border-panelborder" />

          {/* Diet */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diet</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-slate-300 flex items-center gap-2">
                <Salad size={16} className={CATEGORY_COLORS.diet} />
                Diet Type
              </label>
              <select
                value={inputs.diet}
                onChange={(e) => onChange('diet', e.target.value)}
                className="w-full rounded-xl border border-panelborder bg-slatebg/60 px-4 py-2.5 text-sm text-white focus:border-eco-neon outline-none"
              >
                <option value="meat_heavy">Meat-heavy 🥩</option>
                <option value="mixed">Flexitarian / Mixed</option>
                <option value="vegetarian">Vegetarian 🥗</option>
                <option value="vegan">Vegan 🌱</option>
              </select>
            </div>
          </div>

          <hr className="border-panelborder" />

          {/* Shopping */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Shopping</h3>
            <SliderRow
              label="New Items Purchased"
              icon={ShoppingBag}
              color={CATEGORY_COLORS.shopping}
              min={0}
              max={30}
              step={1}
              value={inputs.new_items_per_month}
              unit=" items/mo"
              onChange={(val) => onChange('new_items_per_month', val)}
            />
          </div>
        </div>
      </Card>

      {/* Summary Box */}
      <Card
        title="Calculated Baseline"
        subtitle="Current annual footprint estimation."
        icon={Leaf}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="text-5xl font-extrabold tracking-tight text-eco-neon">
              {(footprint.total_kg / 1000).toFixed(2)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">
              Tonnes CO₂ / year
            </span>
          </div>

          <div className="space-y-2 bg-slatebg/40 border border-panelborder rounded-xl p-4">
            {footprint.breakdown.map((c) => {
              const key = c.name.toLowerCase().includes('energy') ? 'energy' : (
                c.name.toLowerCase().includes('transport') ? 'transport' : (
                  c.name.toLowerCase().includes('flight') ? 'flights' : (
                    c.name.toLowerCase().includes('diet') ? 'diet' : 'shopping'
                  )
                )
              )
              const Icon = CATEGORY_ICONS[key] ?? Leaf
              const color = CATEGORY_COLORS[key] ?? 'text-eco-neon'

              return (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-sm py-2 border-b border-panelborder/50 last:border-0"
                >
                  <span className="flex items-center gap-2 text-slate-300">
                    <Icon size={14} className={color} />
                    {c.name}
                  </span>
                  <span className="font-semibold text-white">
                    {c.kg.toLocaleString()} <span className="text-xs text-slate-500 font-normal">kg</span>
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between text-sm pt-3 font-bold text-eco-neon">
              <span>Total Footprint</span>
              <span>{footprint.total_kg.toLocaleString()} kg/yr</span>
            </div>
          </div>

          {/* Transparent Science Citations */}
          <div className="pt-2 text-[10px] text-slate-500 leading-relaxed border-t border-panelborder/50">
            <p className="font-bold text-slate-400 mb-1">Methodology & Sources:</p>
            <ul className="space-y-1 pl-3 list-disc">
              <li><span className="text-slate-400">Energy & Commute:</span> Regional grid intensity powered by India Central Electricity Authority (CEA) averages.</li>
              <li><span className="text-slate-400">Transport:</span> US Environmental Protection Agency (EPA) mobile combustion factors.</li>
              <li><span className="text-slate-400">Diet:</span> Intergovernmental Panel on Climate Change (IPCC) global diet lifecycle emissions.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
