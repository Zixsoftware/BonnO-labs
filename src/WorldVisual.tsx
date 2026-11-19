import { Component, Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const WorldScene = lazy(() => import('./WorldScene'))

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

export function WorldVisual() {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const showFallback = useCallback(() => setFailed(true), [])

  useEffect(() => {
    if (!window.WebGL2RenderingContext) return

    const preference = window.matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)')
    const forcedColors = window.matchMedia('(forced-colors: active)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    let delay: number | undefined

    function update() {
      window.clearTimeout(delay)
      if (!preference.matches || forcedColors.matches || connection?.saveData) {
        setEnabled(false)
        setReady(false)
        return
      }
      if (!document.hidden && document.readyState === 'complete') {
        delay = window.setTimeout(() => setEnabled(true), 180)
      }
    }

    update()
    preference.addEventListener('change', update)
    forcedColors.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('load', update)
    return () => {
      window.clearTimeout(delay)
      preference.removeEventListener('change', update)
      forcedColors.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('load', update)
    }
  }, [])

  const showScene = enabled && !failed
  const isLive = showScene && ready

  return (
    <div className="world-visual" aria-hidden="true" data-scene={isLive ? 'webgl' : 'fallback'}>
      <div className="world-fallback" />
      {showScene && (
        <div className="world-canvas">
          <SceneBoundary onFailure={showFallback}>
            <Suspense fallback={null}>
              <WorldScene onReady={setReady} onLoss={showFallback} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  )
}
