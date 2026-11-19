import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const OrbitScene = lazy(() => import('./OrbitScene'))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function HeroVisual() {
  const stage = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const showFallback = useCallback(() => setFailed(true), [])

  useEffect(() => {
    const element = stage.current
    if (!element || !window.WebGL2RenderingContext) return

    const preference = window.matchMedia('(min-width: 1041px) and (prefers-reduced-motion: no-preference)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    let nearby = false
    let delay: number | undefined

    function update() {
      window.clearTimeout(delay)
      if (!preference.matches || connection?.saveData) {
        setEnabled(false)
        setReady(false)
        return
      }
      if (nearby && document.readyState === 'complete') {
        delay = window.setTimeout(() => setEnabled(true), 180)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting
      update()
    }, { rootMargin: '100px' })
    observer.observe(element)
    preference.addEventListener('change', update)
    window.addEventListener('load', update)
    return () => {
      window.clearTimeout(delay)
      observer.disconnect()
      preference.removeEventListener('change', update)
      window.removeEventListener('load', update)
    }
  }, [])

  const showScene = enabled && !failed
  const isLive = showScene && ready

  return (
    <div className="hero-world" ref={stage} aria-hidden="true" data-scene={isLive ? 'webgl' : 'fallback'}>
      <div className="hero-art" />
      {showScene && (
        <div className="hero-canvas">
          <SceneBoundary onFailure={showFallback}>
            <Suspense fallback={null}>
              <OrbitScene stage={stage} onReady={setReady} onLoss={showFallback} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  )
}
