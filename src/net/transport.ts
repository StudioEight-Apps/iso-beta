/** Transport abstraction: an unreliable, unordered, possibly duplicating broadcast per room. */
import { topicFor } from './protocol'

export type TransportStatus = 'connecting' | 'up' | 'down'

/** Anything JSON-serialisable with a unique id (used for de-duplication). */
export interface WireMessage {
  id: string
}

export interface Transport {
  /** Best effort. Silently dropped while the transport is not up. */
  publish(msg: WireMessage): void
  /** Receives parsed JSON from other clients in the room (and possibly our own echoes). */
  onMessage(cb: (msg: unknown) => void): void
  onStatus(cb: (status: TransportStatus) => void): void
  close(): void
}

export type TransportFactory = (room: string) => Transport

/** Remembers the last `limit` ids so the same message arriving via two routes is delivered once. */
export class SeenIds {
  private readonly ids = new Set<string>()
  private readonly limit: number
  constructor(limit = 4000) {
    this.limit = limit
  }
  /** True the first time an id is seen. */
  firstTime(id: string): boolean {
    if (this.ids.has(id)) return false
    this.ids.add(id)
    if (this.ids.size > this.limit) {
      const oldest = this.ids.values().next()
      if (!oldest.done) this.ids.delete(oldest.value)
    }
    return true
  }
}

export function messageId(msg: unknown): string | null {
  if (typeof msg !== 'object' || msg === null) return null
  const id = (msg as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}

/** Same-browser tabs (and node tests): BroadcastChannel named after the room topic. */
export class BroadcastChannelTransport implements Transport {
  private channel: BroadcastChannel | null
  private messageCb: ((msg: unknown) => void) | null = null
  private statusCb: ((status: TransportStatus) => void) | null = null
  private status: TransportStatus = 'connecting'

  constructor(room: string) {
    this.channel = new BroadcastChannel(topicFor(room))
    this.channel.onmessage = (ev: MessageEvent) => {
      if (this.channel && this.messageCb) this.messageCb(ev.data)
    }
    queueMicrotask(() => {
      if (!this.channel) return
      this.status = 'up'
      this.statusCb?.('up')
    })
  }

  publish(msg: WireMessage): void {
    if (!this.channel || this.status !== 'up') return
    try {
      this.channel.postMessage(msg)
    } catch {
      // channel closed underneath us
    }
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageCb = cb
  }

  onStatus(cb: (status: TransportStatus) => void): void {
    this.statusCb = cb
    cb(this.status)
  }

  close(): void {
    const channel = this.channel
    this.channel = null
    this.status = 'down'
    if (channel) {
      channel.onmessage = null
      channel.close()
    }
  }
}
