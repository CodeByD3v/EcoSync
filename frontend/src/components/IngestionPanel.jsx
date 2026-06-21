import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  RefreshCw, MapPin, Thermometer, Wind, Zap, Globe, Loader2,
  AlertTriangle, CheckCircle2, CloudSun, Link2, Search, Send, ChevronDown,
  ChevronUp, Car, Plane, ShoppingBag, Plug, BarChart3, Navigation, Map
} from 'lucide-react'
import Card from './Card.jsx'
import {
  getConnectorStatus, getLocationContext, resolvePincode,
  syncFootprintFromConnectors, getNeighborhoodComparison, getMapsConfig
} from '../api.js'

const AQI_LABELS = {
  1: { text: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  2: { text: 'Fair', color: 'text-lime-400', bg: 'bg-lime-400/10 border-lime-400/20' },
  3: { text: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  4: { text: 'Poor', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  5: { text: 'Very Poor', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/20' },
}

const CONNECTOR_LABELS = {
  browser_geolocation: 'Browser GPS',
  reverse_geocoding: 'Reverse geocoding',
  pin_code: 'PIN code lookup',
  weather_air_quality: 'Weather & AQI',
  grid_carbon: 'Grid carbon intensity',
  google_fit: 'Google Fit',
  plaid: 'Plaid transactions',
  utility: 'Utility meter',
}

/* ─── Reusable Mini Components ─── */

function SyncFormField({ label, value, onChange, type = 'number', min, max, step, unit, icon: Icon }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        {Icon && <Icon size={12} />}
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-full rounded-lg border border-panelborder bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-eco-neon transition"
        />
        {unit && <span className="text-[10px] text-slate-500 font-medium shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

function ConnectorSyncSection({ title, icon: Icon, color, children, onSync, syncing, lastResult }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-panelborder bg-black/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={16} className={color} />
          <span className="text-xs font-bold text-white">{title}</span>
          {lastResult?.status === 'ok' && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">SYNCED</span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-panelborder/50 pt-3">
          {children}
          <button
            onClick={onSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-eco-neon/10 border border-eco-neon/20 px-4 py-2 text-xs font-bold text-eco-neon hover:bg-eco-neon/20 transition disabled:opacity-40"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {syncing ? 'Syncing...' : 'Sync Real Data'}
          </button>
          {lastResult?.error && (
            <p className="text-[10px] text-rose-400">{lastResult.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export default function IngestionPanel({ offline }) {
  // Location & Environmental state
  const [locationData, setLocationData] = useState(null)
  const [connectorData, setConnectorData] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [coords, setCoords] = useState(null)
  const [logs, setLogs] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const intervalRef = useRef(null)

  // PIN Code lookup state
  const [pinInput, setPinInput] = useState('')
  const [pinStatus, setPinStatus] = useState('idle')
  const [pinResult, setPinResult] = useState(null)

  // Neighborhood comparison state
  const [neighborhood, setNeighborhood] = useState(null)

  // Google Maps state
  const [mapsEnabled, setMapsEnabled] = useState(false)

  // Connector sync form state
  const [mobilityForm, setMobilityForm] = useState({ distance_km: 0, period_days: 7 })
  const [utilityForm, setUtilityForm] = useState({ kwh: 0, period_days: 30 })
  const [travelForm, setTravelForm] = useState({ flights: 0 })
  const [shoppingForm, setShoppingForm] = useState({ new_items: 0 })
  const [syncStates, setSyncStates] = useState({
    mobility: { syncing: false, result: null },
    utility: { syncing: false, result: null },
    travel: { syncing: false, result: null },
    shopping: { syncing: false, result: null },
  })

  /* ─── Logging ─── */
  const addLog = useCallback((tag, text) => {
    const time = new Date().toTimeString().slice(0, 8)
    setLogs((prev) => [{ id: Date.now(), time, tag, text }, ...prev].slice(0, 50))
  }, [])

  /* ─── Connector Status ─── */
  const fetchConnectorStatus = useCallback(async () => {
    try {
      const data = await getConnectorStatus()
      setConnectorData(data.connectors || {})
      addLog('CONFIG', 'Connector readiness loaded from backend environment.')
    } catch (err) {
      addLog('ERROR', `Connector status fetch failed: ${err.message}`)
    }
  }, [addLog])

  /* ─── Maps Config ─── */
  const fetchMapsConfig = useCallback(async () => {
    try {
      const data = await getMapsConfig()
      setMapsEnabled(data.maps_enabled)
      if (data.maps_enabled) {
        addLog('CONFIG', 'Google Maps API key detected — embedded map enabled.')
      }
    } catch {
      // Maps config endpoint optional
    }
  }, [addLog])

  /* ─── Location Context ─── */
  const fetchLocationData = useCallback(async (lat, lng) => {
    setRefreshing(true)
    addLog('API', `POST /location/context — lat=${lat.toFixed(4)}, lng=${lng.toFixed(4)}`)
    try {
      const data = await getLocationContext(lat, lng)
      setLocationData(data)
      setLastUpdate(new Date())
      addLog('SUCCESS', `Real-time context: ${data.city || 'Unknown'}, ${data.state || ''} — Grid: ${data.local_grid_intensity ?? 'N/A'} kgCO₂/kWh`)
      if (data.air_quality_index) {
        const label = AQI_LABELS[data.air_quality_index]?.text || 'Unknown'
        addLog('ENV', `Air Quality: ${label} (AQI ${data.air_quality_index}) | Temp: ${data.temperature_c ?? '?'}°C | ${data.weather_desc}`)
      }
      if (data.green_energy_pct != null) {
        addLog('GRID', `Fossil-free: ${data.green_energy_pct}% | Grid: ${data.local_grid_intensity ?? 'N/A'} kg CO₂e/kWh`)
      }
      if (data.connector_status) {
        setConnectorData(data.connector_status)
      }
    } catch (err) {
      addLog('ERROR', `Location context fetch failed: ${err.message}`)
    } finally {
      setRefreshing(false)
    }
  }, [addLog])

  /* ─── Neighborhood Comparison ─── */
  const fetchNeighborhood = useCallback(async (payload) => {
    try {
      addLog('API', `POST /location/neighborhood — ${payload.zip_code ? `PIN: ${payload.zip_code}` : `coords: ${payload.lat?.toFixed(4)}, ${payload.lng?.toFixed(4)}`}`)
      const data = await getNeighborhoodComparison(payload)
      setNeighborhood(data)
      addLog('SUCCESS', `Neighborhood: ${data.city} avg ${(data.neighborhood_avg_kg / 1000).toFixed(1)}t/yr | National avg ${(data.national_avg_kg / 1000).toFixed(1)}t/yr`)
    } catch (err) {
      addLog('ERROR', `Neighborhood fetch failed: ${err.message}`)
    }
  }, [addLog])

  /* ─── Geolocation ─── */
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      addLog('ERROR', 'Browser Geolocation API not available.')
      return
    }
    setGeoStatus('requesting')
    addLog('GEO', 'Requesting browser geolocation permission...')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        setGeoStatus('granted')
        addLog('GEO', `Location acquired: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (accuracy: ${pos.coords.accuracy.toFixed(0)}m)`)
        fetchLocationData(latitude, longitude)
        fetchNeighborhood({ lat: latitude, lng: longitude })
      },
      (err) => {
        setGeoStatus('denied')
        addLog('ERROR', `Geolocation denied: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [addLog, fetchLocationData, fetchNeighborhood])

  /* ─── PIN Code Lookup ─── */
  const handlePinLookup = useCallback(async () => {
    const code = pinInput.trim()
    if (!/^[1-9][0-9]{5}$/.test(code)) {
      setPinStatus('invalid')
      setPinResult(null)
      return
    }
    setPinStatus('loading')
    addLog('API', `POST /location/pincode — PIN: ${code}`)
    try {
      const data = await resolvePincode(code)
      if (data?.city && data?.state) {
        setPinResult(data)
        setPinStatus('valid')
        addLog('SUCCESS', `PIN ${code} → ${data.city}, ${data.state}`)
        // Also fetch neighborhood comparison for this PIN
        fetchNeighborhood({ zip_code: code })
        // If we got lat/lng back, fetch environmental context too
        if (data.lat && data.lng) {
          setCoords({ lat: data.lat, lng: data.lng })
          fetchLocationData(data.lat, data.lng)
        }
      } else {
        setPinStatus('invalid')
        setPinResult(null)
        addLog('ERROR', 'PIN lookup returned no usable location data.')
      }
    } catch (err) {
      setPinStatus('error')
      setPinResult(null)
      addLog('ERROR', `PIN lookup failed: ${err.message}`)
    }
  }, [pinInput, addLog, fetchNeighborhood, fetchLocationData])

  /* ─── Connector Sync ─── */
  const handleConnectorSync = useCallback(async (category, payload) => {
    setSyncStates(prev => ({ ...prev, [category]: { syncing: true, result: null } }))
    addLog('SYNC', `Syncing ${category} data via POST /footprint/sync...`)
    try {
      const result = await syncFootprintFromConnectors({ [category]: payload })
      setSyncStates(prev => ({ ...prev, [category]: { syncing: false, result: { status: 'ok' } } }))
      addLog('SUCCESS', `${category} sync complete — ${result.updated?.length || 0} field(s) updated.`)
    } catch (err) {
      setSyncStates(prev => ({ ...prev, [category]: { syncing: false, result: { error: err.message } } }))
      addLog('ERROR', `${category} sync failed: ${err.message}`)
    }
  }, [addLog])

  /* ─── Init ─── */
  useEffect(() => {
    // Only fetch live connector status when API is reachable
    if (!offline) {
      fetchConnectorStatus()
      fetchMapsConfig()
    }
    // Geolocation is browser-based, always attempt it
    requestGeolocation()
  }, [offline]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Auto-refresh ─── */
  useEffect(() => {
    if (autoRefresh && coords) {
      intervalRef.current = setInterval(() => {
        addLog('SYNC', 'Auto-refresh triggered (60s interval)...')
        fetchLocationData(coords.lat, coords.lng)
      }, 60000)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, coords, addLog, fetchLocationData])

  const handleManualRefresh = () => {
    if (coords) {
      addLog('SYNC', 'Manual refresh triggered by user.')
      fetchLocationData(coords.lat, coords.lng)
      fetchNeighborhood({ lat: coords.lat, lng: coords.lng })
    } else {
      requestGeolocation()
    }
  }

  /* ─── Derived ─── */
  const aqi = locationData?.air_quality_index
  const aqiInfo = AQI_LABELS[aqi] || { text: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20' }
  const connectorEntries = Object.entries(connectorData || {})
  const configuredCount = connectorEntries.filter(([, value]) => value.configured).length

  /* ─── Google Maps Embed URL ─── */
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapEmbedUrl = useMemo(() => {
    if (!mapsApiKey || !coords) return null
    return `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${coords.lat},${coords.lng}&zoom=14&maptype=roadmap`
  }, [mapsApiKey, coords])

  return (
    <div className="space-y-5">
      {/* Top Row: Location + Environmental Data */}
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">

        {/* ═══ LEFT COLUMN: Real-Time Environmental Hub ═══ */}
        <Card
          title="Real-Time Environmental Hub"
          subtitle="Live data from your location — grid intensity, weather, air quality, and neighborhood carbon context."
          icon={Globe}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition border ${
                  autoRefresh
                    ? 'bg-eco-neon/15 text-eco-neon border-eco-neon/20'
                    : 'bg-slate-600/15 text-slate-400 border-panelborder'
                }`}
              >
                {autoRefresh ? 'AUTO-SYNC ON' : 'AUTO-SYNC OFF'}
              </button>
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider bg-eco-neon/15 text-eco-neon border border-eco-neon/20 hover:opacity-80 transition disabled:opacity-40"
              >
                {refreshing ? <Loader2 size={12} className="animate-spin" /> : 'REFRESH'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Offline Banner */}
            {offline && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                <span>Backend is offline — live provider connectors cannot sync until the API is reachable.</span>
              </div>
            )}

            {/* Geolocation Status */}
            <div className={`flex items-center justify-between p-3.5 border rounded-xl ${
              geoStatus === 'granted'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : geoStatus === 'denied'
                ? 'bg-rose-500/10 border-rose-500/20'
                : 'bg-slatebg/40 border-panelborder'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  geoStatus === 'granted' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                  : geoStatus === 'requesting' ? 'bg-amber-400 animate-pulse'
                  : geoStatus === 'denied' ? 'bg-rose-400'
                  : 'bg-slate-600'
                }`} />
                <div className="flex items-center gap-2">
                  <Navigation size={16} className="text-slate-400" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-white">
                      {geoStatus === 'granted' && locationData
                        ? `${locationData.city || 'Located'}${locationData.state ? `, ${locationData.state}` : ''}`
                        : geoStatus === 'requesting'
                        ? 'Acquiring location...'
                        : geoStatus === 'denied'
                        ? 'Location access denied'
                        : 'Browser Geolocation'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {coords
                        ? `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`
                        : 'Real-time GPS coordinates'}
                    </p>
                  </div>
                </div>
              </div>
              {geoStatus !== 'granted' && (
                <button
                  onClick={requestGeolocation}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider bg-eco-neon/15 text-eco-neon border border-eco-neon/20 transition hover:opacity-80"
                >
                  {geoStatus === 'denied' ? 'RETRY' : 'ENABLE'}
                </button>
              )}
            </div>

            {/* Google Maps Embed */}
            {mapEmbedUrl && (
              <div className="rounded-xl border border-panelborder overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slatebg/60 border-b border-panelborder">
                  <Map size={12} className="text-eco-neon" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Location Map</span>
                </div>
                <iframe
                  src={mapEmbedUrl}
                  width="100%"
                  height="220"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="User location map"
                  className="w-full"
                />
              </div>
            )}

            {/* Static Map Fallback (when no Google Maps API key but has coords) */}
            {!mapEmbedUrl && coords && (
              <div className="rounded-xl border border-panelborder bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={14} className="text-eco-neon" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Location</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {locationData?.city || 'Located'}{locationData?.state ? `, ${locationData.state}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {coords.lat.toFixed(4)}°N, {coords.lng.toFixed(4)}°E
                    </p>
                  </div>
                  {locationData?.zip_code && (
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">PIN Code</p>
                      <p className="text-sm font-bold text-white">{locationData.zip_code}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 mt-2 italic">
                  Set VITE_GOOGLE_MAPS_API_KEY to enable embedded map view.
                </p>
              </div>
            )}

            {/* Live Data Cards */}
            {locationData && (
              <div className="grid gap-3 grid-cols-2">
                {/* Grid Intensity */}
                <div className="flex flex-col p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grid Carbon</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {locationData.local_grid_intensity != null
                      ? `${locationData.local_grid_intensity}`
                      : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500">kg CO₂e/kWh (live)</span>
                </div>

                {/* Air Quality */}
                <div className={`flex flex-col p-3.5 border rounded-xl ${aqiInfo.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Wind size={14} className={aqiInfo.color} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Air Quality</span>
                  </div>
                  <span className={`text-xl font-black ${aqiInfo.color}`}>
                    {aqiInfo.text}
                  </span>
                  <span className="text-[10px] text-slate-500">AQI Level {aqi || '—'}</span>
                </div>

                {/* Temperature */}
                <div className="flex flex-col p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer size={14} className="text-sky-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperature</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {locationData.temperature_c != null ? `${locationData.temperature_c}°C` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">{locationData.weather_desc || 'No data'}</span>
                </div>

                {/* Green Energy */}
                <div className="flex flex-col p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CloudSun size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clean Energy</span>
                  </div>
                  <span className="text-xl font-black text-emerald-400">
                    {locationData.green_energy_pct != null ? `${locationData.green_energy_pct}%` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-500">Fossil-free grid mix</span>
                </div>
              </div>
            )}

            {/* Neighborhood Carbon Context */}
            {neighborhood && (
              <div className="p-4 bg-slatebg/40 border border-panelborder rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} className="text-indigo-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Neighborhood Carbon Benchmark</span>
                </div>

                {/* Benchmark Bars */}
                <div className="space-y-3">
                  {/* Neighborhood Average */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">
                        {neighborhood.city || 'Your Area'} Average
                      </span>
                      <span className="font-bold text-white">
                        {(neighborhood.neighborhood_avg_kg / 1000).toFixed(1)}t/yr
                      </span>
                    </div>
                    <div className="h-2 w-full bg-panelborder/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-500 transition-all duration-700"
                        style={{ width: `${Math.min(100, (neighborhood.neighborhood_avg_kg / 3000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* National Average */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">India National Average</span>
                      <span className="font-bold text-white">
                        {(neighborhood.national_avg_kg / 1000).toFixed(1)}t/yr
                      </span>
                    </div>
                    <div className="h-2 w-full bg-panelborder/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/80 transition-all duration-700"
                        style={{ width: `${Math.min(100, (neighborhood.national_avg_kg / 3000) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Grid Intensity */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-panelborder/50">
                    <span className="text-[10px] text-slate-500">Live Grid Intensity</span>
                    <span className="text-xs font-bold text-white">
                      {neighborhood.grid_intensity_kwh} kg CO₂e/kWh
                      <span className="text-[9px] text-slate-500 ml-1">({neighborhood.grid_source})</span>
                    </span>
                  </div>
                  {neighborhood.green_energy_pct != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Fossil-Free Energy</span>
                      <span className="text-xs font-bold text-emerald-400">{neighborhood.green_energy_pct}%</span>
                    </div>
                  )}
                </div>

                {/* City Benchmarks */}
                {neighborhood.benchmark_cities?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-panelborder/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Major City Benchmarks</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {neighborhood.benchmark_cities.map((bc) => (
                        <div
                          key={bc.city}
                          className={`text-center p-1.5 rounded-lg border ${
                            bc.city.toLowerCase() === (neighborhood.city || '').toLowerCase()
                              ? 'border-eco-neon/30 bg-eco-neon/5'
                              : 'border-panelborder bg-black/20'
                          }`}
                        >
                          <p className="text-[9px] font-bold text-slate-300 truncate">{bc.city}</p>
                          <p className="text-[10px] font-black text-white">{(bc.avg_kg / 1000).toFixed(1)}t</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <CheckCircle2 size={10} />
                <span>Last synced: {lastUpdate.toLocaleTimeString()} — {autoRefresh ? 'Next refresh in 60s' : 'Auto-refresh paused'}</span>
              </div>
            )}

            {/* No location fallback */}
            {!locationData && geoStatus !== 'requesting' && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <MapPin size={32} className="text-slate-600" />
                <p className="text-sm font-semibold text-slate-400">
                  {geoStatus === 'denied'
                    ? 'Location access was denied'
                    : 'Enable location to see real-time data'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  EcoSync uses your browser's GPS to fetch live grid carbon intensity,
                  air quality, weather, and neighborhood carbon benchmarks from configured live providers.
                </p>
                <button
                  onClick={requestGeolocation}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-eco-neon text-slatebg hover:opacity-90 shadow-glow select-none mt-2"
                >
                  Enable Location Access
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="space-y-5">
          {/* PIN Code Lookup */}
          <Card
            title="PIN Code Location Lookup"
            subtitle="Enter any Indian PIN code to fetch real-time neighborhood carbon data."
            icon={Search}
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pinInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setPinInput(v)
                    if (v.length < 6) {
                      setPinStatus('idle')
                      setPinResult(null)
                    }
                  }}
                  placeholder="Enter 6-digit PIN code"
                  maxLength={6}
                  className="flex-1 rounded-lg border border-panelborder bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-eco-neon transition font-mono tracking-wider"
                />
                <button
                  onClick={handlePinLookup}
                  disabled={pinInput.length !== 6 || pinStatus === 'loading'}
                  className="px-4 rounded-lg bg-eco-neon/10 border border-eco-neon/20 text-eco-neon text-xs font-bold hover:bg-eco-neon/20 transition disabled:opacity-40"
                >
                  {pinStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : 'LOOKUP'}
                </button>
              </div>

              {/* PIN Result */}
              {pinStatus === 'loading' && (
                <div className="flex items-center gap-2 text-xs text-amber-300 animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  Resolving PIN code via India Post API...
                </div>
              )}
              {pinStatus === 'valid' && pinResult && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-300">{pinResult.city}, {pinResult.state}</p>
                    <p className="text-slate-400 mt-0.5">
                      {pinResult.district && `District: ${pinResult.district}`}
                      {pinResult.lat && ` · ${pinResult.lat.toFixed(4)}°N, ${pinResult.lng.toFixed(4)}°E`}
                    </p>
                    {pinResult.formatted_address && (
                      <p className="text-slate-500 mt-0.5">{pinResult.formatted_address}</p>
                    )}
                  </div>
                </div>
              )}
              {(pinStatus === 'invalid' || pinStatus === 'error') && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertTriangle size={14} className="shrink-0" />
                  {pinStatus === 'invalid' ? 'Invalid PIN code. Must be 6 digits starting with 1-9.' : 'PIN code lookup failed. Check backend connection.'}
                </div>
              )}
            </div>
          </Card>

          {/* Connector Readiness */}
          {connectorEntries.length > 0 && (
            <Card
              title="Real-Time Connector Status"
              subtitle="Live provider readiness from backend environment configuration."
              icon={Link2}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {configuredCount}/{connectorEntries.length} connectors ready
                  </span>
                  <div className="h-1.5 w-24 bg-panelborder/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-eco-neon rounded-full transition-all"
                      style={{ width: `${(configuredCount / connectorEntries.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connectorEntries.map(([key, value]) => {
                    const required = value.required_env?.join(', ')
                    return (
                      <div key={key} className="rounded-lg border border-panelborder bg-black/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-white">{CONNECTOR_LABELS[key] || key}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            value.configured
                              ? 'text-emerald-400 bg-emerald-400/10'
                              : 'text-amber-400 bg-amber-400/10'
                          }`}>
                            {value.configured ? 'LIVE' : 'NEEDS ENV'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[9px] text-slate-500">{value.provider}</p>
                        {!value.configured && required && (
                          <p className="mt-0.5 text-[9px] text-amber-300/70">Set {required}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Row: Connector Sync + Telemetry */}
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">

        {/* ═══ Manual Connector Sync Forms ═══ */}
        <Card
          title="Real-Time Data Sync"
          subtitle="Connect real data from mobility trackers, utility meters, travel, and shopping."
          icon={Plug}
        >
          <div className="space-y-2">
            {/* Mobility Sync */}
            <ConnectorSyncSection
              title="Mobility & Transport"
              icon={Car}
              color="text-amber-400"
              syncing={syncStates.mobility.syncing}
              lastResult={syncStates.mobility.result}
              onSync={() => handleConnectorSync('mobility', {
                source: 'manual_connector',
                distance_km: mobilityForm.distance_km,
                period_days: mobilityForm.period_days,
              })}
            >
              <div className="grid grid-cols-2 gap-3">
                <SyncFormField
                  label="Distance"
                  value={mobilityForm.distance_km}
                  onChange={(v) => setMobilityForm(p => ({ ...p, distance_km: v }))}
                  min={0} max={5000} step={1}
                  unit="km"
                  icon={Car}
                />
                <SyncFormField
                  label="Period"
                  value={mobilityForm.period_days}
                  onChange={(v) => setMobilityForm(p => ({ ...p, period_days: v }))}
                  min={1} max={366} step={1}
                  unit="days"
                />
              </div>
            </ConnectorSyncSection>

            {/* Utility Sync */}
            <ConnectorSyncSection
              title="Home Energy & Utility"
              icon={Zap}
              color="text-sky-400"
              syncing={syncStates.utility.syncing}
              lastResult={syncStates.utility.result}
              onSync={() => handleConnectorSync('utility', {
                source: 'manual_connector',
                kwh: utilityForm.kwh,
                period_days: utilityForm.period_days,
              })}
            >
              <div className="grid grid-cols-2 gap-3">
                <SyncFormField
                  label="Usage"
                  value={utilityForm.kwh}
                  onChange={(v) => setUtilityForm(p => ({ ...p, kwh: v }))}
                  min={0} max={5000} step={1}
                  unit="kWh"
                  icon={Zap}
                />
                <SyncFormField
                  label="Period"
                  value={utilityForm.period_days}
                  onChange={(v) => setUtilityForm(p => ({ ...p, period_days: v }))}
                  min={1} max={366} step={1}
                  unit="days"
                />
              </div>
            </ConnectorSyncSection>

            {/* Travel Sync */}
            <ConnectorSyncSection
              title="Air Travel & Flights"
              icon={Plane}
              color="text-rose-400"
              syncing={syncStates.travel.syncing}
              lastResult={syncStates.travel.result}
              onSync={() => handleConnectorSync('travel', {
                source: 'manual_connector',
                flights: travelForm.flights,
              })}
            >
              <SyncFormField
                label="Flights (this year)"
                value={travelForm.flights}
                onChange={(v) => setTravelForm({ flights: v })}
                min={0} max={50} step={1}
                unit="flights"
                icon={Plane}
              />
            </ConnectorSyncSection>

            {/* Shopping Sync */}
            <ConnectorSyncSection
              title="Shopping & Consumption"
              icon={ShoppingBag}
              color="text-indigo-400"
              syncing={syncStates.shopping.syncing}
              lastResult={syncStates.shopping.result}
              onSync={() => handleConnectorSync('shopping', {
                source: 'manual_connector',
                new_items: shoppingForm.new_items,
              })}
            >
              <SyncFormField
                label="New items (this month)"
                value={shoppingForm.new_items}
                onChange={(v) => setShoppingForm({ new_items: v })}
                min={0} max={100} step={1}
                unit="items"
                icon={ShoppingBag}
              />
            </ConnectorSyncSection>
          </div>
        </Card>

        {/* ═══ Live API Telemetry Logs ═══ */}
        <Card
          title="Live API Telemetry"
          subtitle="Real-time event stream from connected environmental data sources."
          icon={RefreshCw}
          action={
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-bold"
            >
              CLEAR FEED
            </button>
          }
        >
          <div className="h-[500px] bg-black/50 border border-panelborder rounded-xl p-4 font-mono text-[11px] overflow-y-auto space-y-2 select-text text-left">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Waiting for live provider data...</p>
            ) : (
              logs.map((log) => {
                let tagColor = 'text-sky-400'
                if (log.tag === 'GEO') tagColor = 'text-violet-400'
                if (log.tag === 'ENV') tagColor = 'text-cyan-400'
                if (log.tag === 'GRID') tagColor = 'text-amber-400'
                if (log.tag === 'SYNC') tagColor = 'text-indigo-400'
                if (log.tag === 'WARNING') tagColor = 'text-amber-400'
                if (log.tag === 'ERROR') tagColor = 'text-rose-400 font-bold'
                if (log.tag === 'SUCCESS') tagColor = 'text-emerald-400 font-bold'
                if (log.tag === 'API') tagColor = 'text-indigo-400'
                if (log.tag === 'CONFIG') tagColor = 'text-slate-400 font-bold'

                return (
                  <div key={log.id} className="leading-relaxed border-b border-panelborder/20 pb-1.5 last:border-0">
                    <span className="text-slate-500">[{log.time}]</span>{' '}
                    <span className={`font-bold ${tagColor}`}>[{log.tag}]</span>{' '}
                    <span className="text-slate-300">{log.text}</span>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
