/**
 * Official ElevenLabs embed widget — https://elevenlabs.io/docs/eleven-agents/customization/widget
 */
import { useEffect, useRef, useState } from 'react'
import { fetchAgentConfig, fetchSignedUrl } from '../api'
import type { AgentConfig } from '../api'

const WIDGET_SCRIPT = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
const SCRIPT_MARKER = 'data-elevenlabs-convai-embed'

function loadWidgetScript(): Promise<void> {
  if (document.querySelector(`script[${SCRIPT_MARKER}]`)) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WIDGET_SCRIPT
    script.async = true
    script.type = 'text/javascript'
    script.setAttribute(SCRIPT_MARKER, 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load ElevenLabs widget script'))
    document.body.appendChild(script)
  })
}

export default function ElevenLabsWidget() {
  const widgetRef = useRef<HTMLElement | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadWidgetScript()
      .then(() => setScriptReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load widget'))
  }, [])

  useEffect(() => {
    fetchAgentConfig()
      .then(async (cfg) => {
        setConfig(cfg)
        if (cfg.requires_auth) {
          setSignedUrl(await fetchSignedUrl())
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agent config'))
  }, [])

  useEffect(() => {
    const el = widgetRef.current
    if (!el || !config || !scriptReady) return

    const onCall = (event: Event) => {
      const detail = (event as CustomEvent<{ config: { clientTools?: Record<string, unknown> } }>)
        .detail
      if (!detail?.config) return
      detail.config.clientTools = {
        displayMessage: (parameters: { text: string }) => {
          window.dispatchEvent(
            new CustomEvent('receptionist:displayMessage', { detail: parameters.text }),
          )
          return 'Message displayed'
        },
      }
    }

    el.addEventListener('elevenlabs-convai:call', onCall)

    if (config.requires_auth && signedUrl) {
      el.setAttribute('signed-url', signedUrl)
      el.removeAttribute('agent-id')
    } else if (!config.requires_auth) {
      el.setAttribute('agent-id', config.agent_id)
      el.removeAttribute('signed-url')
    }

    return () => el.removeEventListener('elevenlabs-convai:call', onCall)
  }, [config, signedUrl, scriptReady])

  useEffect(() => {
    const handler = (event: Event) => setToast((event as CustomEvent<string>).detail)
    window.addEventListener('receptionist:displayMessage', handler)
    return () => window.removeEventListener('receptionist:displayMessage', handler)
  }, [])

  if (error) {
    return <p className="error-banner">{error}</p>
  }

  if (!config || !scriptReady || (config.requires_auth && !signedUrl)) {
    return <p className="loading">Loading official widget…</p>
  }

  return (
    <div className="widget-embed-section">
      <p className="section-desc">
        Official ElevenLabs widget — voice and chat as configured in your agent dashboard.
      </p>

      {toast && (
        <div className="toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="widget-embed-section__frame">
        <elevenlabs-convai
          ref={widgetRef}
          variant="expanded"
          dismissible="true"
          start-call-text="Start call"
          end-call-text="End call"
          listening-text="Listening…"
          speaking-text="Agent is speaking…"
        />
      </div>
    </div>
  )
}
