// Grid emission factors and regional averages used by the onboarding flow.
//
// getGridFactor performs a case-insensitive partial match on the city name and
// returns the local electricity grid intensity (kg CO₂/kWh), a transport factor
// (kg CO₂/km), and the regional average annual footprint (kg CO₂/yr). Falls back
// to an India-wide average, then a global average, when no city matches.

const REGIONS = [
  { keys: ['mumbai', 'pune', 'maharashtra'], gridKwh: 0.86, transportKm: 0.19, avgAnnualKg: 1900 },
  { keys: ['delhi', 'noida', 'gurgaon'], gridKwh: 0.9, transportKm: 0.22, avgAnnualKg: 2100 },
  { keys: ['bengaluru', 'hyderabad'], gridKwh: 0.78, transportKm: 0.18, avgAnnualKg: 1850 },
  { keys: ['chennai', 'kochi', 'kerala'], gridKwh: 0.72, transportKm: 0.17, avgAnnualKg: 1750 },
  { keys: ['kolkata'], gridKwh: 0.88, transportKm: 0.2, avgAnnualKg: 2000 },
]

const INDIA_FALLBACK = { gridKwh: 0.82, transportKm: 0.21, avgAnnualKg: 2000 }
const GLOBAL_FALLBACK = { gridKwh: 0.49, transportKm: 0.17, avgAnnualKg: 4700 }

const INDIA_KEYS = ['india', 'bharat']

export function getGridFactor(city) {
  if (!city) return GLOBAL_FALLBACK

  const needle = city.trim().toLowerCase()
  if (!needle) return GLOBAL_FALLBACK

  for (const region of REGIONS) {
    if (region.keys.some((key) => needle.includes(key))) {
      const { gridKwh, transportKm, avgAnnualKg } = region
      return { gridKwh, transportKm, avgAnnualKg }
    }
  }

  if (INDIA_KEYS.some((key) => needle.includes(key))) {
    return INDIA_FALLBACK
  }

  return GLOBAL_FALLBACK
}
