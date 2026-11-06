/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { cleanDemoData } from './lib/clean-demo-data'

cleanDemoData(localStorage)
createRoot(document.getElementById('root')!).render(<App />)

// Registro do Service Worker do PWA Mensageiro
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/mensageiro/sw.js', { scope: '/mensageiro/' })
      .then((reg) => {
        console.log('[PWA] Service Worker registrado com escopo:', reg.scope)
      })
      .catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err)
      })
  })
}

