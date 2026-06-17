// Offline fallback data — rendered when the backend API is unreachable.
//
// Rules:
//  • user_name / name / city are EMPTY — no fake identity leaks into the UI.
//  • is_calculated = false — TranslationEngine stays hidden until real data arrives.
//  • Numeric values are India-average estimates, not specific to any fictional user.
//  • Fallback insight IDs end in "-fallback" so InsightsPanel can detect heuristic mode.

export const FALLBACK_FOOTPRINT = {
  user_name: '',
  date: new Date().toISOString().slice(0, 10),
  total_kg: 2000,
  yesterday_kg: 2120,
  delta_kg: -120.0,
  unit: 'kg CO2e',
  is_calculated: false,
  breakdown: [
    { name: 'Home Energy', percentage: 33.0, kg: 660, color: '#185FA5' },
    { name: 'Transport',   percentage: 25.0, kg: 500, color: '#D85A30' },
    { name: 'Flights',     percentage: 13.0, kg: 255, color: '#993C1D' },
    { name: 'Diet',        percentage: 21.0, kg: 420, color: '#3B6D11' },
    { name: 'Shopping',    percentage:  8.0, kg: 165, color: '#534AB7' },
  ],
  trend: [
    { label: 'Jan', value: 420 },
    { label: 'Feb', value: 395 },
    { label: 'Mar', value: 370 },
    { label: 'Apr', value: 355 },
    { label: 'May', value: 340 },
    { label: 'Jun', value: 167 },
  ],
}

export const FALLBACK_INSIGHTS = [
  {
    id: 'walk-detected-fallback',
    type: 'positive',
    icon: 'Footprints',
    title: 'Smart Walk Detected',
    description: 'You walked 2 miles today instead of driving.',
    impact_kg: -0.8,
  },
  {
    id: 'peak-hours-fallback',
    type: 'alert',
    icon: 'Zap',
    title: 'Peak Hours Alert',
    description: 'Unplug idle devices now to avoid high-carbon grid power.',
    impact_kg: -0.5,
  },
  {
    id: 'swap-beef-fallback',
    type: 'swap',
    icon: 'Salad',
    title: 'Smart Swap: Lentils for Beef',
    description: 'Swapping one beef meal this week for lentils cuts emissions.',
    impact_kg: -3.2,
  },
]

export const FALLBACK_ACTIONS = [
  { id: 'plant-lunch',     label: 'Eat a plant-based lunch',        points: 25, completed: false },
  { id: 'public-transit',  label: 'Take public transit or walk',    points: 30, completed: false },
  { id: 'cold-wash',       label: 'Wash clothes in cold water',     points: 15, completed: false },
  { id: 'unplug-devices',  label: 'Unplug idle devices',            points: 10, completed: false },
  { id: 'reusable-bottle', label: 'Use a reusable water bottle',    points: 10, completed: false },
]

// Neutral: no name/city so the greeting never shows a fake identity offline
export const FALLBACK_PROFILE = {
  name: '',
  city: '',
  km_driven_per_week:  100,
  flights_per_year:    2,
  kwh_per_month:       200,
  diet:                'mixed',
  new_items_per_month: 5,
}

export const FALLBACK_CHALLENGES = [
  { id: 'meatless-monday-streak',  name: 'Meatless Monday streak',  members: 142, progress: 0, goal: 100 },
  { id: 'zero-drive-week',         name: 'Zero-drive week',         members:  89, progress: 0, goal: 100 },
  { id: 'solar-switch-collective', name: 'Solar switch collective',  members: 234, progress: 0, goal: 100 },
]
