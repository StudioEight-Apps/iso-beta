/** In-memory transport hub for tests: controllable delay, drop, duplication and reordering. */
import { mulberry32 } from '../../game'
import type { Transport, TransportFactory, TransportStatus, WireMessage } from '../transport'

export interface FakeNetworkOptions {
  /** [min, max] delivery delay in ms. A wide range reorders messages. */
  delay?: [number, number]
  /** Probability a delivery is dropped. */
  drop?: number
  /** Probability a delivery is duplicated. */
  duplicate?: number
  seed?: number
}

export class FakeNetwork {
  delay: [number, number]
  drop: number
  duplicate: number
  /** Every message handed to publish(), in order (before drop / tamper). */
  readonly published: unknown[] = []
  /** Optional hook: rewrite (or drop, by returning null) a message in transit. */
  tamper: ((msg: unknown) => unknown) | null = null
  delivered = 0
  dropped = 0
  private readonly rand: () => number
  private readonly endpoints = new Set<FakeTransport>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()

  constructor(opts: FakeNetworkOptions = {}) {
    this.delay = opts.delay ?? [0, 0]
    this.drop = opts.drop ?? 0
    this.duplicate = opts.duplicate ?? 0
    this.rand = mulberry32(opts.seed ?? 1)
  }

  readonly factory: TransportFactory = () => {
    const t = new FakeTransport(this)
    this.endpoints.add(t)
    return t
  }

  remove(t: FakeTransport): void {
    this.endpoints.delete(t)
  }

  send(from: FakeTransport, msg: WireMessage): void {
    const text = JSON.stringify(msg)
    this.published.push(JSON.parse(text))
    for (const target of this.endpoints) {
      if (target === from) continue
      let copies = 1
      if (this.rand() < this.drop) {
        copies = 0
        this.dropped += 1
      } else if (this.rand() < this.duplicate) {
        copies = 2
      }
      for (let i = 0; i < copies; i++) {
        const wait = this.delay[0] + this.rand() * (this.delay[1] - this.delay[0])
        const timer = setTimeout(() => {
          this.timers.delete(timer)
          let out: unknown = JSON.parse(text)
          if (this.tamper) out = this.tamper(out)
          if (out === null) return
          this.delivered += 1
          target.deliver(out)
        }, wait)
        this.timers.add(timer)
      }
    }
  }

  /** Cancel everything still in flight. */
  stop(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
  }
}

export class FakeTransport implements Transport {
  private messageCb: ((msg: unknown) => void) | null = null
  private closed = false
  private readonly net: FakeNetwork

  constructor(net: FakeNetwork) {
    this.net = net
  }

  publish(msg: WireMessage): void {
    if (!this.closed) this.net.send(this, msg)
  }

  deliver(msg: unknown): void {
    if (!this.closed) this.messageCb?.(msg)
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageCb = cb
  }

  onStatus(cb: (status: TransportStatus) => void): void {
    cb('up')
  }

  close(): void {
    this.closed = true
    this.net.remove(this)
  }
}

/** Minimal in-memory localStorage stand-in. */
export class MemoryStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}
