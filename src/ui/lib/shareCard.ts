import { abilityOf, defStars, offStars, ovr } from '../../game'
import type { Card, DieSize } from '../../game'
import { FACETS, OUTLINE, TEXT_Y, dieFontSize } from '../components/Die'
import { FACES } from './faceData'
import { firstName, surname } from './names'
import { autoZoom, photoOf } from './photos'
import { positionsOf } from './positions'
import { SKILLS, tierOf } from './traits'

const W = 1080
const H = 1512
const M = 36
const R = 60
const PAD = 100
const INK = '#f5f7fa'
const INK_2 = 'rgba(245,247,250,0.68)'
const INK_3 = 'rgba(245,247,250,0.42)'
const LINE = 'rgba(255,255,255,0.18)'
const BLACK = '#050507'
const IRID = ['#4fb6c9', '#5a5fc7', '#9a4fb0', '#3f8f86', '#4fb6c9']

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Text drawn condensed by scaling X, shrunk to maxWidth when it would run over. Never clipped. */
function condensed(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, squeeze: number, maxWidth: number, weight = 900) {
  ctx.save()
  ctx.font = `${weight} ${size}px Archivo, "Arial Narrow", sans-serif`
  const natural = ctx.measureText(text).width * squeeze
  const fit = natural > maxWidth ? maxWidth / natural : 1
  ctx.translate(x, y)
  ctx.scale(squeeze * fit, fit)
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, gap: number): number {
  return [...text].reduce((w, c) => w + ctx.measureText(c).width + gap, -gap)
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number, align: 'left' | 'center' | 'right' = 'left') {
  const total = spacedWidth(ctx, text, gap)
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total
  ctx.textAlign = 'left'
  for (const c of [...text]) {
    ctx.fillText(c, cx, y)
    cx += ctx.measureText(c).width + gap
  }
}

function iridescent(ctx: CanvasRenderingContext2D, cx: number, cy: number): CanvasGradient {
  const g = typeof ctx.createConicGradient === 'function' ? ctx.createConicGradient(-0.6, cx, cy) : ctx.createLinearGradient(0, 0, W, H)
  IRID.forEach((c, i) => g.addColorStop(i / (IRID.length - 1), c))
  return g
}

/** The same polyhedron as the on-screen <Die>, drawn in its 100-unit box. */
function die(ctx: CanvasRenderingContext2D, size: DieSize, cx: number, cy: number, box: number, color: string) {
  ctx.save()
  ctx.translate(cx - box / 2, cy - box / 2)
  ctx.scale(box / 100, box / 100)
  const pts = OUTLINE[size].split(' ').map((p) => p.split(',').map(Number) as [number, number])
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.fillStyle = color
  ctx.globalAlpha = 0.1
  ctx.fill()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 1.8
  ctx.stroke(new Path2D(FACETS[size]))
  ctx.globalAlpha = 1
  ctx.lineWidth = 5
  ctx.stroke()

  const text = String(size)
  ctx.font = `800 ${dieFontSize(size, text)}px "JetBrains Mono", ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 7
  ctx.strokeStyle = BLACK
  ctx.strokeText(text, 50, TEXT_Y[size])
  ctx.fillStyle = INK
  ctx.fillText(text, 50, TEXT_Y[size])
  ctx.restore()
}

const STAR: [number, number][] = [
  [5, 0.5],
  [6.4, 3.5],
  [9.7, 3.9],
  [7.3, 6.2],
  [7.9, 9.5],
  [5, 7.9],
  [2.1, 9.5],
  [2.7, 6.2],
  [0.3, 3.9],
  [3.6, 3.5],
]

/** Label then five stars, right-aligned at `right`. Returns the left edge so the next group can sit beside it. */
function stars(ctx: CanvasRenderingContext2D, label: string, value: number, right: number, y: number, color: string): number {
  const s = 3.4
  const step = 11 * s
  const left = right - step * 5 + s
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    STAR.forEach(([px, py], k) => {
      const X = left + i * step + px * s
      const Y = y - 5 * s + py * s
      if (k === 0) ctx.moveTo(X, Y)
      else ctx.lineTo(X, Y)
    })
    ctx.closePath()
    ctx.fillStyle = i < value ? color : 'rgba(255,255,255,0.14)'
    ctx.fill()
  }
  ctx.font = '800 28px Archivo, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK_2
  spaced(ctx, label, left - 14, y + 1, 4, 'right')
  return left - 14 - spacedWidth(ctx, label, 4)
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** The cut-out in black and white, framed on the face like the on-screen card, fading out towards the name. */
function photoLayer(img: HTMLImageElement, id: string): HTMLCanvasElement | null {
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = Math.round(H * 0.64)
  const ctx = layer.getContext('2d')
  if (!ctx) return null

  const face = FACES[id]
  if (face) {
    const h = (H * 0.25) / face.h
    const w = h * (img.naturalWidth / img.naturalHeight)
    ctx.drawImage(img, W / 2 - face.x * w, H * 0.25 - face.y * h, w, h)
  } else {
    const zoom = photoOf(id).zoom ?? autoZoom(img.naturalWidth, img.naturalHeight)
    const h = H * 0.6 * zoom
    const w = h * (img.naturalWidth / img.naturalHeight)
    ctx.drawImage(img, W / 2 - w / 2, H * 0.06, w, h)
  }

  try {
    const px = ctx.getImageData(0, 0, layer.width, layer.height)
    const d = px.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const v = Math.max(0, Math.min(255, ((g - 128) * 1.12 + 128) * 0.98))
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
    }
    ctx.putImageData(px, 0, 0)
  } catch {
    /* tainted canvas: keep the photo in colour rather than lose it */
  }

  ctx.globalCompositeOperation = 'destination-in'
  const fade = ctx.createLinearGradient(0, 0, 0, layer.height)
  fade.addColorStop(0, '#000')
  fade.addColorStop(0.5, '#000')
  fade.addColorStop(0.74, 'rgba(0,0,0,0.3)')
  fade.addColorStop(0.94, 'rgba(0,0,0,0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, layer.width, layer.height)
  return layer
}

/** Draws the card front as a 1080x1512 PNG. Same information and layout as the on-screen card. */
export async function renderCardImage(card: Card): Promise<Blob> {
  const [img] = await Promise.all([
    loadImage(photoOf(card.id).src),
    Promise.all([document.fonts.load('900 100px Archivo'), document.fonts.load('800 80px "JetBrains Mono"')]).catch(() => undefined),
  ])

  const off = token('--off', '#a47bff')
  const def = token('--def', '#27d7ff')
  const elite = tierOf(card) === 'elite'
  const ability = abilityOf(card.id)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  // black card
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  roundRect(ctx, M, M, W - M * 2, H - M * 2, R)
  const body = ctx.createLinearGradient(0, M, 0, H - M)
  body.addColorStop(0, '#0c0c11')
  body.addColorStop(0.56, BLACK)
  body.addColorStop(1, '#020203')
  ctx.fillStyle = body
  ctx.fill()
  ctx.save()
  ctx.clip()

  const top = ctx.createRadialGradient(W / 2, M, 0, W / 2, M, W * 0.8)
  top.addColorStop(0, 'rgba(255,255,255,0.09)')
  top.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, H * 0.6)

  // elite: dark oil-slick aura behind the player
  if (elite) {
    const blobs: [number, number, string][] = [
      [W * 0.26, H * 0.2, '11,58,71'],
      [W * 0.74, H * 0.16, '29,27,87'],
      [W * 0.7, H * 0.4, '74,22,80'],
      [W * 0.3, H * 0.42, '13,58,51'],
    ]
    for (const [bx, by, rgb] of blobs) {
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.56)
      g.addColorStop(0, `rgba(${rgb},0.95)`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
  }

  // photo, or a quiet initial when there is none
  const layer = img ? photoLayer(img, card.id) : null
  if (layer) {
    ctx.drawImage(layer, 0, 0)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    condensed(ctx, surname(card).slice(0, 1), W / 2 - 110, H * 0.3, 560, 0.66, 400)
  }
  const scrim = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.62)
  scrim.addColorStop(0, 'rgba(5,5,7,0)')
  scrim.addColorStop(0.55, 'rgba(5,5,7,0.72)')
  scrim.addColorStop(1, BLACK)
  ctx.fillStyle = scrim
  ctx.fillRect(0, H * 0.3, W, H * 0.7)
  ctx.restore()

  // OVR badge
  const bw = 196
  const bh = 178
  roundRect(ctx, PAD, PAD, bw, bh, 38)
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = elite ? '#7f88c9' : 'rgba(255,255,255,0.32)'
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = '900 132px Archivo, sans-serif'
  const num = String(ovr(card))
  const numW = ctx.measureText(num).width * 0.78
  condensed(ctx, num, PAD + bw / 2 - numW / 2, PAD + 114, 132, 0.78, bw - 30)
  ctx.fillStyle = INK_2
  ctx.font = '800 30px Archivo, sans-serif'
  spaced(ctx, 'OVR', PAD + bw / 2, PAD + 154, 7, 'center')

  // mark
  ctx.fillStyle = INK_3
  ctx.font = '900 40px Archivo, sans-serif'
  ctx.textBaseline = 'middle'
  spaced(ctx, 'ISO', W - PAD, PAD + 28, 2, 'right')

  // small first name over big surname
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK_2
  ctx.font = '700 46px Archivo, sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 24
  spaced(ctx, firstName(card), PAD, 880, 9)
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  condensed(ctx, surname(card), PAD - 6, 1070, 236, 0.66, W - PAD * 2)
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

  // positions and star ratings
  const pos = positionsOf(card.id)
  ctx.fillStyle = INK
  ctx.font = '800 42px Archivo, sans-serif'
  ctx.textBaseline = 'middle'
  spaced(ctx, pos.length ? pos.join(' / ') : card.position, PAD, 1128, 6)
  const next = stars(ctx, 'DEF', defStars(card), W - PAD, 1127, def)
  stars(ctx, 'OFF', offStars(card), next - 30, 1127, off)

  // the five skill dice
  ctx.fillStyle = LINE
  ctx.fillRect(PAD, 1162, W - PAD * 2, 2)
  const box = 128
  SKILLS.forEach((s, i) => {
    const color = s.tone === 'off' ? off : def
    const cx = PAD + ((W - PAD * 2) * (i + 0.5)) / SKILLS.length
    die(ctx, card[s.key], cx, 1254, box, color)
    ctx.font = '800 32px Archivo, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    spaced(ctx, s.label, cx, 1348, 4, 'center')
  })

  // unique ability
  if (ability) {
    roundRect(ctx, PAD, 1380, W - PAD * 2, 74, 26)
    ctx.fillStyle = elite ? 'rgba(127,136,201,0.12)' : 'rgba(255,255,255,0.05)'
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = elite ? '#7f88c9' : LINE
    ctx.stroke()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK_3
    ctx.font = '700 26px Archivo, sans-serif'
    spaced(ctx, 'UNIQUE ABILITY', PAD + 30, 1418, 5)
    ctx.fillStyle = INK
    ctx.font = '900 46px Archivo, sans-serif'
    const name = ability.name.toUpperCase()
    const room = W - PAD * 2 - 60 - spacedWidth(ctx, 'UNIQUE ABILITY', 5) * 0.62 - 40
    const nameW = Math.min(room, ctx.measureText(name).width * 0.8)
    condensed(ctx, name, W - PAD - 30 - nameW, 1420, 46, 0.8, room)
  }

  // frame: iridescent for elite, a plain hairline for everyone else
  roundRect(ctx, M, M, W - M * 2, H - M * 2, R)
  ctx.lineWidth = elite ? 10 : 4
  ctx.strokeStyle = elite ? iridescent(ctx, W / 2, H / 2) : 'rgba(255,255,255,0.22)'
  ctx.stroke()

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png'))
}

/** Opens the share sheet with the card image, or downloads it where sharing files is unsupported. */
export async function shareCard(card: Card): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await renderCardImage(card)
  const file = new File([blob], `iso-${card.id}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${card.name} · ISO` })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
