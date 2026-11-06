/* Layout Component - A component that wraps the main content of the app
   - Use this file to add a header, footer, or other elements that should be present on every page
   - This component is used in the App.tsx file to wrap the main content of the app */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  useEffect(() => {
    const viewport = window.visualViewport
    const updateViewport = () => {
      // Keep the composer inside the visible area when a mobile keyboard opens.
      if (viewport && viewport.scale === 1) {
        document.documentElement.style.setProperty('--app-viewport-height', `${viewport.height}px`)
        document.documentElement.style.setProperty('--app-viewport-top', `${viewport.offsetTop}px`)
      }
    }
    updateViewport()
    viewport?.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    return () => {
      viewport?.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      document.documentElement.style.removeProperty('--app-viewport-height')
      document.documentElement.style.removeProperty('--app-viewport-top')
    }
  }, [])

  return (
    <main className="messenger-viewport flex min-h-0 min-w-0 flex-col overflow-hidden">
      <Outlet />
    </main>
  )
}
