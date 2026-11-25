/** Five-position layout. Primary position first, then any other spot the player can credibly fill. */
export type Pos5 = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export const SLOTS: readonly Pos5[] = ['PG', 'SG', 'SF', 'PF', 'C']

const POS: Readonly<Record<string, readonly Pos5[]>> = {
  curry: ['PG'], durant: ['SF', 'PF'], kawhi: ['SF', 'SG'], giannis: ['PF', 'C'], embiid: ['C'], jokic: ['C'],
  luka: ['PG', 'SG'], sga: ['PG', 'SG'], tatum: ['SF', 'PF'], wemby: ['C', 'PF'], ant: ['SG', 'SF'], lebron: ['SF', 'PF'],
  davis: ['PF', 'C'], morant: ['PG'], lillard: ['PG'], booker: ['SG', 'PG'], mitchell: ['SG', 'PG'], brunson: ['PG'],
  haliburton: ['PG'], butler: ['SF', 'SG'], towns: ['C', 'PF'], banchero: ['PF', 'SF'], irving: ['PG', 'SG'], harden: ['PG', 'SG'],
  george: ['SF', 'SG'], adebayo: ['C', 'PF'], siakam: ['PF', 'SF'], fox: ['PG'], maxey: ['PG', 'SG'], young: ['PG'],
  jwill: ['SF', 'SG'], cunningham: ['PG', 'SG'], holmgren: ['C', 'PF'], holiday: ['PG', 'SG'], white: ['SG', 'PG'], bridges: ['SF', 'SG'],
  anunoby: ['SF', 'PF'], dgreen: ['PF', 'C'], gobert: ['C'], gordon: ['PF', 'SF'], klay: ['SG', 'SF'], reaves: ['SG', 'PG'],
  murray: ['PG', 'SG'], porzingis: ['C', 'PF'], middleton: ['SF', 'SG'], jjj: ['PF', 'C'], mccollum: ['SG', 'PG'], derozan: ['SF', 'SG'],
  wagner: ['SF', 'PF'], sengun: ['C'], allen: ['C'], hart: ['SG', 'SF'], lopez: ['C'], caruso: ['SG', 'PG'],
  dort: ['SG', 'SF'], kcp: ['SG'], hjones: ['SF', 'PF'], reid: ['C', 'PF'], portis: ['PF', 'C'], mcconnell: ['PG'],
  looney: ['C'], dfs: ['PF', 'SF'], pritchard: ['PG'], strus: ['SG', 'SF'], thybulle: ['SG', 'SF'], kuzma: ['PF', 'SF'],
}

export function positionsOf(id: string): readonly Pos5[] {
  return POS[id] ?? []
}

/** 2 = natural position, 1 = can fill in, 0 = out of position. */
export function fitScore(id: string, slot: number): 0 | 1 | 2 {
  const at = positionsOf(id).indexOf(SLOTS[slot])
  return at === 0 ? 2 : at > 0 ? 1 : 0
}

/**
 * Seat up to five players in the PG/SG/SF/PF/C slots so as many as possible play a natural position.
 * Returns five entries (card id or null). Ties keep earlier picks in earlier slots, so it is stable.
 */
export function seatByPosition(ids: readonly string[]): (string | null)[] {
  let best: (string | null)[] = [null, null, null, null, null]
  let bestScore = -1
  const cur: (string | null)[] = [null, null, null, null, null]
  const place = (k: number, score: number) => {
    if (k === ids.length) {
      if (score > bestScore) {
        bestScore = score
        best = [...cur]
      }
      return
    }
    for (let s = 0; s < 5; s++) {
      if (cur[s] !== null) continue
      cur[s] = ids[k]
      place(k + 1, score + fitScore(ids[k], s) * 10)
      cur[s] = null
    }
  }
  place(0, 0)
  return best
}
