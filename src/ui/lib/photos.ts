/** Cut-out player photos in public/players. zoom > 1 pushes in on full-body shots so the head and chest fill the card. */
const ZOOM: Record<string, number> = {
  curry: 1.9,
  durant: 1.9,
  embiid: 1.7,
  giannis: 1.6,
  jokic: 1.25,
  sga: 1.2,
  lebron: 1.2,
  tatum: 1.05,
  wemby: 1.05,
  ant: 1,
  kawhi: 1,
  luka: 1,
}

/** Every roster id may have a cut-out at players/<id>.webp; a missing file just hides the photo. */
export function photoOf(id: string): { src: string; zoom: number | null } {
  return { src: `${import.meta.env.BASE_URL}players/${id}.webp`, zoom: ZOOM[id] ?? null }
}

/** Zoom for photos without a hand-set value: tall full-body shots get pushed in, busts are left alone. */
export function autoZoom(width: number, height: number): number {
  const r = height / Math.max(1, width)
  return r >= 1.75 ? 1.85 : r >= 1.45 ? 1.5 : r >= 1.25 ? 1.2 : 1
}

export type Skin = 'aura' | 'pulse' | 'uv' | 'court'
const SKINS: readonly Skin[] = ['aura', 'pulse', 'uv', 'court']

/** ?skin=aura|pulse|uv|court, remembered between visits. Default: aura (violet and cyan). */
export function applySkin(): Skin {
  let skin: Skin = 'aura'
  try {
    const q = new URLSearchParams(window.location.search).get('skin')
    const saved = window.localStorage.getItem('iso.skin3')
    const pick = (q ?? saved ?? 'aura') as Skin
    if (SKINS.includes(pick)) skin = pick
    if (q && SKINS.includes(q as Skin)) window.localStorage.setItem('iso.skin3', skin)
  } catch {
    /* storage unavailable: keep the default */
  }
  if (skin === 'court') delete document.documentElement.dataset.skin
  else document.documentElement.dataset.skin = skin
  return skin
}
