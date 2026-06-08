import './splash.js'
import { ensurePaymentBrowserBridge } from './paymentFlow.js'
import { ensureOAuthBrowserBridge } from './authFlow.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

ensurePaymentBrowserBridge().catch(() => {})
ensureOAuthBrowserBridge().catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}