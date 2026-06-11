// Fallback data so the dashboard renders perfectly even if the API is
// unreachable (e.g. a static demo). Mirrors the FastAPI mock payloads.
export const FALLBACK_FOOTPRINT = {
  user_name: 'Devanand',
  date: new Date().toISOString().slice(0, 10),
  total_kg: 14.5,
  yesterday_kg: 15.7,
  delta_kg: -1.2,
  unit: 'kg CO2e',
  breakdown: [
    { name: 'Home Energy', percentage: 42.0, kg: 6.1, color: '#34d399' },
    { name: 'Transport', percentage: 38.0, kg: 5.5, color: '#22c55e' },
    { name: 'Food', percentage: 20.0, kg: 2.9, color: '#a3e635' },
  ],
  trend: [
    { label: 'Mon', value: 17.2 },
    { label: 'Tue', value: 16.4 },
    { label: 'Wed', value: 15.9 },
    { label: 'Thu', value: 16.8 },
    { label: 'Fri', value: 15.7 },
    { label: 'Sat', value: 15.2 },
    { label: 'Sun', value: 14.5 },
  ],
}

export const FALLBACK_INSIGHTS = [
  {
    id: 'walk-detected',
    type: 'positive',
    icon: 'Footprints',
    title: 'Smart Walk Detected',
    description: 'You walked 2 miles today instead of driving.',
    impact_kg: -0.8,
  },
  {
    id: 'peak-hours',
    type: 'alert',
    icon: 'Zap',
    title: 'Peak Hours Alert',
    description: 'Unplug idle devices now to avoid high-carbon grid power.',
    impact_kg: -0.5,
  },
  {
    id: 'swap-beef',
    type: 'swap',
    icon: 'Salad',
    title: 'Smart Swap: Lentils for Beef',
    description: 'Swapping one beef meal this week for lentils cuts emissions.',
    impact_kg: -3.2,
  },
]

export const FALLBACK_ACTIONS = [
  { id: 'plant-lunch', label: 'Eat a plant-based lunch', points: 25, completed: false },
  { id: 'public-transit', label: 'Take public transit or walk', points: 30, completed: false },
  { id: 'cold-wash', label: 'Wash clothes in cold water', points: 15, completed: false },
  { id: 'unplug-devices', label: 'Unplug idle devices', points: 10, completed: false },
  { id: 'reusable-bottle', label: 'Use a reusable water bottle', points: 10, completed: false },
]
