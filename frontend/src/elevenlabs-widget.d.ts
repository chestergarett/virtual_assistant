import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          'agent-id'?: string
          'signed-url'?: string
          variant?: string
          dismissible?: string
          'start-call-text'?: string
          'end-call-text'?: string
          'listening-text'?: string
          'speaking-text'?: string
          'expand-text'?: string
        },
        HTMLElement
      >
    }
  }
}

export {}
