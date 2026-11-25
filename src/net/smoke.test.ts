/**
 * LIVE smoke test against the public MQTT brokers. Skipped by default (needs internet).
 * Run with:  VITE_NET_SMOKE=1 npx vitest run src/net/smoke.test.ts
 */
import { describe, expect, it } from 'vitest'
import { whoseDraftTurn } from '../game'
import { createOnlineSessionWith, DEFAULT_TIMING, makeRoomCode, MqttTransport } from './index'
import { autoplay, waitFor } from './testing/autoplay'

const live = Boolean(import.meta.env.VITE_NET_SMOKE)

describe.skipIf(!live)('live public-broker smoke test', () => {
  it('plays one full scripted game over MQTT and both sides agree', async () => {
    const room = makeRoomCode()
    const transports: MqttTransport[] = []
    const factory = (r: string) => {
      const t = new MqttTransport(r)
      transports.push(t)
      return t
    }
    const deps = { transport: factory, storage: null, timing: DEFAULT_TIMING }
    const t0 = Date.now()
    const host = createOnlineSessionWith({ room, name: 'SmokeHost', host: true }, deps)
    const guest = createOnlineSessionWith({ room, name: 'SmokeGuest', host: false }, deps)
    try {
      await waitFor(() => host.getSnapshot().match !== null && guest.getSnapshot().match !== null, 30000, 'coin flip over MQTT')
      const tFlip = Date.now() - t0
      const brokers = transports.map((t) => t.connectedBrokers())

      // One-way latency: time for a public draft pick to show up on the other client.
      const samples: number[] = []
      for (let i = 0; i < 4; i++) {
        const m = host.getSnapshot().match
        if (!m || m.phase !== 'draft') break
        const seat = whoseDraftTurn(m)
        const actor = seat === 0 ? host : guest
        const watcher = seat === 0 ? guest : host
        const pick = m.draft.pickNumber
        const start = Date.now()
        actor.act({ type: 'draftPick', cardId: m.draft.available[0] })
        await waitFor(() => (watcher.getSnapshot().match?.draft.pickNumber ?? 0) > pick, 15000, 'draft pick delivery')
        samples.push(Date.now() - start)
        await waitFor(() => (actor.getSnapshot().match?.draft.pickNumber ?? 0) > pick, 15000, 'draft pick local')
      }

      // Possession timing: commit + reveal round trips with both players answering instantly.
      const stamps: number[] = []
      host.subscribe(() => {
        const n = host.getSnapshot().match?.history.length ?? 0
        while (stamps.length < n) stamps.push(Date.now())
      })
      autoplay(host)
      autoplay(guest)
      const tPlay = Date.now()
      await waitFor(() => host.getSnapshot().match?.phase === 'gameover' && guest.getSnapshot().match?.phase === 'gameover', 240000, 'gameover over MQTT')
      const gaps = stamps.slice(1).map((t, i) => t - stamps[i]).sort((a, b) => a - b)
      const a = host.getSnapshot().match
      const b = guest.getSnapshot().match
      expect(a).toEqual(b)
      expect(host.getSnapshot().error).toBeNull()
      expect(guest.getSnapshot().error).toBeNull()
      console.log(
        JSON.stringify({
          brokersConnectedPerClient: brokers,
          msToCoinFlip: tFlip,
          draftPickOneWayMs: samples,
          possessions: a?.history.length,
          possessionMs: { min: gaps[0], median: gaps[Math.floor(gaps.length / 2)], p90: gaps[Math.floor(gaps.length * 0.9)], max: gaps[gaps.length - 1] },
          draftToGameoverMs: Date.now() - tPlay,
          score: a?.score,
          winner: a?.winner,
        }),
      )
    } finally {
      host.dispose()
      guest.dispose()
    }
  }, 300000)
})
