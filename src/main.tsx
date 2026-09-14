import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react";
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css'
import './styles/workbench.css'
import App from './App.tsx'

const shouldLoadAnalytics = window.location.hostname === 'compactor.kuberbassi.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {shouldLoadAnalytics && <Analytics />}
  </StrictMode>,
)
