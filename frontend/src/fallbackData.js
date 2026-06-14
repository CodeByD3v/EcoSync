// Fallback data so the dashboard renders perfectly even if the API is
// unreachable (e.g. a static demo). Mirrors the FastAPI mock payloads.
export const FALLBACK_FOOTPRINT = {
  user_name: 'Arjun',
  date: new Date().toISOString().slice(0, 10),
  total_kg: 4950,
  yesterday_kg: 5070,
  delta_kg: -120.0,
  unit: 'kg CO2e',
  breakdown: [
    { name: 'Home Energy', percentage: 40.0, kg: 1980, color: '#185FA5' },
    { name: 'Transport', percentage: 22.0, kg: 1090, color: '#D85A30' },
    { name: 'Flights', percentage: 0.0, kg: 0, color: '#993C1D' },
    { name: 'Diet', percentage: 30.0, kg: 1490, color: '#3B6D11' },
    { name: 'Shopping', percentage: 8.0, kg: 390, color: '#534AB7' },
  ],
  trend: [
    { label: 'Jan', value: 420 },
    { label: 'Feb', value: 395 },
    { label: 'Mar', value: 370 },
    { label: 'Apr', value: 355 },
    { label: 'May', value: 340 },
    { label: 'Jun', value: 310 },
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

export const FALLBACK_PROFILE = {
  name: 'Arjun',
  city: 'Bengaluru',
  km_driven_per_week: 100,
  flights_per_year: 2,
  kwh_per_month: 200,
  diet: 'mixed',
  new_items_per_month: 5,
}

export const FALLBACK_CHALLENGES = [
  { id: 'meatless-monday-streak', name: 'Meatless Monday streak', members: 142, progress: 0, goal: 100 },
  { id: 'zero-drive-week', name: 'Zero-drive week', members: 89, progress: 0, goal: 100 },
  { id: 'solar-switch-collective', name: 'Solar switch collective', members: 234, progress: 0, goal: 100 },
]
