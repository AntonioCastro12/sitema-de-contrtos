# RCM CodeDev — PWA Offline-First de Cierres en Campo

Aplicación Web Progresiva (PWA) móvil diseñada bajo arquitectura **100% Offline-First** para el equipo comercial en campo de **RCM CodeDev** (Agencia de Desarrollo de Software y Automatización).

Permite levantar requerimientos técnicos sin conexión a internet, redactar condiciones económicas con cálculo automático de anticipo/saldo, capturar la firma digital táctil del cliente, generar y descargar al instante el contrato formal en **PDF** en el celular y encolar los cierres en **IndexedDB** (`Dexie.js`) para sincronizarlos automáticamente uno a uno por correo electrónico al recuperar señal.

---

## Arquitectura y Stack Técnico

- **Frontend Mobile-First:** React 18 + Tailwind CSS con la paleta institucional de **RCM CodeDev** (`#1E3A5F`, `#1A5276`, `#5DADE2`, `#65174E`, `#F8FAFC`).
- **Base de Datos Local Offline:** `Dexie.js` sobre `IndexedDB` (`RCMCierresCodeDevDB`, tabla `contratos`).
- **Firma Digital Táctil:** `signature_pad` con escalado automático para pantallas Retina / móviles (`devicePixelRatio`) y exportación limpia en `Base64`.
- **Generación de Contratos PDF Local:** `pdfmake` + `vfs_fonts` empaquetados íntegramente en el bundle local con el logotipo institucional de RCM CodeDev embebido en Base64 (cero descargas externas en tiempo de ejecución).
- **Service Worker & Precache:** `vite-plugin-pwa` (Workbox `generateSW`) que precachea todos los bundles JS, CSS, fuentes, iconos y manifiesto web.
- **Sincronización Inteligente (`online` / `offline`):** Escucha eventos `window.addEventListener('online')` y `window.addEventListener('offline')`, procesando iterativamente **uno a uno** todos los registros con `sincronizado === false` hacia `/api/contratos/sincronizar` o directo a la API de **Resend**.

---

## Estructura del Proyecto

```text
rcm-cierres-pwa/
├── api/
│   └── contratos/
│       └── sincronizar.js         # Endpoint backend Serverless (POST /api/contratos/sincronizar)
├── public/
│   ├── icon.svg                   # Icono vectorial PWA RCM CodeDev
│   └── rcm-logo.jpg               # Logotipo oficial RCM CodeDev
├── src/
│   ├── assets/
│   │   └── logoBase64.js          # Logotipo en Base64 para membrete PDF offline
│   ├── components/
│   │   ├── Header.jsx             # Barra superior con badge Online/Offline y contador de cola
│   │   ├── BottomNav.jsx          # Navegación inferior ("Nuevo Cierre" | "Mis Cierres")
│   │   ├── WizardNuevoCierre.jsx  # Asistente en 4 pasos + Lienzo de firma + Generador PDF
│   │   └── ListaMisCierres.jsx    # Tarjetas de contratos, estados, regeneración PDF y vista de correo
│   ├── db/
│   │   └── database.js            # Configuración de Dexie.js e IndexedDB (tabla `contratos`)
│   ├── services/
│   │   ├── pdfGenerator.js        # Construcción y descarga local del contrato legal en PDF (pdfmake)
│   │   └── syncService.js         # Cola iterativa uno a uno y plantilla HTML ejecutiva de correo
│   ├── App.jsx                    # Orquestador de estado de red, notificaciones y vistas
│   ├── main.jsx                   # Punto de entrada y registro automático del Service Worker
│   └── index.css                  # Estilos base Tailwind y optimización táctil móvil
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js                 # Configuración de VitePWA y Workbox Precache
```

---

## Instalación y Ejecución

```bash
# 1. Entrar al directorio del proyecto
cd rcm-cierres-pwa

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev

# 4. Compilar versión de producción con Service Worker Offline
npm run build

# 5. Previsualizar build de producción (con Service Worker activo)
npm run preview
```
