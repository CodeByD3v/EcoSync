import { useEffect, useState } from 'react'
import { Leaf, WifiOff } from 'lucide-react'
import Header from './components/Header.jsx'
import BreakdownChart from './components/BreakdownChart.jsx'
import InsightsPanel from './components/InsightsPanel.jsx'
import ActionsChecklist from './components/ActionsChecklist.jsx'
import { completeAction, getActions, getDailyFootprint, getInsights } from './api.js'
import { FALLBACK_ACTIONS, FALLBACK_FOOTPRINT, FALLBACK_INSIGHTS } from './fallbackData.js'
import useUserProfile from './hooks/useUserProfile.js'
import Onboarding from './components/Onboarding.jsx'

export default function App() {
  const { profile, saveProfile } = useUserProfile()
  const [footprint, setFootprint] = useState(null)
  const [insights, setInsights] = useState([])
  const [actions, setActions] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [pending, setPending] = useState(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [fp, ins, acts] = await Promise.all([
          getDailyFootprint(),
          getInsights(),
          getActions(),
        ])
        if (cancelled) return
        setFootprint(fp)
        setInsights(ins)
        setActions(acts)
        setTotalPoints(acts.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
      } catch {
        if (cancelled) return
        // The API is unreachable — fall back to the bundled demo data so the
        // dashboard still renders perfectly.
        setOffline(true)
        setFootprint(FALLBACK_FOOTPRINT)
        setInsights(FALLBACK_INSIGHTS)
        setActions(FALLBACK_ACTIONS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle(action) {
    const nextCompleted = !action.completed
    setPending(action.id)
    try {
      if (offline) {
        // Optimistically update local state when running without a backend.
        const updated = actions.map((a) =>
          a.id === action.id ? { ...a, completed: nextCompleted } : a,
        )
        setActions(updated)
        setTotalPoints(updated.filter((a) => a.completed).reduce((s, a) => s + a.points, 0))
      } else {
        const res = await completeAction(action.id, nextCompleted)
        setActions(res.actions)
        setTotalPoints(res.total_points)
      }
    } finally {
      setPending(null)
    }
  }

  // Gate the dashboard behind a one-time onboarding flow. Placed after the
  // hooks above so hook order stays stable across the onboarding → dashboard
  // transition (an early return before those hooks would violate the Rules of
  // Hooks).
  if (!profile) return <Onboarding onComplete={saveProfile} />

  if (loading || !footprint) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <div className="flex items-center gap-3">
          <Leaf className="animate-pulse text-eco-neon" />
          Loading your footprint…
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {offline && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-300">
          <WifiOff size={14} />
          API offline — showing bundled demo data.
        </div>
      )}

      <Header footprint={footprint} />

      <main className="mt-5 grid gap-5 lg:grid-cols-2">
        <BreakdownChart
          breakdown={footprint.breakdown}
          total={footprint.total_kg}
          unit={footprint.unit}
        />
        <InsightsPanel insights={insights} />
        <div className="lg:col-span-2">
          <ActionsChecklist
            actions={actions}
            totalPoints={totalPoints}
            onToggle={handleToggle}
            pending={pending}
          />
        </div>
      </main>

      <footer className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-600">
        <Leaf size={13} className="text-eco-green" />
        EcoSync — Carbon Footprint Awareness Platform
      </footer>
    </div>
  )
}
