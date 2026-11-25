import * as THREE from 'three'

/**
 * The ISO ball in real 3D: black chrome with a thin-film (iridescent) coat, lit only by coloured
 * panels in a dark room so the reflections stay deep and sleek. Loaded on demand; returns a disposer.
 */
export function mountBall(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.98

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50)
  camera.position.set(0, 0, 5.4)

  // What the chrome reflects: a painted sky of deep blue, cyan, violet and magenta with a few soft
  // white strips for highlights. Drawn on a canvas, so there are no image files.
  const sky = document.createElement('canvas')
  sky.width = 1024
  sky.height = 512
  const g = sky.getContext('2d')
  if (g) {
    const h = g.createLinearGradient(0, 0, sky.width, 0)
    // Colour arrives in bands with near-black between them, so the ball stays dark glass with
    // bright rainbow edges instead of a flat pastel.
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
    v.addColorStop(0, 'rgba(255,255,255,0.22)')
    v.addColorStop(0.1, 'rgba(255,255,255,0)')
    v.addColorStop(0.5, 'rgba(0,0,6,0.35)')
    v.addColorStop(1, 'rgba(2,2,12,0.92)')
    g.fillStyle = v
    g.fillRect(0, 0, sky.width, sky.height)
    g.filter = 'blur(4px)'
    g.fillStyle = 'rgba(255,255,255,0.9)'
    g.fillRect(110, 100, 150, 8)
    g.fillRect(432, 130, 7, 120)
    g.fillRect(640, 90, 90, 6)
    g.filter = 'none'
  }
  const skyTex = new THREE.CanvasTexture(sky)
  skyTex.mapping = THREE.EquirectangularReflectionMapping
  skyTex.colorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTarget = pmrem.fromEquirectangular(skyTex)
  skyTex.dispose()
  scene.environment = envTarget.texture

  const ball = new THREE.Group()
  scene.add(ball)

  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescence: 0.5,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [140, 640],
    envMapIntensity: 1.25,
  })
  const sphereGeo = new THREE.SphereGeometry(1, 96, 96)
  ball.add(new THREE.Mesh(sphereGeo, skin))

  // Seams: two great circles and the two curved side lines, as thin dark grooves.
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const geos: THREE.BufferGeometry[] = [sphereGeo]
  const seam = (radius: number, rx: number, ry: number, x: number) => {
    const geo = new THREE.TorusGeometry(radius, 0.016, 12, 220)
    geos.push(geo)
    const mesh = new THREE.Mesh(geo, seamMat)
    mesh.rotation.set(rx, ry, 0)
    mesh.position.x = x
    ball.add(mesh)
  }
  seam(1.004, Math.PI / 2, 0, 0)
  seam(1.004, 0, 0, 0)
  const off = 0.6
  const side = Math.sqrt(1 - off * off) + 0.004
  seam(side, 0, Math.PI / 2, off)
  seam(side, 0, Math.PI / 2, -off)
  ball.rotation.set(0.3, 0.5, 0.22)

  // Soft rim light: a slightly larger shell that only glows at the silhouette.
  const rimMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: { a: { value: new THREE.Color(0x7a5cff) }, b: { value: new THREE.Color(0x27d7ff) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); vec3 c = mix(a, b, 0.5 + 0.5 * vN.y); gl_FragColor = vec4(c * f * 1.4, f); }',
  })
  const rimGeo = new THREE.SphereGeometry(1.09, 64, 64)
  geos.push(rimGeo)
  scene.add(new THREE.Mesh(rimGeo, rimMat))

  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let frame = 0
  let last = performance.now()
  const tick = (now: number) => {
    frame = window.requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!still) {
      ball.rotation.y += dt * 0.8
    }
    renderer.render(scene, camera)
  }
  // Draw once straight away so the ball is never blank while frames are paused (background tab).
  renderer.render(scene, camera)
  frame = window.requestAnimationFrame(tick)

  return () => {
    window.cancelAnimationFrame(frame)
    observer.disconnect()
    geos.forEach((g) => g.dispose())
    skin.dispose()
    seamMat.dispose()
    rimMat.dispose()
    envTarget.dispose()
    pmrem.dispose()
    renderer.dispose()
  }
}
