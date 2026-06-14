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

export function normalizeGridFactor(factors, fallback = INDIA_FALLBACK) {
  if (!factors) return fallback

  return {
    gridKwh: Number(factors.gridKwh ?? factors.grid_kwh ?? fallback.gridKwh),
    transportKm: Number(factors.transportKm ?? factors.transport_km ?? fallback.transportKm),
    avgAnnualKg: Number(factors.avgAnnualKg ?? factors.avg_annual_kg ?? fallback.avgAnnualKg),
  }
}

export function getGridFactor(city) {
  let baseFactor = GLOBAL_FALLBACK
  if (city) {
    const needle = city.trim().toLowerCase()
    if (needle) {
      let found = false
      for (const region of REGIONS) {
        if (region.keys.some((key) => needle.includes(key))) {
          baseFactor = region
          found = true
          break
        }
      }
      if (!found) {
        if (INDIA_KEYS.some((key) => needle.includes(key))) {
          baseFactor = INDIA_FALLBACK
        }
      }
    }
  }

  // Calculate dynamic solar time-of-day multiplier to match the backend calculations
  const currentHour = new Date().getHours()
  let multiplier = 1.00
  if (currentHour >= 10 && currentHour <= 15) {
    multiplier = 0.85 // Solar peak: 15% drop in carbon intensity
  } else if (currentHour >= 18 && currentHour <= 22) {
    multiplier = 1.10 // Evening peak: 10% increase in carbon intensity
  }

  const { gridKwh, transportKm, avgAnnualKg } = baseFactor
  const dynamicGridKwh = Math.round(gridKwh * multiplier * 1000) / 1000

  return { gridKwh: dynamicGridKwh, transportKm, avgAnnualKg }
}
