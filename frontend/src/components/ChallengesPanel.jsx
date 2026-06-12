import { Users, Award, ShieldCheck } from 'lucide-react'
import Card from './Card.jsx'

export default function ChallengesPanel({ challenges }) {
  return (
    <Card
      title="Community Challenges"
      subtitle="Join collective actions and track real-time crowd progress."
      icon={Award}
    >
      <div className="space-y-4">
        {challenges.map((ch) => {
          const pct = Math.min(100, Math.round((ch.progress / ch.goal) * 100))
          return (
            <div
              key={ch.name}
              className="p-4 bg-slatebg/60 border border-panelborder rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-eco-lime" />
                  {ch.name}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Users size={12} className="text-slate-500" />
                  {ch.members} members
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-panelborder rounded-full overflow-hidden">
                  <div
                    className="h-full bg-eco-neon rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{ch.progress} completed</span>
                  <span>Goal: {ch.goal}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
