import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Eliminador ligero de cualquier badge flotante externo ("Powered by Netlify") fuera de #root
function eliminarBadgesExternos() {
  try {
    Array.from(document.documentElement.children).forEach((el) => {
      const tag = (el.tagName || '').toLowerCase();
      if (tag !== 'head' && tag !== 'body') {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });

    Array.from(document.body?.children || []).forEach((el) => {
      const tag = (el.tagName || '').toLowerCase();
      if (el.id !== 'root' && tag !== 'script' && tag !== 'style' && tag !== 'link') {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });
  } catch {
    // Ignorar errores de DOM
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', eliminarBadgesExternos);
  window.addEventListener('load', eliminarBadgesExternos);

  // Observar únicamente hijos directos de <html> y <body> (sin subtree para no interferir con React)
  const observer = new MutationObserver(() => {
    eliminarBadgesExternos();
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: false });
  }
}

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
