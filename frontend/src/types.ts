export type SdkChannel = 'voice' | 'chat'

export type AppView = 'sdk-call' | 'sdk-chat' | 'widget'

export type TranscriptEntry = {
  id: string
  role: 'user' | 'agent' | 'system'
  text: string
}
