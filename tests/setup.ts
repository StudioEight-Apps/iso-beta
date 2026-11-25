import { setFixedPool } from '../src/game'

/** Rule and netcode tests script picks by name, so they run on one fixed 18-card pool. */
export const TEST_POOL = [
  'curry', 'durant', 'kawhi', 'giannis', 'embiid', 'jokic', 'luka', 'sga', 'tatum', 'wemby', 'ant', 'lebron',
  'klay', 'gobert', 'holiday', 'hart', 'reid', 'caruso',
]
setFixedPool(TEST_POOL)
