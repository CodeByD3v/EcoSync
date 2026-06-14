import { useState } from 'react'
import { Radio, RefreshCw, CheckCircle2, AlertTriangle, Play, Smartphone, CreditCard, Zap, Lock } from 'lucide-react'
import Card from './Card.jsx'

export default function IngestionPanel({ onTelemetryTick, offline }) {
  const [sources, setSources] = useState({
    location: true,
    transactions: true,
    utility: false,
  })

  const [logs, setLogs] = useState([
    { id: 1, time: '11:54:10', tag: 'PLAID', text: 'Scanned transactions. MCC petrol_station not active today.' },
    { id: 2, time: '11:42:05', tag: 'FIT', text: 'Passive commute scan: 4.2 km walk auto-detected. Emission: 0 kg.' },
    { id: 3, time: '11:15:00', tag: 'GRID', text: 'Smart meter sync paused. Awaiting utility authorization.' },
  ])

  const [simulating, setSimulating] = useState(null)
  const [showUtilityModal, setShowUtilityModal] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState({ show: false, source: null })
  const [utilityConfig, setUtilityConfig] = useState({
    provider: 'BESCOM (Bengaluru)',
    meterId: '',
    apiKey: '',
  })

  const toggleSource = (source) => {
    if (!sources[source]) {
      // Show concept modal when trying to connect
      setShowConsentModal({ show: true, source })
      return
    }
    // Allow disconnecting directly
    setSources((prev) => {
      const next = { ...prev, [source]: false }
      addLog(
        source.toUpperCase(),
        `${source === 'location' ? 'Google Fit' : source === 'transactions' ? 'Plaid API' : 'Smart Grid Sync'} DISCONNECTED by user request.`
      )
      return next
    })
  }

  const confirmSimulatedConnect = () => {
    const source = showConsentModal.source
    setSources((prev) => {
      const next = { ...prev, [source]: true }
      addLog(
        source.toUpperCase(),
        `${source === 'location' ? 'Google Fit' : source === 'transactions' ? 'Plaid API' : 'Smart Grid Sync'} CONNECTED (Simulation mode) and passive listening active.`
      )
      return next
    })
    setShowConsentModal({ show: false, source: null })
  }

  const handleLinkUtility = (e) => {
    e.preventDefault()
    if (!utilityConfig.meterId || !utilityConfig.apiKey) return

    setSources((prev) => ({ ...prev, utility: true }))
    setShowUtilityModal(false)
    addLog('UTILITY', `Linked ${utilityConfig.provider} (Meter ID: ${utilityConfig.meterId}). Token: *******${utilityConfig.apiKey.slice(-4) || 'KEY'}.`)
    addLog('GRID', 'Live smart utility telemetry sync active at 1-hour intervals.')
  }

  const addLog = (tag, text) => {
    const time = new Date().toTimeString().slice(0, 8)
    setLogs((prev) => [{ id: Date.now(), time, tag, text }, ...prev].slice(0, 15))
  }

  const handleSimulate = async (type, label) => {
    // Check if correct permissions/source are connected
    if (type === 'drive' || type === 'transit') {
      if (!sources.location) {
        addLog('WARNING', 'Simulation failed. Google Fit location telemetry is disconnected.')
        return
      }
    }
    if (type === 'flight' || type === 'shopping') {
      if (!sources.transactions) {
        addLog('WARNING', 'Simulation failed. Plaid transaction scraping is disconnected.')
        return
      }
    }
    if (type === 'utility') {
      if (!sources.utility) {
        addLog('WARNING', 'Simulation failed. Smart Grid meter syncing is disconnected.')
        return
      }
    }

    setSimulating(type)
    addLog('API', `Posting background telemetry packet (${type}) to calculation engine...`)

    try {
      await onTelemetryTick(type, label)
      addLog('SUCCESS', `Recalculation response returned. Telemetry integrated into dashboard footprint state!`)
    } catch (err) {
      addLog('ERROR', `Failed to deliver telemetry stream: ${err.message}`)
    } finally {
      setSimulating(null)
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      {/* Telemetry Sources Config */}
      <Card
        title="Zero-Friction Ingestion Sources"
        subtitle="Passive API connectors that scan location and spend telemetry automatically."
        icon={Radio}
      >
        <div className="space-y-4">
          {/* Source 1: Google Fit */}
          <div className="flex items-center justify-between p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${sources.location ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-slate-400" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Google Fit / Apple Health</p>
                  <p className="text-[10px] text-slate-500">Mobility auto-detection (walking/driving)</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleSource('location')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition ${
                sources.location ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-eco-neon/15 text-eco-neon border border-eco-neon/20'
              }`}
            >
              {sources.location ? 'DISCONNECT' : 'CONNECT'}
            </button>
          </div>

          {/* Source 2: Plaid */}
          <div className="flex items-center justify-between p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${sources.transactions ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-slate-400" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Plaid Banking API</p>
                  <p className="text-[10px] text-slate-500">Financial transaction audits (merchant MCC)</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleSource('transactions')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition ${
                sources.transactions ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-eco-neon/15 text-eco-neon border border-eco-neon/20'
              }`}
            >
              {sources.transactions ? 'DISCONNECT' : 'CONNECT'}
            </button>
          </div>

          {/* Source 3: Utility Sync */}
          <div className="flex items-center justify-between p-3.5 bg-slatebg/40 border border-panelborder rounded-xl">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${sources.utility ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-slate-400" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Smart utility grid syncing</p>
                  <p className="text-[10px] text-slate-500">Hourly smart meter metrics (real kWh)</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (sources.utility) {
                  toggleSource('utility')
                } else {
                  setShowUtilityModal(true)
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition ${
                sources.utility ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-eco-neon/15 text-eco-neon border border-eco-neon/20'
              }`}
            >
              {sources.utility ? 'DISCONNECT' : 'CONNECT'}
            </button>
          </div>
        </div>

        {/* Telemetry Simulator Buttons */}
        <div className="mt-5 border-t border-panelborder pt-4">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Trigger Mock Telemetry Streams</h3>
          <div className="grid gap-2 grid-cols-2">
            {[
              { type: 'drive', label: 'Simulate driving commute', text: '+25 km drive', icon: Smartphone, color: 'hover:border-amber-500/30' },
              { type: 'transit', label: 'Simulate transit swap', text: '-30 km car travel', icon: Smartphone, color: 'hover:border-emerald-500/30' },
              { type: 'flight', label: 'Simulate flight ticket sync', text: '+1 short-haul flight', icon: CreditCard, color: 'hover:border-red-500/30' },
              { type: 'utility', label: 'Simulate utility grid sync', text: '+15 kWh energy usage', icon: Zap, color: 'hover:border-sky-500/30' },
              { type: 'shopping', label: 'Simulate purchasing retail goods', text: '+1 new apparel purchase', icon: CreditCard, color: 'hover:border-indigo-500/30' },
            ].map((btn) => {
              const Icon = btn.icon
              return (
                <button
                  key={btn.type}
                  disabled={simulating !== null}
                  onClick={() => handleSimulate(btn.type, btn.label)}
                  className={`flex flex-col items-start p-3 bg-slatebg/30 border border-panelborder/80 rounded-xl text-left transition disabled:opacity-40 select-none ${btn.color}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-white">
                    <Icon size={12} className="text-eco-neon" />
                    <span>{btn.text}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 line-clamp-1">{btn.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Terminal Live logs */}
      <Card
        title="Telemetry API Logs"
        subtitle="Live event capture from linked environmental data points."
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
        <div className="h-[352px] bg-black/50 border border-panelborder rounded-xl p-4 font-mono text-[11px] overflow-y-auto space-y-2 select-text text-left">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">No logs captured. Trigger some simulated telemetry events above...</p>
          ) : (
            logs.map((log) => {
              let tagColor = 'text-sky-400'
              if (log.tag === 'WARNING') tagColor = 'text-amber-400'
              if (log.tag === 'ERROR') tagColor = 'text-rose-400 font-bold'
              if (log.tag === 'SUCCESS') tagColor = 'text-emerald-400 font-bold'
              if (log.tag === 'API') tagColor = 'text-indigo-400'

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
      {/* Utility API Setup Modal */}
      {showUtilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-panelborder bg-panel p-6 shadow-2xl space-y-4 text-left">
            <div>
              <h3 className="text-lg font-bold text-white">Link Smart Utility Account</h3>
              <p className="text-xs text-slate-400 mt-1">Authenticate your smart electricity meter to ingest real-time kWh values.</p>
            </div>

            <form onSubmit={handleLinkUtility} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Utility Provider</label>
                <select
                  value={utilityConfig.provider}
                  onChange={(e) => setUtilityConfig(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full rounded-xl border border-panelborder bg-slatebg/60 px-4 py-2.5 text-sm text-white focus:border-eco-neon outline-none"
                >
                  <option value="BESCOM (Bengaluru)">BESCOM (Bengaluru)</option>
                  <option value="Tata Power (Mumbai)">Tata Power (Mumbai)</option>
                  <option value="BSES Rajdhani (Delhi)">BSES Rajdhani (Delhi)</option>
                  <option value="KSEB (Kochi)">KSEB (Kochi)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meter Serial / Consumer ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8847192"
                  value={utilityConfig.meterId}
                  onChange={(e) => setUtilityConfig(prev => ({ ...prev, meterId: e.target.value }))}
                  className="w-full rounded-xl border border-panelborder bg-slatebg/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-eco-neon outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">API Secret Sync Token</label>
                <input
                  type="password"
                  required
                  placeholder="e.g. sec_token_xxxxxxx"
                  value={utilityConfig.apiKey}
                  onChange={(e) => setUtilityConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full rounded-xl border border-panelborder bg-slatebg/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-eco-neon outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUtilityModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-eco-neon text-slatebg hover:opacity-90 shadow-glow select-none"
                >
                  Authorize & Link Meter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consent Modal for Simulated OAuth */}
      {showConsentModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-panelborder bg-panel p-6 shadow-2xl space-y-4 text-left">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock size={20} className="text-eco-neon" />
                Privacy-First Consent Concept
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This is a privacy-first consent flow demonstration. Full live integration requires real OAuth credentials (which we omit here for privacy). 
              </p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                By continuing in <strong>simulation mode</strong>, you can use the mock telemetry triggers below to see how passive data ingestion works without connecting your real accounts.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-4">
              <button
                type="button"
                onClick={() => setShowConsentModal({ show: false, source: null })}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSimulatedConnect}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-eco-neon text-slatebg hover:opacity-90 shadow-glow select-none"
              >
                Enter Simulation Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
