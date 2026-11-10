import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  X,
  Mail,
  KeyRound,
  Save,
  CalendarClock
} from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import WizardNuevoCierre from './components/WizardNuevoCierre';
import ListaMisCierres from './components/ListaMisCierres';
import PanelAdminTimeline from './components/PanelAdminTimeline';
import {
  obtenerTodosLosContratos,
  sincronizarDispositivosNube
} from './db/database';
import {
  procesarColaSincronizacion,
  obtenerConfigSincronizacion,
  guardarConfigSincronizacion
} from './services/syncService';

export default function App() {
  const [activeTab, setActiveTab] = useState('nuevo'); // 'nuevo' | 'lista' | 'timeline'
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [contratos, setContratos] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [toast, setToast] = useState(null);
  const [mostrarConfigModal, setMostrarConfigModal] = useState(false);

  // Estado del modal de configuración de Sincronización
  const [configForm, setConfigForm] = useState(() => obtenerConfigSincronizacion());

  const mostrarNotificacion = useCallback((tipo, titulo, mensaje) => {
    setToast({ tipo, titulo, mensaje, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Cargar contratos almacenados en IndexedDB
  const recargarContratos = useCallback(async () => {
    try {
      const lista = await obtenerTodosLosContratos();
      setContratos(lista);
      return lista;
    } catch (error) {
      console.error('Error al leer contratos de IndexedDB:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    recargarContratos();
  }, [recargarContratos]);

  // Función que ejecuta la sincronización bidireccional (Celular <-> Ordenador) + Cola de correo
  const ejecutarSincronizacion = useCallback(
    async (origenAutomatico = false) => {
      const configActual = obtenerConfigSincronizacion();
      const usaInterna = configActual.sincronizacionInternaApp !== false;

      if (!navigator.onLine && !usaInterna) {
        if (!origenAutomatico) {
          mostrarNotificacion(
            'warning',
            'Dispositivo en Modo Offline',
            'Los contratos siguen resguardados en tu dispositivo.'
          );
        }
        return;
      }

      setIsSyncing(true);

      try {
        const listaActual = await obtenerTodosLosContratos();
        const pendientes = listaActual.filter((c) => !c.sincronizado);

        if (pendientes.length > 0) {
          setSyncProgress({
            actual: 1,
            total: pendientes.length,
            empresa: pendientes[0].empresa
          });
        }

        // 1. Procesar cola local / correo opcional
        let resultadoCola = { sincronizados: 0 };
        if (pendientes.length > 0) {
          resultadoCola = await procesarColaSincronizacion((progreso) => {
            setSyncProgress(progreso);
          });
        }

        // 2. Sincronizar bidireccionalmente en la nube (Celular <-> Ordenador)
        const resultadoNube = await sincronizarDispositivosNube();

        const listaFinal = await recargarContratos();

        if (resultadoNube.nuevosDescargados > 0) {
          mostrarNotificacion(
            'success',
            `¡${resultadoNube.nuevosDescargados} ${
              resultadoNube.nuevosDescargados === 1
                ? 'Cierre Recibido'
                : 'Cierres Recibidos'
            } desde otro dispositivo!`,
            `Tu celular y ordenador están sincronizados (${listaFinal.length} proyectos en total).`
          );
        } else if (resultadoCola.sincronizados > 0) {
          mostrarNotificacion(
            'success',
            `¡${resultadoCola.sincronizados} ${
              resultadoCola.sincronizados === 1
                ? 'Proyecto Sincronizado'
                : 'Proyectos Sincronizados'
            }!`,
            'Tus datos ya están actualizados entre celular y ordenador.'
          );
        } else if (!origenAutomatico) {
          mostrarNotificacion(
            'success',
            'Celular y Ordenador Sincronizados',
            `Base de datos al día (${listaFinal.length} ${
              listaFinal.length === 1 ? 'contrato' : 'contratos'
            }).`
          );
        }
      } catch (err) {
        console.error('Error en sincronización:', err);
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [mostrarNotificacion, recargarContratos]
  );

  // Sincronización automática al abrir la app, al cambiar de pestaña y cada 20 segundos
  useEffect(() => {
    if (!navigator.onLine) return;
    sincronizarDispositivosNube().then((res) => {
      if (res && res.ok) {
        recargarContratos();
      }
    });
  }, [activeTab, recargarContratos]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (navigator.onLine) {
        sincronizarDispositivosNube().then((res) => {
          if (res && res.ok) {
            recargarContratos();
          }
        });
      }
    }, 20000);
    return () => clearInterval(intervalo);
  }, [recargarContratos]);

  // Manejadores de eventos de red: window.addEventListener('online') y window.addEventListener('offline')
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      mostrarNotificacion(
        'info',
        'Conexión a Internet Restablecida',
        'Sincronizando cierres acumulados...'
      );
      ejecutarSincronizacion(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      mostrarNotificacion(
        'warning',
        'Modo Offline Activado',
        'Puedes seguir levantando cierres, firmas, abonos y contratos PDF sin internet.'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ejecutarSincronizacion, mostrarNotificacion]);

  // Callback cuando se completa el Paso 4 del Wizard
  const handleCierreGuardado = async (nuevoContrato, nombreArchivoPDF) => {
    await recargarContratos();

    mostrarNotificacion(
      'success',
      '¡Contrato Guardado y PDF Descargado!',
      `Se descargó "${nombreArchivoPDF}" y se calculó su Línea de Tiempo de entregas.`
    );

    // Redirigir a la vista "Mis Cierres"
    setActiveTab('lista');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Sincronizar automáticamente en la bandeja interna / línea de tiempo
    setTimeout(() => {
      ejecutarSincronizacion(true);
    }, 600);
  };

  const handleGuardarConfig = (e) => {
    e.preventDefault();
    const guardada = guardarConfigSincronizacion(configForm);
    setConfigForm(guardada);
    setMostrarConfigModal(false);
    mostrarNotificacion(
      'success',
      'Preferencias Guardadas',
      guardada.sincronizacionInternaApp
        ? 'Sincronización Interna en Línea de Tiempo activa.'
        : `Correo receptor configurado: ${guardada.emailDestino || 'Ninguno'}`
    );
  };

  const pendientesCount = contratos.filter((c) => !c.sincronizado).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Barra Superior Responsiva (Con pestañas integradas en Laptop y compacta en Celular) */}
      <Header
        isOnline={isOnline}
        pendientesCount={pendientesCount}
        totalContratos={contratos.length}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isSyncing={isSyncing}
        onSyncNow={() => ejecutarSincronizacion(false)}
        onOpenSettings={() => setMostrarConfigModal(true)}
      />

      {/* Alerta Flotante (Toast) */}
      {toast && (
        <div className="fixed top-16 inset-x-0 z-40 px-4 pointer-events-none">
          <div
            className={`max-w-md mx-auto pointer-events-auto rounded-2xl p-3.5 shadow-xl border flex items-start gap-3 transition-all ${
              toast.tipo === 'success'
                ? 'bg-emerald-950 text-white border-emerald-500/50'
                : toast.tipo === 'warning'
                ? 'bg-amber-950 text-amber-100 border-amber-500/50'
                : 'bg-[#1E3A5F] text-white border-[#5DADE2]/50'
            }`}
          >
            {toast.tipo === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.tipo === 'warning' ? (
              <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#5DADE2] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold">{toast.titulo}</p>
              <p className="opacity-90 mt-0.5 leading-snug">{toast.mensaje}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contenido Principal según la pestaña activa */}
      <main className="flex-1">
        {activeTab === 'nuevo' ? (
          <WizardNuevoCierre onCierreGuardado={handleCierreGuardado} />
        ) : activeTab === 'lista' ? (
          <ListaMisCierres
            contratos={contratos}
            isOnline={isOnline}
            isSyncing={isSyncing}
            syncProgress={syncProgress}
            onSyncNow={() => ejecutarSincronizacion(false)}
            onIrANuevoCierre={() => setActiveTab('nuevo')}
            onReintentarEnvio={recargarContratos}
            onNotificarAbono={(contratoAct, ticket) => {
              const liquidado = Number(ticket.saldoRestante) <= 0;
              mostrarNotificacion(
                'success',
                liquidado
                  ? `¡Proyecto 100% Liquidado! (${ticket.folioTicket})`
                  : `¡Abono #${ticket.numeroAbono} Registrado!`,
                liquidado
                  ? `Ticket ${ticket.folioTicket} descargado. El código fuente de ${contratoAct.empresa} ha quedado LIBERADO.`
                  : `Ticket ${ticket.folioTicket} (${ticket.metodoPago}) descargado. Restan: $${Number(ticket.saldoRestante).toFixed(2)} MXN.`
              );
            }}
          />
        ) : (
          <PanelAdminTimeline
            contratos={contratos}
            onRecargar={recargarContratos}
            onNotificar={(titulo, mensaje) =>
              mostrarNotificacion('success', titulo, mensaje)
            }
          />
        )}
      </main>

      {/* Navegación Inferior (1. Nuevo Cierre | 2. Mis Cierres | 3. Entregas [PIN]) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalContratos={contratos.length}
        pendientesCount={pendientesCount}
      />

      {/* Modal de Preferencias de Sincronización */}
      {mostrarConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#1E3A5F] text-white px-4 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Preferencias de Sincronización
                </h3>
                <p className="text-[11px] text-[#5DADE2]">
                  Sincronización interna en App + Copia por correo opcional
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarConfigModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarConfig} className="p-4 space-y-3.5 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.sincronizacionInternaApp !== false}
                  onChange={(e) =>
                    setConfigForm((p) => ({
                      ...p,
                      sincronizacionInternaApp: e.target.checked
                    }))
                  }
                  className="mt-0.5 rounded text-emerald-700"
                />
                <span className="text-[11px] text-emerald-950 leading-snug">
                  <strong className="flex items-center gap-1 text-emerald-900 mb-0.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Sincronizar dentro de la App (Recomendado)
                  </strong>
                  Envía los cierres directamente a tu pestaña privada <strong>"Entregas (Línea de Tiempo)"</strong> sin necesidad de configurar correos ni servidores externos.
                </span>
              </label>

              <div className="pt-1 border-t border-slate-100">
                <label className="block font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#65174E]" />
                  Copia por Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  value={configForm.emailDestino || ''}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, emailDestino: e.target.value }))
                  }
                  placeholder="Opcional: tu correo para recibir respaldo"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  Web3Forms Access Key (Opcional)
                </label>
                <input
                  type="text"
                  value={configForm.web3formsKey || ''}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, web3formsKey: e.target.value }))
                  }
                  placeholder="Opcional: clave de web3forms.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarConfigModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-[#5DADE2]" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
