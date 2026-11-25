import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ABILITIES, POOL_MIX, POOL_SIZE, ROSTER, cardTier, createMatch, dealPool, defStars, getCard, offStars, ovr, positionsOf, setFixedPool, starsWithoutAbility, traitsOf } from '../src/game'
import { TEST_POOL } from './setup'

describe('roster and dealt pool', () => {
  beforeAll(() => setFixedPool(null))
  afterAll(() => setFixedPool(TEST_POOL))

  it('deals 18 cards with the tier mix, the same for the same seed', () => {
    const pool = dealPool('seed-1')
    expect(pool).toHaveLength(POOL_SIZE)
    expect(POOL_SIZE).toBe(18)
    expect(new Set(pool).size).toBe(18)
    expect(dealPool('seed-1')).toEqual(pool)
    expect(dealPool('seed-2')).not.toEqual(pool)
    for (const tier of ['elite', 'star', 'starter', 'role'] as const) {
      expect(pool.filter((id) => cardTier(getCard(id)) === tier)).toHaveLength(POOL_MIX[tier])
    }
    expect(createMatch('seed-1').draft.available).toEqual(pool)
  })

  it('every card has five real dice, positions, traits, stars and an OVR', () => {
    for (const c of ROSTER) {
      for (const die of [c.three, c.drive, c.pass, c.reb, c.def]) expect([4, 6, 8, 10, 12]).toContain(die)
      expect(positionsOf(c.id).length).toBeGreaterThan(0)
      expect(traitsOf(c.id).length).toBeGreaterThan(0)
      expect(offStars(c)).toBeGreaterThanOrEqual(1)
      expect(offStars(c)).toBeLessThanOrEqual(5)
      expect(defStars(c)).toBeGreaterThanOrEqual(1)
      expect(defStars(c)).toBeLessThanOrEqual(5)
      expect(Number.isInteger(ovr(c))).toBe(true)
      expect(ovr(c)).toBeGreaterThanOrEqual(64)
      expect(ovr(c)).toBeLessThanOrEqual(99)
    }
    expect(offStars(getCard('curry'))).toBe(5)
    expect(defStars(getCard('gobert'))).toBe(5)
    expect(defStars(getCard('curry'))).toBe(2)
    expect(ovr(getCard('jokic'))).toBeGreaterThan(ovr(getCard('caruso')))
  })

  it('every elite and star card has a named ability, and every ability belongs to a real card', () => {
    expect(starsWithoutAbility()).toEqual([])
    for (const [id, a] of Object.entries(ABILITIES)) {
      expect(getCard(id).id).toBe(id)
      expect(a.name.length).toBeGreaterThan(0)
      expect(a.text).not.toMatch(/—|%/)
    }
  })
})
