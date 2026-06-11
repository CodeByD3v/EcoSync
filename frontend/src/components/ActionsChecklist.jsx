import { CheckCircle2, Circle, ListChecks, Trophy } from 'lucide-react'
import Card from './Card.jsx'

export default function ActionsChecklist({ actions, totalPoints, onToggle, pending }) {
  const completedCount = actions.filter((a) => a.completed).length

  return (
    <Card
      title="Simple Actions Checklist"
      subtitle="Check off daily habits to earn points"
      icon={ListChecks}
      action={
        <span className="flex items-center gap-1.5 rounded-full bg-eco-neon/10 px-3 py-1 text-sm font-bold text-eco-neon">
          <Trophy size={15} />
          {totalPoints} pts
        </span>
      }
    >
      <ul className="space-y-2.5">
        {actions.map((action) => {
          const Box = action.completed ? CheckCircle2 : Circle
          return (
            <li key={action.id}>
              <button
                type="button"
                disabled={pending === action.id}
                onClick={() => onToggle(action)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                  action.completed
                    ? 'border-eco-neon/40 bg-eco-neon/5'
                    : 'border-panelborder bg-slatebg/60 hover:border-eco-neon/30 hover:bg-slatebg'
                }`}
              >
                <Box
                  size={20}
                  className={action.completed ? 'text-eco-neon' : 'text-slate-500'}
                />
                <span
                  className={`flex-1 text-sm ${
                    action.completed ? 'text-slate-400 line-through' : 'text-slate-200'
                  }`}
                >
                  {action.label}
                </span>
                <span className="rounded-md bg-panelborder/60 px-2 py-0.5 text-xs font-semibold text-eco-lime">
                  +{action.points}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-center text-xs text-slate-500">
        {completedCount} of {actions.length} actions completed today
      </p>
    </Card>
  )
}
