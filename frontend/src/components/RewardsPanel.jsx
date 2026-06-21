import { useState } from 'react'
import { Trophy, Gift, ArrowRight, Heart, ShoppingBag, Car } from 'lucide-react'
import Card from './Card.jsx'

export default function RewardsPanel({ totalPoints, onRedeem }) {
  // Gamification Level calculations
  let level = 1
  let tierName = 'Bronze Leaf'
  let nextGoal = 150
  let prevGoal = 0

  if (totalPoints >= 500) {
    level = 4
    tierName = 'Eco Champion'
    nextGoal = 1000
    prevGoal = 500
  } else if (totalPoints >= 250) {
    level = 3
    tierName = 'Gold Leaf'
    nextGoal = 500
    prevGoal = 250
  } else if (totalPoints >= 100) {
    level = 2
    tierName = 'Silver Leaf'
    nextGoal = 250
    prevGoal = 100
  }

  const progressPct = Math.min(100, Math.round(((totalPoints - prevGoal) / (nextGoal - prevGoal)) * 100))

  const rewards = [
    {
      id: 'tree',
      title: 'Plant a Certified Tree',
      partner: 'Verified Carbon Standard (VCS)',
      cost: 150,
      description: 'Funds the planting and monitoring of one certified native tree via a VCS-verified reforestation project.',
      icon: Heart,
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
      successMsg: '🌳 Offsetting Active! A certified tree planting has been funded on your behalf via a VCS-verified project.',
    },
    {
      id: 'grocery',
      title: '15% Off Organic Grocery',
      partner: 'EcoSync Partner Network',
      cost: 100,
      description: 'Get 15% off your next organic grocery order from a partner eco-store near you.',
      icon: ShoppingBag,
      color: 'text-amber-400 bg-amber-400/10 border-amber-500/20',
      successMsg: '🎟️ Discount generated: ECO-GREEN15. We have emailed you the code!',
    },
    {
      id: 'cab',
      title: '₹50 Electric Ride Voucher',
      partner: 'EV Mobility Partners',
      cost: 80,
      description: 'Redeem for ₹50 off your next electric cab or auto ride with an EV mobility partner.',
      icon: Car,
      color: 'text-sky-400 bg-sky-400/10 border-sky-500/20',
      successMsg: '⚡ EV ride discount generated! Check your registered email for the promo code.',
    },
  ]

  const handleRedeemClick = (item) => {
    if (totalPoints < item.cost) return
    onRedeem(item.cost, item.successMsg)
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.6fr]">
      {/* Level Status Card */}
      <Card
        title="Eco-Tier Status"
        subtitle="Your points translate directly into environmental rank and influence."
        icon={Trophy}
      >
        <div className="flex flex-col items-center justify-center text-center p-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-eco-neon to-eco-lime flex items-center justify-center text-2xl font-black text-slatebg shadow-glow mb-3 select-none">
            Lvl {level}
          </div>
          <h3 className="text-lg font-black text-white">{tierName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{totalPoints} total experience points</p>

          {/* Level Progress */}
          <div className="w-full mt-6 space-y-1.5 text-left">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400">Next Tier: {level < 4 ? 'Level ' + (level + 1) : 'Goal'}</span>
              <span className="text-white">{totalPoints} / {nextGoal} pts</span>
            </div>
            <div className="h-2 w-full bg-panelborder rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-eco-neon to-eco-lime rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block text-center mt-1">
              Earn {nextGoal - totalPoints} more points to level up!
            </span>
          </div>
        </div>
      </Card>

      {/* Rewards Catalogue */}
      <Card
        title="EcoSync Rewards Catalogue"
        subtitle="Redeem points for carbon offset initiatives or sustainable partner discounts."
        icon={Gift}
      >
        <div className="space-y-3">
          {rewards.map((item) => {
            const Icon = item.icon
            const canAfford = totalPoints >= item.cost
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-panelborder bg-slatebg/40 rounded-xl gap-3 transition hover:border-panelborder/80"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${item.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
                    <p className="text-[10px] text-eco-lime font-medium">{item.partner}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">{item.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => handleRedeemClick(item)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 select-none ${
                    canAfford
                      ? 'bg-eco-neon text-slatebg hover:opacity-90 shadow-glow'
                      : 'bg-panelborder/50 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Redeem</span>
                  <span className="font-extrabold">{item.cost} pts</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
