import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Registro automático del Service Worker para funcionamiento 100% Offline-First
registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[RCM CodeDev PWA] Aplicación lista para funcionar 100% sin conexión a internet.');
  },
  onNeedRefresh() {
    console.info('[RCM CodeDev PWA] Nueva versión disponible.');
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
