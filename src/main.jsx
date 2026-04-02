import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { LanguageProvider } from './i18n/LanguageContext'
import './index.css'
import App from './App.jsx'

// Get the current URL to serve the manifest dynamically
const manifestUrl = new URL('tonconnect-manifest.json', window.location.href).href;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <App />
      </TonConnectUIProvider>
    </LanguageProvider>
  </StrictMode>,
)
