import { useEffect, useState } from 'react'
import VoiceReceptionist from './components/VoiceReceptionist'
import { fetchAgentConfig } from './api'
import type { AgentConfig } from './api'
import type { AppView } from './types'
import './App.css'

const VIEWS: { id: AppView; label: string }[] = [
  { id: 'sdk-call', label: 'Call Chester' },
  { id: 'sdk-chat', label: 'Chat with Chester' },
]

function App() {
  const [view, setView] = useState<AppView>('sdk-call')
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgentConfig()
      .then(setConfig)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load agent'),
      )
  }, [])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <img
            className="app-brand__mark"
            src="/monument-valley-icon.svg"
            alt=""
            width={28}
            height={28}
          />
          <span className="app-brand__name">Chester Garett Calingacion | AI Engineer</span>
        </div>
      </header>

      <div className="app">
        <header className="app__header">
          {config?.description && <p className="app__intro">{config.description}</p>}
          {loadError && <p className="error-banner">{loadError}</p>}
        </header>

        <nav className="app-nav" role="tablist" aria-label="Integration mode">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              className={`app-nav__btn ${view === v.id ? 'app-nav__btn--active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <main className="app__main">
          {view === 'sdk-call' && <VoiceReceptionist channel="voice" />}
          {view === 'sdk-chat' && <VoiceReceptionist channel="chat" />}
        </main>

      </div>
    </div>
  )
}

export default App
