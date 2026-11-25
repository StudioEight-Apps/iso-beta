import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/card.css'
import './styles/card3d.css'
import './styles/screens.css'
import './styles/court.css'
import './styles/reveal.css'
import './styles/neon.css'
import './styles/cardface.css'
import './styles/arcade.css'
import './styles/ios.css'
import './styles/cardv3.css'
import './styles/v3.css'
import { applySkin } from './ui/lib/photos'
import App from './App'

applySkin()

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Splash: stays for at least a beat so it reads as a launch screen, then lifts off.
const splash = document.getElementById('splash')
if (splash) {
  const shownFor = performance.now()
  const lift = () => {
    splash.classList.add('is-out')
    window.setTimeout(() => splash.remove(), 500)
  }
  const ready = () => window.setTimeout(lift, Math.max(0, 1100 - shownFor))
  void (document.fonts?.ready ?? Promise.resolve()).then(ready, ready)
}
