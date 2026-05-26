const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export type AgentConfig = {
  agent_id: string
  branch_id: string
  name: string
  description: string
  requires_auth: boolean
  client_tools: string[]
}

export async function fetchAgentConfig(): Promise<AgentConfig> {
  const res = await fetch(`${API_BASE}/api/agent/config`)
  if (!res.ok) {
    throw new Error(`Failed to load agent config (${res.status})`)
  }
  return res.json()
}

export async function fetchConversationToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/conversation-token`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Failed to get conversation token (${res.status})`)
  }
  const data: { token: string } = await res.json()
  return data.token
}

export async function fetchSignedUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/signed-url`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Failed to get signed URL (${res.status})`)
  }
  const data: { signed_url: string } = await res.json()
  return data.signed_url
}
