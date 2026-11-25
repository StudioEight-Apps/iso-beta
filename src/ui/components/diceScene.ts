import * as THREE from 'three'

export interface FloorDie {
  size: 4 | 6 | 8 | 10 | 12
  /** The face it must land on (decided by the engine). */
  face: number
  side: 'off' | 'def'
  /** ms before it is thrown. */
  delay: number
  /** ms it tumbles. */
  duration: number
  discarded: boolean
}

interface Face {
  normal: THREE.Vector3
  center: THREE.Vector3
  /** Direction on the face that is "up" for its number. */
  up: THREE.Vector3
}

const R = 0.62

function d10Geometry(): THREE.BufferGeometry {
  const a = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5))
  const ring: THREE.Vector3[] = []
  for (let k = 0; k < 10; k++) {
    const t = (k * Math.PI) / 5
    ring.push(new THREE.Vector3(Math.cos(t), k % 2 === 0 ? a : -a, Math.sin(t)))
  }
  const top = new THREE.Vector3(0, 1, 0)
  const bot = new THREE.Vector3(0, -1, 0)
  const pos: number[] = []
  const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(q, p).cross(new THREE.Vector3().subVectors(r, p))
    const c = new THREE.Vector3().add(p).add(q).add(r)
    const order = n.dot(c) >= 0 ? [p, q, r] : [p, r, q]
    order.forEach((v) => pos.push(v.x, v.y, v.z))
  }
  for (let k = 0; k < 10; k++) {
    const prev = ring[(k + 9) % 10]
    const cur = ring[k]
    const next = ring[(k + 1) % 10]
    const apex = k % 2 === 1 ? top : bot
    tri(apex, prev, cur)
    tri(apex, cur, next)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function geometryFor(size: FloorDie['size']): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  if (size === 4) g = new THREE.TetrahedronGeometry(1)
  else if (size === 6) g = new THREE.BoxGeometry(1.15, 1.15, 1.15)
  else if (size === 8) g = new THREE.OctahedronGeometry(1)
  else if (size === 10) g = d10Geometry()
  else g = new THREE.DodecahedronGeometry(1)
  g = g.index ? g.toNonIndexed() : g
  g.computeVertexNormals()
  const scale = size === 4 ? R * 1.25 : size === 6 ? R * 0.92 : size === 10 ? R * 1.08 : R
  g.scale(scale, scale, scale)
  return g
}

/** Groups the triangles into flat faces. */
function facesOf(g: THREE.BufferGeometry): Face[] {
  const p = g.getAttribute('position')
  const groups: { normal: THREE.Vector3; pts: THREE.Vector3[] }[] = []
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i)
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1)
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
    let grp = groups.find((x) => x.normal.dot(n) > 0.995)
    if (!grp) {
      grp = { normal: n, pts: [] }
      groups.push(grp)
    }
    for (const v of [a, b, c]) if (!grp.pts.some((q) => q.distanceToSquared(v) < 1e-6)) grp.pts.push(v)
  }
  return groups.map((grp) => {
    const center = grp.pts.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / grp.pts.length)
    const far = grp.pts.reduce((best, v) => (v.distanceToSquared(center) > best.distanceToSquared(center) ? v : best), grp.pts[0])
    const up = new THREE.Vector3().subVectors(far, center).normalize()
    return { normal: grp.normal, center, up }
  })
}

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  if (g) {
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `900 ${n >= 10 ? 78 : 92}px Archivo, "Arial Black", sans-serif`
    g.shadowColor = 'rgba(0,0,0,0.9)'
    g.shadowBlur = 10
    g.fillStyle = '#ffffff'
    g.fillText(String(n), 64, 70)
    g.shadowBlur = 0
    if (n === 6 || n === 9) g.fillRect(40, 112, 48, 7)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function paintSky(): HTMLCanvasElement {
  const sky = document.createElement('canvas')
  sky.width = 1024
  sky.height = 512
  const g = sky.getContext('2d')
  if (!g) return sky
  const h = g.createLinearGradient(0, 0, sky.width, 0)
  const stops: [number, string][] = [
    [0, '#030519'],
    [0.12, '#0aa6ff'],
    [0.3, '#2a22c8'],
    [0.45, '#a316ff'],
    [0.58, '#ff2bb0'],
    [0.72, '#3a0a66'],
    [0.86, '#04c8c0'],
    [1, '#030519'],
  ]
  stops.forEach(([at, c]) => h.addColorStop(at, c))
  g.fillStyle = h
  g.fillRect(0, 0, sky.width, sky.height)
  const v = g.createLinearGradient(0, 0, 0, sky.height)
  v.addColorStop(0, 'rgba(255,255,255,0.3)')
  v.addColorStop(0.12, 'rgba(255,255,255,0)')
  v.addColorStop(0.55, 'rgba(0,0,6,0.12)')
  v.addColorStop(1, 'rgba(2,2,12,0.7)')
  g.fillStyle = v
  g.fillRect(0, 0, sky.width, sky.height)
  g.filter = 'blur(4px)'
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.fillRect(110, 90, 170, 10)
  g.fillRect(432, 120, 9, 130)
  g.fillRect(640, 80, 110, 8)
  g.filter = 'none'
  return sky
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Real 3D dice thrown onto the floor. Each die tumbles, bounces and comes to rest with the engine's
 * face showing, so the roll on screen is the roll that counted. Returns a disposer.
 */
export function mountDice(canvas: HTMLCanvasElement, dice: FloorDie[], opts: { instant: boolean; solo: boolean; startedAt: number; onLand?: (index: number) => void }): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60)
  const camPos = new THREE.Vector3(0, 5.3, 3.5)
  camera.position.copy(camPos)
  camera.lookAt(0, 0.3, 0)
  const toCam = camPos.clone().normalize()

  const skyTex = new THREE.CanvasTexture(paintSky())
  skyTex.mapping = THREE.EquirectangularReflectionMapping
  skyTex.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(skyTex)
  skyTex.dispose()
  scene.environment = env.texture
  // Coloured key lights so each flat face catches a different hue as the die turns.
  const l1 = new THREE.PointLight(0xff3bd0, 40, 0, 2)
  l1.position.set(-3, 3.5, 2.5)
  const l2 = new THREE.PointLight(0x27d7ff, 40, 0, 2)
  l2.position.set(3, 3.5, 2.5)
  const l3 = new THREE.PointLight(0xffffff, 26, 0, 2)
  l3.position.set(0, 5, -2)
  scene.add(l1, l2, l3)

  const disposables: { dispose: () => void }[] = [env, pmrem]
  const numTex = new Map<number, THREE.CanvasTexture>()
  const tex = (n: number) => {
    let t = numTex.get(n)
    if (!t) {
      t = numberTexture(n)
      numTex.set(n, t)
      disposables.push(t)
    }
    return t
  }

  // soft contact shadow
  const sc = document.createElement('canvas')
  sc.width = 128
  sc.height = 128
  const sg = sc.getContext('2d')
  if (sg) {
    const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 62)
    rg.addColorStop(0, 'rgba(0,0,0,0.85)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    sg.fillStyle = rg
    sg.fillRect(0, 0, 128, 128)
  }
  const shadowTex = new THREE.CanvasTexture(sc)
  const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4)
  const labelGeo = new THREE.PlaneGeometry(1, 1)
  disposables.push(shadowTex, shadowGeo, labelGeo)

  interface Body {
    group: THREE.Group
    shadow: THREE.Mesh
    shadowMat: THREE.MeshBasicMaterial
    glowMat: THREE.MeshBasicMaterial
    skin: THREE.MeshPhysicalMaterial
    qFinal: THREE.Quaternion
    axis: THREE.Vector3
    turns: number
    from: THREE.Vector3
    to: THREE.Vector3
    rest: number
    die: FloorDie
    landed: boolean
    landedAt: number
  }

  const bodies: Body[] = dice.map((die) => {
    const geo = geometryFor(die.size)
    const faces = facesOf(geo)
    const tint = die.side === 'off' ? 0xe6dcff : 0xd6f6ff
    const skin = new THREE.MeshPhysicalMaterial({
      color: tint,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [120, 720],
      envMapIntensity: 2.1,
      flatShading: true,
      transparent: true,
    })
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geo, skin))
    const edgeGeo = new THREE.EdgesGeometry(geo, 20)
    const edgeMat = new THREE.LineBasicMaterial({ color: die.side === 'off' ? 0xa47bff : 0x27d7ff, transparent: true, opacity: 0.9 })
    group.add(new THREE.LineSegments(edgeGeo, edgeMat))
    disposables.push(geo, skin, edgeGeo, edgeMat)

    const inradius = Math.min(...faces.map((f) => f.center.dot(f.normal)))
    const labelSize = (die.size === 4 ? 0.62 : die.size === 6 ? 0.8 : die.size === 12 ? 0.52 : 0.56) * R * (die.size === 10 ? 0.95 : 1)
    faces.forEach((f, i) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex(i + 1), transparent: true, depthWrite: false, toneMapped: false })
      disposables.push(mat)
      const m = new THREE.Mesh(labelGeo, mat)
      m.scale.setScalar(labelSize)
      // On kites and triangles the centroid sits toward the wide end; that is where the number goes.
      m.position.copy(f.center).addScaledVector(f.normal, 0.004)
      const x = new THREE.Vector3().crossVectors(f.up, f.normal).normalize()
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, f.up, f.normal))
      group.add(m)
    })

    // Final pose: the rolled face shows, with its number upright for the camera.
    const idx = Math.min(faces.length, Math.max(1, die.face)) - 1
    const f = faces[idx]
    const qFinal = new THREE.Quaternion()
    if (die.size === 4) {
      // A d4 rests on a face, so the rolled face is the slanted one turned to the camera.
      const flat = new THREE.Vector3(toCam.x, 0, toCam.z).normalize()
      const target = new THREE.Vector3(flat.x * (Math.sqrt(8) / 3), 1 / 3, flat.z * (Math.sqrt(8) / 3))
      const align = new THREE.Quaternion().setFromUnitVectors(f.normal, target)
      let best = align
      let bestUp = -Infinity
      for (let k = 0; k < 3; k++) {
        const spin = new THREE.Quaternion().setFromAxisAngle(target, (k * 2 * Math.PI) / 3)
        // settle one of the other faces onto the floor
        const other = faces[(idx + 1) % 4].normal.clone().applyQuaternion(align)
        const down = new THREE.Vector3(0, -1, 0)
        const pa = other.clone().addScaledVector(target, -other.dot(target)).normalize()
        const pb = down.clone().addScaledVector(target, -down.dot(target)).normalize()
        const ang = Math.atan2(new THREE.Vector3().crossVectors(pa, pb).dot(target), pa.dot(pb))
        const q = spin.clone().multiply(new THREE.Quaternion().setFromAxisAngle(target, ang)).multiply(align)
        const upNow = f.up.clone().applyQuaternion(q).y
        if (upNow > bestUp) {
          bestUp = upNow
          best = q
        }
      }
      qFinal.copy(best)
    } else {
      const align = new THREE.Quaternion().setFromUnitVectors(f.normal, UP)
      const upNow = f.up.clone().applyQuaternion(align)
      const yaw = Math.atan2(upNow.x, upNow.z) // angle from +z
      const jitter = (Math.random() - 0.5) * 0.5
      // number's up should point away from the camera (-z)
      const fix = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI - yaw + jitter)
      qFinal.copy(fix.multiply(align))
    }

    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 })
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.002
    const glowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0, color: die.side === 'off' ? 0xa47bff : 0x27d7ff, blending: THREE.AdditiveBlending })
    const glow = new THREE.Mesh(shadowGeo, glowMat)
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.003
    shadow.add(glow)
    glow.rotation.x = 0
    glow.position.set(0, 0, 0.001)
    disposables.push(shadowMat, glowMat)
    scene.add(shadow)
    group.visible = false
    scene.add(group)

    return {
      group,
      shadow,
      shadowMat,
      glowMat,
      skin,
      qFinal,
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(),
      turns: (2.2 + Math.random() * 1.2) * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1),
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      rest: inradius,
      die,
      landed: false,
      landedAt: 0,
    }
  })

  const layout = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const dist = camPos.length()
    const half = Math.tan((camera.fov * Math.PI) / 360) * dist * camera.aspect * 0.86
    const place = (list: Body[], center: number, span: number, dir: number) => {
      const gap = Math.min(1.55, (span * 2) / Math.max(1, list.length))
      list.forEach((b, i) => {
        const x = center + (i - (list.length - 1) / 2) * gap
        b.to.set(x, b.rest, (i % 2 === 0 ? 0.12 : -0.22) + (list.length === 1 ? 0 : 0))
        b.from.set(dir * (half + 1.6), 1.8, 1.0 - i * 0.4)
      })
    }
    if (opts.solo) place(bodies, 0, half * 0.8, -1)
    else {
      place(bodies.filter((b) => b.die.side === 'off'), -half * 0.52, half * 0.44, -1)
      place(bodies.filter((b) => b.die.side === 'def'), half * 0.52, half * 0.44, 1)
    }
  }
  const observer = new ResizeObserver(() => {
    layout()
    renderer.render(scene, camera)
  })
  observer.observe(canvas)
  layout()

  const spin = new THREE.Quaternion()
  const start = opts.startedAt
  let frame = 0
  const pose = (b: Body, t: number, now: number) => {
    const e = 1 - Math.pow(1 - t, 3)
    spin.setFromAxisAngle(b.axis, b.turns * Math.pow(1 - t, 2.2))
    b.group.quaternion.copy(spin).multiply(b.qFinal)
    const bounce = Math.abs(Math.cos(t * Math.PI * 3.5)) * Math.pow(1 - t, 1.8) * 1.5
    b.group.position.set(b.from.x + (b.to.x - b.from.x) * e, b.to.y + bounce, b.from.z + (b.to.z - b.from.z) * e)
    b.shadow.position.set(b.group.position.x, 0.002, b.group.position.z)
    const lift = Math.min(1, bounce / 1.5)
    b.shadow.scale.setScalar(0.75 + lift * 0.7)
    b.shadowMat.opacity = 0.75 * (1 - lift * 0.7)
    if (b.landed) {
      const since = (now - b.landedAt) / 1000
      const pop = since < 0.3 ? 1 + Math.sin((since / 0.3) * Math.PI) * 0.14 : 1
      b.group.scale.setScalar(pop)
      b.glowMat.opacity = b.die.discarded ? 0 : 0.55 * Math.max(0.35, 1 - since * 1.2)
      b.skin.opacity = b.die.discarded ? 0.28 : 1
    }
  }
  const tick = (now: number) => {
    let moving = false
    bodies.forEach((b, i) => {
      const t = opts.instant ? 1 : (now - start - b.die.delay) / b.die.duration
      if (t < 0) {
        moving = true
        return
      }
      b.group.visible = true
      if (t >= 1 && !b.landed) {
        b.landed = true
        b.landedAt = opts.instant ? now - 1000 : now
        opts.onLand?.(i)
      }
      pose(b, Math.min(1, t), now)
      if (t < 1 || now - b.landedAt < 900) moving = true
    })
    renderer.render(scene, camera)
    if (moving) frame = window.requestAnimationFrame(tick)
  }
  tick(performance.now())

  return () => {
    window.cancelAnimationFrame(frame)
    observer.disconnect()
    disposables.forEach((d) => d.dispose())
    renderer.dispose()
  }
}
