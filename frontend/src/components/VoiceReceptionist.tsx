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
import { fetchAgentConfig, fetchAuthCredentials } from '../api'
import type { AuthCredentials } from '../api'
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
  auth: AuthCredentials,
) {
  const base = { userId: 'chester-local-dev' }

  if (config.requires_auth) {
    if (channel === 'voice') {
      if (!auth.conversationToken) {
        throw new Error(
          'Missing conversation token. Check ELEVENLABS_API_KEY on the backend and that auth is enabled in the ElevenLabs dashboard.',
        )
      }
      return { ...base, conversationToken: auth.conversationToken }
    }
    if (!auth.signedUrl) {
      throw new Error(
        'Missing signed URL. Check ELEVENLABS_API_KEY on the backend and that auth is enabled in the ElevenLabs dashboard.',
      )
    }
    return { ...base, signedUrl: auth.signedUrl, connectionType: 'websocket' as const }
  }

  if (channel === 'chat') {
    return { ...base, agentId: config.agent_id, connectionType: 'websocket' as const }
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
  onUserMessage,
}: {
  channel: SdkChannel
  config: AgentConfig
  transcript: TranscriptEntry[]
  conversationError: string | null
  onClearError: () => void
  onUserMessage: (text: string) => void
}) {
  const { startSession, endSession, sendUserMessage, sendUserActivity, getInputVolume } =
    useConversationControls()
  const { status } = useConversationStatus()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const connected = status === 'connected'
  const connecting = status === 'connecting'
  const displayError = error ?? conversationError
  const isVoice = channel === 'voice'

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  useEffect(() => {
    if (status === 'connected' || status === 'error' || status === 'disconnected') {
      setBusy(false)
    }
  }, [status])

  const handleStart = async () => {
    if (busy || connecting || connected) return
    setError(null)
    onClearError()
    setBusy(true)
    try {
      if (isVoice) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const auth = config.requires_auth
        ? await fetchAuthCredentials(isVoice ? 'voice' : 'chat')
        : {}
      startSession(buildSessionOptions(channel, config, auth))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
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
              <button type="button" className="btn btn--call" onClick={handleStart} disabled={busy || connecting}>
                {busy || connecting ? 'Connecting…' : 'Start call'}
              </button>
            </>
          ) : (
            <>
              <div className="chat-orb" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <button type="button" className="btn btn--primary" onClick={handleStart} disabled={busy || connecting}>
                {busy || connecting ? 'Connecting…' : 'Start chat'}
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
              onUserMessage(text)
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
  const chatAgentUsesStreamingRef = useRef(false)

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
        chatAgentUsesStreamingRef.current = false
        streamingIdRef.current = null
        appendTranscript('system', `Connected (${conversationId})`)
      }}
      onDisconnect={(details) => {
        let text = 'Disconnected'
        if (details?.reason === 'agent') {
          const ctx = details.context
          if (ctx && 'type' in ctx && ctx.type === 'end_call') {
            text =
              'Disconnected: agent used End call. Disable that tool in ElevenLabs for multi-turn chat.'
          } else {
            text = `Disconnected (${details.reason})`
          }
        } else if (details?.reason === 'error' && 'message' in details) {
          text = `Disconnected: ${details.message}`
        } else if (details?.reason) {
          text = `Disconnected (${details.reason})`
        }
        appendTranscript('system', text)
        streamingIdRef.current = null
        chatAgentUsesStreamingRef.current = false
      }}
      onMessage={(message) => {
        const role = message.role === 'user' ? 'user' : 'agent'
        if (channel === 'chat') {
          if (role === 'agent') {
            if (chatAgentUsesStreamingRef.current) return
            appendTranscript(role, message.message)
            return
          }
          setTranscript((prev) => {
            if (prev.some((e) => e.role === 'user' && e.text === message.message)) return prev
            return [
              ...prev,
              { id: `${Date.now()}-${prev.length}`, role: 'user', text: message.message },
            ]
          })
          return
        }
        appendTranscript(role, message.message)
      }}
      onAgentChatResponsePart={(part) => {
        if (channel !== 'chat') return
        if (part.type === 'start') {
          chatAgentUsesStreamingRef.current = true
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
        onUserMessage={(text) => appendTranscript('user', text)}
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
