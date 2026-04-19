import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import axios from 'axios';

// Konfiguracja API dla APK i Weba
axios.defaults.baseURL = 'https://ais-pre-2r34i5ei7qr62mrnaweziz-194878385555.europe-west2.run.app';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
