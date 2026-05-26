const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export type AgentConfig = {
  agent_id: string
  branch_id: string
  name: string
  description: string
  requires_auth: boolean
  client_tools: string[]
  dashboard_auth_enabled?: boolean
  allowlist_hostnames?: string[]
  auth_config_mismatch?: string
  auth_note?: string
}

export type AuthCredentials = {
  conversationToken?: string
  signedUrl?: string
}

async function readErrorMessage(res: Response): Promise<string> {
  const body = await res.text()
  try {
    const json = JSON.parse(body) as { detail?: string }
    if (typeof json.detail === 'string') return json.detail
  } catch {
    /* plain text */
  }
  return body || `Request failed (${res.status})`
}

export async function fetchAgentConfig(): Promise<AgentConfig> {
  const res = await fetch(`${API_BASE}/api/agent/config`)
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  return res.json()
}

export async function fetchConversationToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/conversation-token`)
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  const data: { token: string } = await res.json()
  return data.token
}

export async function fetchSignedUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/signed-url`)
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  const data: { signed_url: string } = await res.json()
  return data.signed_url
}

/** Fetch server-issued credentials for a private (auth-enabled) agent. */
export async function fetchAuthCredentials(
  mode: 'voice' | 'chat',
): Promise<AuthCredentials> {
  if (mode === 'voice') {
    return { conversationToken: await fetchConversationToken() }
  }
  return { signedUrl: await fetchSignedUrl() }
}
