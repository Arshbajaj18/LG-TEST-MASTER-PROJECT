import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled locally: the LG on-prem network may not reach Google Fonts.
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
