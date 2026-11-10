import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Eliminador activo de cualquier badge flotante externo ("Powered by Netlify")
function eliminarBadgesExternos() {
  try {
    // 0. Eliminar cualquier nodo inyectado en <html> fuera de <head> y <body>
    Array.from(document.documentElement.children).forEach((el) => {
      const tag = (el.tagName || '').toLowerCase();
      if (tag !== 'head' && tag !== 'body') {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });

    // 1. Eliminar cualquier nodo inyectado en body fuera de #root
    Array.from(document.body?.children || []).forEach((el) => {
      const tag = (el.tagName || '').toLowerCase();
      if (el.id !== 'root' && tag !== 'script' && tag !== 'style' && tag !== 'link') {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });

    // 2. Buscar enlaces o contenedores que digan "Powered by Netlify" o apunten a netlify.com
    const enlaces = document.querySelectorAll('a[href*="netlify.com"], [class*="netlify"], [id*="netlify"]');
    enlaces.forEach((el) => {
      if (!document.getElementById('root')?.contains(el)) {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });

    const todos = document.querySelectorAll('body *');
    todos.forEach((el) => {
      if (document.getElementById('root')?.contains(el)) return;
      const texto = (el.textContent || '').trim().toLowerCase();
      if (texto.includes('powered by netlify') || texto === 'netlify') {
        el.style.setProperty('display', 'none', 'important');
        el.remove();
      }
    });
  } catch {
    // Ignorar errores de DOM
  }
}

if (typeof window !== 'undefined') {
  eliminarBadgesExternos();
  window.addEventListener('DOMContentLoaded', eliminarBadgesExternos);
  window.addEventListener('load', eliminarBadgesExternos);

  const observer = new MutationObserver(() => {
    eliminarBadgesExternos();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
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
