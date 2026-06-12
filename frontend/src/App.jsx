import { useEffect, useState, useMemo } from 'react'
import { Leaf, WifiOff, LayoutDashboard, Calculator, ListChecks, Trophy, TrendingDown, TrendingUp } from 'lucide-react'
import Header from './components/Header.jsx'
import BreakdownChart from './components/BreakdownChart.jsx'
import InsightsPanel from './components/InsightsPanel.jsx'
import ActionsChecklist from './components/ActionsChecklist.jsx'
import CalculatorPanel from './components/CalculatorPanel.jsx'
import ChallengesPanel from './components/ChallengesPanel.jsx'
import Card from './components/Card.jsx'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  completeAction,
  getActions,
  getDailyFootprint,
  getInsights,
  getUserProfile,
  calculateFootprint,
  getChallenges,
} from './api.js'
import {
  FALLBACK_ACTIONS,
  FALLBACK_FOOTPRINT,
  FALLBACK_INSIGHTS,
  FALLBACK_PROFILE,
  FALLBACK_CHALLENGES,
} from './fallbackData.js'
import useUserProfile from './hooks/useUserProfile.js'
import Onboarding from './components/Onboarding.jsx'

// Local carbon factors fallback if backend is offline
const LOCAL_EF = {
  car_per_km: 0.21,
  flight_per_trip: 255,
  electricity_per_kwh: 0.82,
  diet: { meat_heavy: 2500, mixed: 1500, vegetarian: 700, vegan: 300 },
  shopping_per_item: 6.5,
}

function calculateFootprintLocal(inputs) {
  const car = Math.round(inputs.km_driven_per_week * 52 * LOCAL_EF.car_per_km)
  const fly = Math.round(inputs.flights_per_year * LOCAL_EF.flight_per_trip)
  const elec = Math.round(inputs.kwh_per_month * 12 * LOCAL_EF.electricity_per_kwh)
  const food = LOCAL_EF.diet[inputs.diet] ?? 1500
  const shop = Math.round(inputs.new_items_per_month * 12 * LOCAL_EF.shopping_per_item)
  const total = car + fly + elec + food + shop

  return {
    user_name: 'Arjun',
    date: new Date().toISOString().slice(0, 10),
    total_kg: total,
    yesterday_kg: total + 120,
    delta_kg: -120.0,
    unit: 'kg CO2e',
    breakdown: [
      { name: 'Home Energy', percentage: Math.round((elec / total) * 100) || 0, kg: elec, color: '#185FA5' },
      { name: 'Transport', percentage: Math.round((car / total) * 100) || 0, kg: car, color: '#D85A30' },
      { name: 'Flights', percentage: Math.round((fly / total) * 100) || 0, kg: fly, color: '#993C1D' },
      { name: 'Diet', percentage: Math.round((food / total) * 100) || 0, kg: food, color: '#3B6D11' },
      { name: 'Shopping', percentage: Math.round((shop / total) * 100) || 0, kg: shop, color: '#534AB7' },
    ],
    trend: [
      { label: 'Jan', value: 420 },
      { label: 'Feb', value: 395 },
      { label: 'Mar', value: 370 },
      { label: 'Apr', value: 355 },
      { label: 'May', value: 340 },
      { label: 'Jun', value: Math.round(total / 12) },
    ],
  }
}

function StatusBadge({ total }) {
  const diff = total - 2000 // India Avg is 2000 kg/yr
  if (diff < -400) {
    return (
      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
        🌿 Eco Champion
      </span>
    )
  }
  if (diff < 200) {
    return (
      <span className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold px-3 py-1 rounded-full">
        Near average
      </span>
    )
  }
  if (diff < 800) {
    return (
      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full">
        Above average
      </span>
    )
  }
  return (
    <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold px-3 py-1 rounded-full">
      ⚠️ High footprint
    </span>
  )
}

export default function App() {
  const { profile, saveProfile, clearProfile } = useUserProfile()
  const [footprint, setFootprint] = useState(null)
  const [insights, setInsights] = useState([])
  const [actions, setActions] = useState([])
  const [challenges, setChallenges] = useState([])
  const [calcInputs, setCalcInputs] = useState(FALLBACK_PROFILE)
  const [totalPoints, setTotalPoints] = useState(0)
  const [pending, setPending] = useState(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [fp, ins, acts, chs, prof] = await Promise.all([
          getDailyFootprint(),
          getInsights(),
          getActions(),
          getChallenges(),
          getUserProfile(),
        ])
        if (cancelled) return
        setFootprint(fp)
        setInsights(ins)
        setActions(acts)
        setChallenges(chs)
        setCalcInputs({
          km_driven_per_week: prof.km_driven_per_week ?? 100,
          flights_per_year: prof.flights_per_year ?? 2,
          kwh_per_month: prof.kwh_per_month ?? 200,
          diet: prof.diet ?? 'mixed',
          new_items_per_month: prof.new_items_per_month ?? 5,
        })
        setTotalPoints(acts.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
      } catch {
        if (cancelled) return
        // API offline — load local state
        setOffline(true)
        setFootprint(FALLBACK_FOOTPRINT)
        setInsights(FALLBACK_INSIGHTS)
        setActions(FALLBACK_ACTIONS)
        setChallenges(FALLBACK_CHALLENGES)
        setCalcInputs(FALLBACK_PROFILE)
        setTotalPoints(FALLBACK_ACTIONS.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (profile) {
      load()
    } else {
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [profile])

  async function handleToggle(action) {
    const nextCompleted = !action.completed
    setPending(action.id)
    try {
      if (offline) {
        const updatedActions = actions.map((a) =>
          a.id === action.id ? { ...a, completed: nextCompleted } : a,
        )
        setActions(updatedActions)
        setTotalPoints(updatedActions.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))

        // Optimistically update challenge progress locally
        const delta = nextCompleted ? 1 : -1
        const updatedChallenges = challenges.map((ch) => {
          let matches = false
          if ((action.id === 'meatless-monday' || action.id === 'plant-lunch') && ch.id === 'meatless-monday-streak') matches = true
          if ((action.id === 'public-transit' || action.id === 'walk-trips') && ch.id === 'zero-drive-week') matches = true
          if ((action.id === 'unplug-devices' || action.id === 'set-ac-26' || action.id === 'cold-wash') && ch.id === 'solar-switch-collective') matches = true

          if (matches) {
            return { ...ch, progress: Math.min(ch.goal, Math.max(0, ch.progress + delta)) }
          }
          return ch
        })
        setChallenges(updatedChallenges)
      } else {
        const res = await completeAction(action.id, nextCompleted)
        setActions(res.actions)
        setTotalPoints(res.total_points)
        // Refresh challenges live on point increments
        const chs = await getChallenges()
        setChallenges(chs)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPending(null)
    }
  }

  async function handleSliderChange(key, value) {
    const nextInputs = { ...calcInputs, [key]: value }
    setCalcInputs(nextInputs)

    try {
      if (offline) {
        const calculated = calculateFootprintLocal(nextInputs)
        setFootprint(calculated)
      } else {
        const calculated = await calculateFootprint(nextInputs)
        setFootprint(calculated)
        // Re-fetch insights as emissions factors shift
        const nextInsights = await getInsights()
        setInsights(nextInsights)
      }
    } catch (err) {
      console.error(err)
    }
  const handleOnboardingComplete = async (profileData) => {
    saveProfile(profileData)
    setLoading(true)
    try {
      const [fp, ins, acts, chs, prof] = await Promise.all([
        getDailyFootprint(),
        getInsights(),
        getActions(),
        getChallenges(),
        getUserProfile(),
      ])
      setFootprint(fp)
      setInsights(ins)
      setActions(acts)
      setChallenges(chs)
      setCalcInputs({
        km_driven_per_week: prof.km_driven_per_week ?? 100,
        flights_per_year: prof.flights_per_year ?? 2,
        kwh_per_month: prof.kwh_per_month ?? 200,
        diet: prof.diet ?? 'mixed',
        new_items_per_month: prof.new_items_per_month ?? 5,
      })
      setTotalPoints(acts.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
      setOffline(false)
    } catch {
      setOffline(true)
      const calcInit = {
        km_driven_per_week: profileData.commute === 'drive' ? 200 : (profileData.commute === 'two_wheeler' ? 100 : 50),
        flights_per_year: 2,
        kwh_per_month: profileData.housing === 'house' ? 350 : (profileData.housing === 'apartment' ? 200 : 100),
        diet: profileData.diet === 'flexitarian' ? 'mixed' : profileData.diet,
        new_items_per_month: 5,
      }
      const calculated = calculateFootprintLocal(calcInit)
      setFootprint(calculated)
      setInsights(FALLBACK_INSIGHTS)
      setActions(FALLBACK_ACTIONS)
      setChallenges(FALLBACK_CHALLENGES)
      setCalcInputs(calcInit)
      setTotalPoints(FALLBACK_ACTIONS.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
    } finally {
      setLoading(false)
    }
  }

  // Gate dashboard behind one-time onboarding
  if (!profile) return <Onboarding onComplete={handleOnboardingComplete} />

  if (loading || !footprint) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <div className="flex items-center gap-3">
          <Leaf className="animate-pulse text-eco-neon animate-spin-slow" />
          {profile?.name ? `Loading your profile, ${profile.name}…` : 'Loading your carbon footprint profile…'}
        </div>
      </div>
    )
  }

  // Calculate high-fidelity dashboard metrics
  const diffPct = Math.round(Math.abs(footprint.total_kg - 2000) / 2000 * 100)
  const isAboveAvg = footprint.total_kg > 2000
  const cheeseburgerCount = Math.round(footprint.total_kg / 6.6)

  return (
    <div className="min-h-screen bg-slatebg text-slate-200">
      {/* Offline Banner */}
      {offline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300">
          <WifiOff size={14} />
          API Offline — Running client-side simulation & local calculation.
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12 space-y-6">
        {/* Top Navbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-panel/80 border border-panelborder rounded-2xl p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-eco-neon">
            <Leaf size={20} className="animate-spin-slow" />
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">EcoSync</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slatebg/80 border border-panelborder p-1 rounded-xl">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'calculator', label: 'Calculator', icon: Calculator },
              { id: 'actions', label: 'Actions Plan', icon: ListChecks },
            ].map((t) => {
              const Icon = t.icon
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-eco-neon/15 text-eco-neon shadow-glow border border-eco-neon/20'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )}
            )}
          </div>

          {/* User Profile Badge & Reset */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                clearProfile()
                setFootprint(null)
                setInsights([])
                setActions([])
                setChallenges([])
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 border border-panelborder hover:border-rose-500/20 bg-slatebg/40 px-3 py-1.5 rounded-xl transition"
            >
              Reset App
            </button>

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-eco-neon/20 border border-eco-neon/40 flex items-center justify-center text-xs font-bold text-eco-neon">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">{profile.name || 'User'}</p>
                <p className="text-[10px] text-slate-400">{profile.city || 'Location'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Greeting Header */}
            <Header footprint={footprint} profileName={profile?.name} />

            {/* Impact Metric Cards */}
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="bg-panel border border-panelborder rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Annual Footprint</span>
                <span className="text-3xl font-extrabold text-white mt-2">
                  {(footprint.total_kg / 1000).toFixed(2)} <span className="text-lg font-medium text-slate-500">tonnes</span>
                </span>
                <span className="text-xs text-slate-400 mt-1">{footprint.total_kg.toLocaleString()} kg CO₂e / yr</span>
              </div>

              <div className="bg-panel border border-panelborder rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">vs India Average</span>
                <span className={`text-3xl font-extrabold mt-2 ${isAboveAvg ? 'text-red-400' : 'text-eco-neon'}`}>
                  {isAboveAvg ? '+' : '-'}
                  {Math.abs((footprint.total_kg - 2000) / 1000).toFixed(2)}{' '}
                  <span className="text-lg font-medium text-slate-500">tonnes</span>
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {diffPct}% {isAboveAvg ? 'above' : 'below'} India baseline (2.0t)
                </span>
              </div>

              <div className="bg-panel border border-panelborder rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Cheeseburger Index</span>
                <span className="text-3xl font-extrabold text-indigo-400 mt-2">
                  {cheeseburgerCount.toLocaleString()}{' '}
                  <span className="text-lg font-medium text-slate-500">burgers</span>
                </span>
                <span className="text-xs text-slate-400 mt-1">equivalent emissions footprint</span>
              </div>
            </div>

            {/* Visualisations Layout */}
            <div className="grid gap-5 md:grid-cols-2">
              <BreakdownChart breakdown={footprint.breakdown} total={`${(footprint.total_kg / 1000).toFixed(1)}t`} unit="CO₂/yr" />

              {/* 6-Month Trend */}
              <Card title="6-Month History" subtitle="Your monthly emissions trajectory." icon={Leaf} action={<StatusBadge total={footprint.total_kg} />}>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={footprint.trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="trendFillApp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        cursor={{ stroke: '#34d399', strokeOpacity: 0.3 }}
                        contentStyle={{
                          background: '#111820',
                          border: '1px solid #1e2a35',
                          borderRadius: 12,
                          color: '#e2e8f0',
                          fontSize: 12,
                        }}
                        formatter={(v) => [`${v} kg CO₂`, 'Emissions']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.5} fill="url(#trendFillApp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between mt-3 text-[10px] uppercase tracking-widest text-slate-500">
                  {footprint.trend.map((t) => (
                    <span key={t.label}>{t.label}</span>
                  ))}
                </div>
              </Card>

              {/* Dynamic Insights Panel */}
              <div className="md:col-span-2">
                <InsightsPanel insights={insights} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: CALCULATOR */}
        {activeTab === 'calculator' && (
          <CalculatorPanel inputs={calcInputs} onChange={handleSliderChange} footprint={footprint} />
        )}

        {/* Tab 3: ACTIONS */}
        {activeTab === 'actions' && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <ActionsChecklist actions={actions} totalPoints={totalPoints} onToggle={handleToggle} pending={pending} />
            </div>
            <div className="md:col-span-2">
              <ChallengesPanel challenges={challenges} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
