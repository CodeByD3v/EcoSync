import { useMemo, useState } from 'react'
import { Car, CreditCard, Home, Leaf, Lock, MapPin, Salad, Zap } from 'lucide-react'
import { getGridFactor } from '../lib/gridFactors.js'
import { submitOnboarding } from '../api.js'

const COMMUTE_MAPPING = { drive: 200.0, two_wheeler: 120.0, transit: 50.0, walk: 0.0 }
const HOUSING_MAPPING = { house: 350.0, apartment: 200.0, shared: 100.0 }
const DIET_KG = { meat_heavy: 2500, mixed: 1500, vegetarian: 700, vegan: 300 }

// Neutral defaults so the live dial reads a sensible baseline before the user
// has made every lifestyle selection. These only feed the dial preview — the
// "Next" gating still requires explicit choices.
const CALC_DEFAULTS = { diet: 'mixed', commute: 'drive', housing: 'apartment' }

const DIET_OPTIONS = [
  { value: 'meat_heavy', label: 'Meat-heavy' },
  { value: 'mixed', label: 'Flexitarian' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
]
const COMMUTE_OPTIONS = [
  { value: 'drive', label: 'Drive alone' },
  { value: 'transit', label: 'Public transit' },
  { value: 'two_wheeler', label: 'Two-wheeler' },
  { value: 'walk', label: 'Walk / cycle' },
]
const HOUSING_OPTIONS = [
  { value: 'house', label: 'Independent house' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'shared', label: 'Shared / PG' },
]

const PERMISSION_ROWS = [
  {
    key: 'location',
    label: 'Location',
    description: 'Auto-detects walk / drive / transit. No data leaves your device.',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    description: 'Categorises purchases by carbon weight. Read-only.',
  },
  {
    key: 'utility',
    label: 'Utility account',
    description: 'Pulls real kWh instead of estimates.',
  },
]

function estimateFootprint(gridFactor, { diet, commute, housing }) {
  const kmPerWeek = COMMUTE_MAPPING[commute ?? CALC_DEFAULTS.commute]
  const kwhPerMonth = HOUSING_MAPPING[housing ?? CALC_DEFAULTS.housing]
  const dietVal = diet ?? CALC_DEFAULTS.diet
  const dietMapped = dietVal
  const d = DIET_KG[dietMapped] ?? 1500

  const transport = kmPerWeek * 52 * gridFactor.transportKm
  const energy = kwhPerMonth * 12 * gridFactor.gridKwh
  const flights = 2 * 255
  const shopping = 5 * 12 * 6.5
  return Math.round(transport + energy + flights + shopping + d)
}

// Animated 180° gauge. The arc colour reflects how the estimate compares to the
// local average and the fill animates via a CSS transition on the dash offset.
function CarbonDial({ value, avgAnnualKg }) {
  const radius = 70
  const cx = 90
  const cy = 80
  const circumference = Math.PI * radius

  const fraction = Math.min(1, value / (avgAnnualKg * 2))
  const offset = circumference * (1 - fraction)

  let color = '#34d399'
  if (value >= avgAnnualKg * 2) color = '#f87171'
  else if (value > avgAnnualKg) color = '#f59e0b'

  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="96" viewBox="0 0 180 96" className="overflow-visible">
        <path
          d={arc}
          fill="none"
          stroke="#1e2a35"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.4s ease' }}
        />
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          className="fill-white"
          style={{ fontSize: 22, fontWeight: 800 }}
        >
          {value.toLocaleString()}
        </text>
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 10 }}
        >
          kg CO₂/yr
        </text>
      </svg>
    </div>
  )
}

function ToggleChip({ active, onClick, children }) {
  const base =
    'rounded-full border px-4 py-2 text-sm cursor-pointer transition-colors'
  const state = active
    ? 'border-eco-neon bg-eco-neon/10 text-eco-neon font-semibold'
    : 'border-panelborder text-slate-400 hover:border-slate-500'
  return (
    <button type="button" onClick={onClick} className={`${base} ${state}`}>
      {children}
    </button>
  )
}

function PermissionRow({ icon: Icon, label, description, on, onToggle }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-panelborder bg-slatebg/40 px-3 py-3">
      <Icon size={16} className="shrink-0 text-eco-neon" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          on ? 'bg-eco-neon' : 'bg-panelborder'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

const INPUT_CLASS =
  'w-full rounded-xl border border-panelborder bg-slatebg/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-eco-neon'
const PRIMARY_BTN =
  'rounded-xl border border-eco-neon bg-eco-neon/10 px-5 py-2.5 text-sm font-semibold text-eco-neon transition-colors hover:bg-eco-neon/20 disabled:cursor-not-allowed disabled:opacity-40'

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [diet, setDiet] = useState(null)
  const [commute, setCommute] = useState(null)
  const [housing, setHousing] = useState(null)
  const [permissions, setPermissions] = useState({
    location: false,
    transactions: false,
    utility: false,
  })

  const gridFactor = useMemo(() => {
    if (!city.trim()) return { gridKwh: 0.82, transportKm: 0.21, avgAnnualKg: 2000 }
    return getGridFactor(city)
  }, [city])
  const liveFootprint = useMemo(() => {
    if (!city.trim() && diet === null && commute === null && housing === null) {
      return 2000
    }
    return estimateFootprint(gridFactor, { diet, commute, housing })
  }, [gridFactor, diet, commute, housing, city])

  const step1Valid = name.trim() !== '' && city.trim() !== '' && zipCode.trim() !== ''
  const step2Valid = diet !== null && commute !== null && housing !== null

  async function finish(finalPermissions) {
    const profile = {
      name: name.trim(),
      city: city.trim(),
      zip_code: zipCode.trim() || '560001',
      gridFactor,
      diet,
      commute,
      housing,
      permissions: finalPermissions,
    }

    try {
      await submitOnboarding({
        name: profile.name,
        city: profile.city,
        zip_code: profile.zip_code,
        diet: profile.diet,
        commute: profile.commute,
        housing: profile.housing,
        permissions: profile.permissions,
      })
    } catch (err) {
      console.warn("Backend onboarding failed or offline, proceeding offline:", err)
    }

    onComplete(profile)
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="relative w-full max-w-lg rounded-2xl border border-panelborder bg-panel p-6 sm:p-8">
        {/* Logo + live dial */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-eco-neon">
            <Leaf size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">EcoSync</span>
          </div>
          <div className="-mt-2">
            <CarbonDial value={liveFootprint} avgAnnualKg={gridFactor.avgAnnualKg} />
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-2 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full border ${
                i === step
                  ? 'border-eco-neon bg-eco-neon'
                  : 'border-panelborder'
              }`}
            />
          ))}
        </div>

        {/* STEP 1 — baseline */}
        {step === 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold text-white">Let&apos;s set up your carbon baseline</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  First name
                </label>
                <input
                  className={INPUT_CLASS}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">City</label>
                <input
                  className={INPUT_CLASS}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai"
                />
                {city.trim().length >= 3 && (
                  <p className="mt-2 text-xs text-eco-neon">
                    Grid intensity for {city.trim()}: {gridFactor.gridKwh} kg CO₂/kWh · local avg{' '}
                    {(gridFactor.avgAnnualKg / 1000).toFixed(1)}t/yr
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Zip / Postal Code</label>
                <input
                  className={INPUT_CLASS}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="560001"
                />
              </div>
            </div>
            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={!step1Valid}
                onClick={() => setStep(1)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — lifestyle */}
        {step === 1 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold text-white">How do you live day to day?</h2>
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Salad size={16} className="text-eco-neon" />
                  Diet
                </div>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((o) => (
                    <ToggleChip key={o.value} active={diet === o.value} onClick={() => setDiet(o.value)}>
                      {o.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Car size={16} className="text-eco-neon" />
                  Commute
                </div>
                <div className="flex flex-wrap gap-2">
                  {COMMUTE_OPTIONS.map((o) => (
                    <ToggleChip
                      key={o.value}
                      active={commute === o.value}
                      onClick={() => setCommute(o.value)}
                    >
                      {o.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Home size={16} className="text-eco-neon" />
                  Housing
                </div>
                <div className="flex flex-wrap gap-2">
                  {HOUSING_OPTIONS.map((o) => (
                    <ToggleChip
                      key={o.value}
                      active={housing === o.value}
                      onClick={() => setHousing(o.value)}
                    >
                      {o.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-7 flex items-center justify-between">
              <button
                type="button"
                className="px-2 py-2 text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setStep(0)}
              >
                Back
              </button>
              <button
                type="button"
                className={PRIMARY_BTN}
                disabled={!step2Valid}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — permissions */}
        {step === 2 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold text-white">Make EcoSync automatic</h2>
            <p className="mt-1 text-sm text-slate-400">
              All optional. Connect later from Settings anytime.
            </p>
            <div className="mt-5 space-y-3">
              {PERMISSION_ROWS.map((row) => (
                <PermissionRow
                  key={row.key}
                  icon={{ location: MapPin, transactions: CreditCard, utility: Zap }[row.key] ?? Leaf}
                  label={row.label}
                  description={row.description}
                  on={permissions[row.key]}
                  onToggle={() =>
                    setPermissions((p) => ({ ...p, [row.key]: !p[row.key] }))
                  }
                />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-panelborder px-3 py-2 text-xs text-slate-400">
              <Lock size={14} className="shrink-0 text-eco-neon" />
              Encrypted at rest · Isolated cryptographic keys · Routines never leave your profile
            </div>
            <div className="mt-7 flex items-center justify-between">
              <button
                type="button"
                className="px-2 py-2 text-sm text-slate-400 hover:text-slate-200"
                onClick={() =>
                  finish({ location: false, transactions: false, utility: false })
                }
              >
                Skip for now
              </button>
              <button type="button" className={PRIMARY_BTN} onClick={() => finish(permissions)}>
                Finish setup →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
