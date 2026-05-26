import { useEffect, useState } from 'react'
import ElevenLabsWidget from './components/ElevenLabsWidget'
import VoiceReceptionist from './components/VoiceReceptionist'
import { fetchAgentConfig } from './api'
import type { AgentConfig } from './api'
import type { AppView } from './types'
import './App.css'

const VIEWS: { id: AppView; label: string; description: string }[] = [
  {
    id: 'sdk-call',
    label: 'Custom call',
    description: 'React SDK — voice (WebRTC)',
  },
  {
    id: 'sdk-chat',
    label: 'Custom chat',
    description: 'React SDK — text (WebSocket)',
  },
  {
    id: 'widget',
    label: 'Official widget',
    description: 'ElevenLabs embed',
  },
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
    <div className="app">
      <header className="app__header">
        <h1>{config?.name ?? 'Voice Receptionist'}</h1>
        <p>{config?.description}</p>
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
            <span className="app-nav__label">{v.label}</span>
            <span className="app-nav__desc">{v.description}</span>
          </button>
        ))}
      </nav>

      <main className="app__main">
        {view === 'sdk-call' && <VoiceReceptionist channel="voice" />}
        {view === 'sdk-chat' && <VoiceReceptionist channel="chat" />}
        {view === 'widget' && <ElevenLabsWidget />}
      </main>

      {config && (
        <p className="hint">
          Agent: <code>{config.agent_id}</code>
          {config.branch_id && (
            <>
              {' '}
              · Branch: <code>{config.branch_id}</code>
            </>
          )}
        </p>
      )}
    </div>
  )
}

export default App
