/**
 * Custom UI using @elevenlabs/react — https://elevenlabs.io/docs/eleven-agents/libraries/react
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ConversationProvider,
  useConversationControls,
  useConversationInput,
  useConversationMode,
  useConversationStatus,
} from '@elevenlabs/react'
import type { AgentConfig } from '../api'
import {
  fetchAgentConfig,
  fetchConversationToken,
  fetchSignedUrl,
} from '../api'
import type { SdkChannel, TranscriptEntry } from '../types'

const clientTools = {
  displayMessage: (parameters: { text: string }) => {
    window.dispatchEvent(
      new CustomEvent('receptionist:displayMessage', { detail: parameters.text }),
    )
    return 'Message displayed'
  },
}

function buildSessionOptions(
  channel: SdkChannel,
  config: AgentConfig,
  auth: { conversationToken?: string; signedUrl?: string },
) {
  const base = { userId: 'chester-local-dev' }

  if (channel === 'voice') {
    if (config.requires_auth && auth.conversationToken) {
      return { ...base, conversationToken: auth.conversationToken }
    }
    return { ...base, agentId: config.agent_id }
  }

  if (config.requires_auth && auth.signedUrl) {
    return { ...base, signedUrl: auth.signedUrl }
  }
  return { ...base, agentId: config.agent_id }
}

function SdkVoiceActive({
  endSession,
  getInputVolume,
}: {
  endSession: () => void
  getInputVolume: () => number
}) {
  const { mode, isSpeaking, isListening } = useConversationMode()
  const { isMuted, setMuted } = useConversationInput()
  const [micLevel, setMicLevel] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setMicLevel(getInputVolume()), 200)
    return () => window.clearInterval(id)
  }, [getInputVolume])

  return (
    <div className="call-active">
      <div
        className={`call-orb call-orb--live ${isSpeaking ? 'call-orb--speaking' : ''} ${isListening ? 'call-orb--listening' : ''}`}
        aria-hidden
      />
      <p className="call-active__status">
        {isSpeaking ? 'Agent is speaking…' : isListening ? 'Listening — speak now' : mode}
      </p>
      <div className="mic-meter" aria-label="Microphone level">
        <div className="mic-meter__fill" style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }} />
      </div>
      <p className="mic-meter__hint">
        {isMuted ? 'Microphone muted' : micLevel < 0.02 ? 'No mic signal — check permissions' : 'Mic active'}
      </p>
      <div className="sdk-panel__controls">
        <button type="button" className="btn btn--danger" onClick={endSession}>End call</button>
        <button type="button" className="btn btn--secondary" onClick={() => setMuted(!isMuted)}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </div>
  )
}

function SdkPanel({
  channel,
  config,
  transcript,
  conversationError,
  onClearError,
}: {
  channel: SdkChannel
  config: AgentConfig
  transcript: TranscriptEntry[]
  conversationError: string | null
  onClearError: () => void
}) {
  const { startSession, endSession, sendUserMessage, sendUserActivity, getInputVolume } =
    useConversationControls()
  const { status } = useConversationStatus()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const connected = status === 'connected'
  const displayError = error ?? conversationError
  const isVoice = channel === 'voice'

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const handleStart = async () => {
    setError(null)
    onClearError()
    setBusy(true)
    try {
      if (isVoice) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const auth: { conversationToken?: string; signedUrl?: string } = {}
      if (config.requires_auth) {
        if (isVoice) {
          auth.conversationToken = await fetchConversationToken()
        } else {
          auth.signedUrl = await fetchSignedUrl()
        }
      }
      startSession(buildSessionOptions(channel, config, auth))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sdk-panel">
      {displayError && (
        <div className="error-banner">
          {displayError}
          <button type="button" className="error-banner__dismiss" onClick={() => { setError(null); onClearError() }}>
            ×
          </button>
        </div>
      )}

      {!connected ? (
        <div className={`start-panel start-panel--${channel}`}>
          {isVoice ? (
            <>
              <div className="call-orb" aria-hidden />
              <p className="start-panel__hint">Custom voice UI — speak and hear the agent in real time.</p>
              <button type="button" className="btn btn--call" onClick={handleStart} disabled={busy}>
                {busy ? 'Connecting…' : 'Start call'}
              </button>
            </>
          ) : (
            <>
              <p className="start-panel__hint">Custom chat UI — type messages to the agent.</p>
              <button type="button" className="btn btn--primary" onClick={handleStart} disabled={busy}>
                {busy ? 'Connecting…' : 'Start chat'}
              </button>
            </>
          )}
        </div>
      ) : isVoice ? (
        <SdkVoiceActive endSession={endSession} getInputVolume={getInputVolume} />
      ) : (
        <div className="chat-active">
          <div className="sdk-panel__controls">
            <button type="button" className="btn btn--danger" onClick={endSession}>End chat</button>
          </div>
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault()
              const text = chatInput.trim()
              if (!text) return
              sendUserMessage(text)
              setChatInput('')
            }}
          >
            <input
              type="text"
              value={chatInput}
              placeholder="Type a message…"
              onChange={(e) => {
                setChatInput(e.target.value)
                sendUserActivity()
              }}
            />
            <button type="submit" className="btn btn--primary" disabled={!chatInput.trim()}>Send</button>
          </form>
        </div>
      )}

      <div className="sdk-panel__meta">
        <span className={`badge badge--${status}`}>{status}</span>
      </div>

      <section className="transcript" aria-live="polite">
        <h3>{isVoice ? 'Live transcript' : 'Messages'}</h3>
        {transcript.length === 0 ? (
          <p className="transcript__empty">Start a session to see messages here.</p>
        ) : (
          <ul>
            {transcript.map((entry) => (
              <li key={entry.id} className={`transcript__line transcript__line--${entry.role}`}>
                <span className="transcript__role">{entry.role}</span>
                {entry.text}
              </li>
            ))}
            <div ref={transcriptEndRef} />
          </ul>
        )}
      </section>
    </div>
  )
}

function SdkSession({
  channel,
  config,
}: {
  channel: SdkChannel
  config: AgentConfig
}) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [conversationError, setConversationError] = useState<string | null>(null)
  const streamingIdRef = useRef<string | null>(null)

  const appendTranscript = useCallback(
    (role: TranscriptEntry['role'], text: string, id?: string) => {
      if (!text.trim() && role !== 'agent') return
      setTranscript((prev) => {
        if (id) {
          const idx = prev.findIndex((e) => e.id === id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = { ...next[idx], text }
            return next
          }
        }
        return [...prev, { id: id ?? `${Date.now()}-${prev.length}`, role, text }]
      })
    },
    [],
  )

  return (
    <ConversationProvider
      key={channel}
      textOnly={channel === 'chat'}
      clientTools={clientTools}
      onConversationCreated={(conversation) => {
        if (channel === 'voice') {
          conversation.setVolume({ volume: 1 })
        }
      }}
      onConnect={({ conversationId }) => {
        appendTranscript('system', `Connected (${conversationId})`)
      }}
      onDisconnect={() => {
        appendTranscript('system', 'Disconnected')
        streamingIdRef.current = null
      }}
      onMessage={(message) => {
        const role = message.role === 'user' ? 'user' : 'agent'
        appendTranscript(role, message.message)
      }}
      onAgentChatResponsePart={(part) => {
        if (channel !== 'chat') return
        if (part.type === 'start') {
          streamingIdRef.current = `stream-${Date.now()}`
          appendTranscript('agent', '', streamingIdRef.current)
        } else if (part.type === 'delta' && streamingIdRef.current) {
          setTranscript((prev) => {
            const idx = prev.findIndex((e) => e.id === streamingIdRef.current)
            if (idx < 0) return prev
            const next = [...prev]
            next[idx] = { ...next[idx], text: next[idx].text + (part.text ?? '') }
            return next
          })
        } else if (part.type === 'stop') {
          streamingIdRef.current = null
        }
      }}
      onError={(message) => {
        setConversationError(message)
        console.error('Conversation error:', message)
      }}
    >
      <SdkPanel
        channel={channel}
        config={config}
        transcript={transcript}
        conversationError={conversationError}
        onClearError={() => setConversationError(null)}
      />
    </ConversationProvider>
  )
}

type VoiceReceptionistProps = {
  channel: SdkChannel
}

export default function VoiceReceptionist({ channel }: VoiceReceptionistProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgentConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load config'))
  }, [])

  if (error) {
    return <p className="error-banner">{error}</p>
  }
  if (!config) {
    return <p className="loading">Loading SDK session…</p>
  }

  return <SdkSession key={channel} channel={channel} config={config} />
}
