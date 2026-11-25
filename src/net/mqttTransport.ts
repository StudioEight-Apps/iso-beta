/**
 * MQTT over secure websockets to PUBLIC brokers. Connects to every broker at once, publishes
 * each message to every connected broker and de-duplicates on receive by message id, because
 * free public brokers drop connections and messages.
 */
import type { MqttClient } from 'mqtt'
import { topicFor } from './protocol'
import { randomHex } from './sha256'
import { SeenIds, messageId } from './transport'
import type { Transport, TransportStatus, WireMessage } from './transport'

export const DEFAULT_BROKERS: readonly string[] = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
]

export class MqttTransport implements Transport {
  private readonly topic: string
  private readonly clients: MqttClient[] = []
  private readonly seen = new SeenIds()
  private messageCb: ((msg: unknown) => void) | null = null
  private statusCb: ((status: TransportStatus) => void) | null = null
  private status: TransportStatus = 'connecting'
  private everUp = false
  private closed = false

  constructor(room: string, brokers: readonly string[] = DEFAULT_BROKERS) {
    this.topic = topicFor(room)
    void this.start(brokers)
  }

  private async start(brokers: readonly string[]): Promise<void> {
    let connect: (typeof import('mqtt'))['connect']
    try {
      // Loaded lazily so bot-only play never downloads the MQTT client.
      const mod = await import('mqtt')
      connect = mod.connect ?? mod.default.connect
    } catch {
      this.setStatus('down')
      return
    }
    if (this.closed) return
    for (const url of brokers) {
      let client: MqttClient
      try {
        client = connect(url, {
          clientId: `iso_${randomHex(8)}`,
          clean: true,
          keepalive: 30,
          reconnectPeriod: 2000,
          connectTimeout: 8000,
          resubscribe: false,
        })
      } catch {
        continue
      }
      this.clients.push(client)
      client.on('connect', () => {
        if (this.closed) return
        client.subscribe(this.topic, { qos: 1 }, () => this.refreshStatus())
        this.refreshStatus()
      })
      client.on('message', (_topic, payload) => {
        if (this.closed) return
        let msg: unknown
        try {
          msg = JSON.parse(payload.toString())
        } catch {
          return
        }
        const id = messageId(msg)
        if (id === null || !this.seen.firstTime(id)) return
        this.messageCb?.(msg)
      })
      client.on('close', () => this.refreshStatus())
      client.on('offline', () => this.refreshStatus())
      client.on('error', () => this.refreshStatus())
    }
    this.refreshStatus()
  }

  private refreshStatus(): void {
    if (this.closed) return
    const up = this.clients.some((c) => c.connected)
    if (up) this.everUp = true
    this.setStatus(up ? 'up' : this.everUp ? 'down' : 'connecting')
  }

  private setStatus(status: TransportStatus): void {
    if (status === this.status) return
    this.status = status
    this.statusCb?.(status)
  }

  /** How many brokers are connected right now (diagnostics). */
  connectedBrokers(): number {
    return this.clients.filter((c) => c.connected).length
  }

  publish(msg: WireMessage): void {
    if (this.closed) return
    const text = JSON.stringify(msg)
    for (const client of this.clients) {
      if (client.connected) client.publish(this.topic, text, { qos: 1 })
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
    this.closed = true
    this.status = 'down'
    for (const client of this.clients) {
      try {
        client.end(true)
      } catch {
        // already closed
      }
    }
    this.clients.length = 0
  }
}
