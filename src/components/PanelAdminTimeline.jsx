import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
  ExternalLink,
  Code2,
  ShieldCheck,
  FileText,
  KeyRound,
  LogOut,
  Check,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  calcularHitosLineaTiempo,
  actualizarAvanceIngenieria
} from '../db/database';
import {
  formatearMonedaMXN,
  obtenerPagosNormalizados,
  descargarContratoPDF
} from '../services/pdfGenerator';
import {
  obtenerConfigSincronizacion,
  guardarConfigSincronizacion
} from '../services/syncService';

function formatearFechaCorta(fechaISO) {
  try {
    const d = new Date(fechaISO);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

function calcularDiasRestantes(fechaObjetivoISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const obj = new Date(fechaObjetivoISO);
  obj.setHours(0, 0, 0, 0);
  const diffMs = obj - hoy;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function PanelAdminTimeline({ contratos, onActualizarContratos }) {
  const config = obtenerConfigSincronizacion();
  const pinGuardado = config.pinAdmin || '2026';

  const [autenticado, setAutenticado] = useState(
    () => sessionStorage.getItem('rcm_admin_unlocked') === 'true'
  );
  const [pinInput, setPinInput] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const [nuevoPinInput, setNuevoPinInput] = useState('');

  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activos' | 'completados'
  const [editandoLigasId, setEditandoLigasId] = useState(null);
  const [formLigas, setFormLigas] = useState({
    ligaQA: '',
    ligaStaging: '',
    ligaProduccion: ''
  });

  // Desbloqueo con PIN privado
  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput.trim() === pinGuardado) {
      sessionStorage.setItem('rcm_admin_unlocked', 'true');
      setAutenticado(true);
      setErrorPin('');
      setPinInput('');
    } else {
      setErrorPin('PIN incorrecto. Acceso exclusivo para Dirección RCM CodeDev.');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('rcm_admin_unlocked');
    setAutenticado(false);
  };

  const handleGuardarNuevoPin = (e) => {
    e.preventDefault();
    if (nuevoPinInput.trim().length < 4) return;
    guardarConfigSincronizacion({ pinAdmin: nuevoPinInput.trim() });
    setCambiandoPin(false);
    setNuevoPinInput('');
  };

  // Alternar check de un hito en la línea de tiempo (Insumos -> QA -> Staging -> Producción)
  const handleToggleHito = async (contrato, campoHito) => {
    const etapa = contrato.etapaIngenieria || {};
    const nuevoValor = !etapa[campoHito];
    await actualizarAvanceIngenieria(contrato.id, {
      [campoHito]: nuevoValor
    });
    if (onActualizarContratos) {
      await onActualizarContratos();
    }
  };

  const abrirEditorLigas = (contrato) => {
    const etapa = contrato.etapaIngenieria || {};
    setEditandoLigasId(contrato.id);
    setFormLigas({
      ligaQA: etapa.ligaQA || '',
      ligaStaging: etapa.ligaStaging || '',
      ligaProduccion: etapa.ligaProduccion || ''
    });
  };

  const guardarLigasContrato = async (contratoId) => {
    await actualizarAvanceIngenieria(contratoId, formLigas);
    setEditandoLigasId(null);
    if (onActualizarContratos) {
      await onActualizarContratos();
    }
  };

  // ==================== PANTALLA DE BLOQUEO PRIVADO ====================
  if (!autenticado) {
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-28">
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-6 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[#1E3A5F] text-[#5DADE2] flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] bg-pink-50 px-3 py-1 rounded-full">
              Acceso Exclusivo Dirección
            </span>
            <h2 className="text-lg font-bold text-[#1E3A5F] mt-2">
              Línea de Tiempo e Ingeniería
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Este apartado es privado para ti. Visualiza el cronograma de entregas (QA, Staging y Producción) y la bandeja de proyectos sincronizados.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3 pt-1">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Ingresa tu PIN privado"
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-center font-bold tracking-[0.3em] text-lg text-[#1E3A5F] focus:bg-white focus:outline-none focus:border-[#1A5276]"
            />

            {errorPin && (
              <p className="text-xs text-red-600 font-medium">{errorPin}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4 text-[#5DADE2]" />
              <span>Desbloquear Mi Panel</span>
            </button>

            
          </form>
        </div>
      </div>
    );
  }

  // ==================== PROCESAMIENTO Y ORDENAMIENTO POR URGENCIA DE ENTREGA ====================
  const contratosConTimeline = contratos
    .map((c) => {
      const hitos = c.hitos || calcularHitosLineaTiempo(c.fecha, c.plazoDias || 7);
      const etapa = c.etapaIngenieria || {};
      const diasParaEntregaFinal = calcularDiasRestantes(hitos.fechaProduccion);
      const completado = Boolean(etapa.produccionEntregado);
      return {
        ...c,
        hitosCalculados: hitos,
        etapa,
        diasParaEntregaFinal,
        completado
      };
    })
    .filter((c) => {
      if (filtroEstado === 'activos') return !c.completado;
      if (filtroEstado === 'completados') return c.completado;
      return true;
    })
    .sort((a, b) => new Date(a.hitosCalculados.fechaProduccion) - new Date(b.hitosCalculados.fechaProduccion));

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-32 space-y-4">
      {/* Cabecera Privada del Administrador */}
      <div className="bg-[#1E3A5F] text-white rounded-3xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#5DADE2]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                Vista Privada • Antonio (RCM CodeDev)
              </span>
              <h2 className="text-sm font-bold">
                Línea de Tiempo de Entregas
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCambiandoPin((p) => !p)}
              title="Cambiar PIN privado"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleLock}
              title="Bloquear apartado privado"
              className="p-2 rounded-xl bg-[#65174E] hover:opacity-90 text-white text-xs flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cambio rápido de PIN */}
        {cambiandoPin && (
          <form
            onSubmit={handleGuardarNuevoPin}
            className="p-2.5 rounded-2xl bg-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={nuevoPinInput}
              onChange={(e) => setNuevoPinInput(e.target.value)}
              placeholder="Nuevo PIN (mín. 4 dígitos)"
              className="flex-1 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#5DADE2] text-[#1E3A5F] text-xs font-bold"
            >
              Guardar PIN
            </button>
          </form>
        )}

        {/* Filtros rápidos */}
        <div className="grid grid-cols-3 gap-1.5 bg-white/10 p-1 rounded-2xl text-xs">
          {[
            { id: 'todos', label: `Todos (${contratos.length})` },
            {
              id: 'activos',
              label: `En Desarrollo (${
                contratos.filter((c) => !c.etapaIngenieria?.produccionEntregado).length
              })`
            },
            {
              id: 'completados',
              label: `Entregados (${
                contratos.filter((c) => c.etapaIngenieria?.produccionEntregado).length
              })`
            }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroEstado(tab.id)}
              className={`py-1.5 rounded-xl font-semibold transition ${
                filtroEstado === tab.id
                  ? 'bg-white text-[#1E3A5F] shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Proyectos con su Línea de Tiempo */}
      {contratosConTimeline.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-8 text-center space-y-2">
          <Calendar className="w-8 h-8 text-[#5DADE2] mx-auto" />
          <h3 className="text-sm font-bold text-[#1E3A5F]">
            No hay proyectos en esta vista
          </h3>
          <p className="text-xs text-slate-500">
            Cada vez que guardes o sincronices un cierre, aparecerá aquí ordenado por su fecha compromiso de entrega.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {contratosConTimeline.map((contrato) => {
            const { hitosCalculados, etapa, diasParaEntregaFinal, completado } = contrato;
            const montoTotal = Number(contrato.montoTotal) || 0;
            const pagos = obtenerPagosNormalizados(contrato);
            const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
            const saldo = Math.max(0, montoTotal - totalPagado);
            const estaLiquidado = saldo <= 0 && montoTotal > 0;

            // Semáforo de urgencia de entrega
            let badgeUrgencia = {
              texto: `${diasParaEntregaFinal} días restantes`,
              clase: 'bg-sky-50 text-[#1A5276]'
            };
            if (completado) {
              badgeUrgencia = {
                texto: 'Entregado en Producción',
                clase: 'bg-emerald-50 text-emerald-700'
              };
            } else if (diasParaEntregaFinal < 0) {
              badgeUrgencia = {
                texto: `Vencido hace ${Math.abs(diasParaEntregaFinal)}d`,
                clase: 'bg-red-50 text-red-700'
              };
            } else if (diasParaEntregaFinal <= 2) {
              badgeUrgencia = {
                texto: diasParaEntregaFinal === 0 ? 'Se entrega HOY' : `Urgente (${diasParaEntregaFinal}d)`,
                clase: 'bg-amber-100 text-amber-800'
              };
            }

            const pasosTimeline = [
              {
                key: 'insumosRecibidos',
                titulo: '1. Insumos y Accesos del Cliente',
                sub: 'Plazo máx. 3 días hábiles',
                fecha: formatearFechaCorta(hitosCalculados.fechaInsumos),
                completado: Boolean(etapa.insumosRecibidos),
                url: null
              },
              {
                key: 'qaEntregado',
                titulo: '2. Liga 1: Ambiente QA (Pruebas)',
                sub: 'Validación interna de calidad',
                fecha: formatearFechaCorta(hitosCalculados.fechaQA),
                completado: Boolean(etapa.qaEntregado),
                url: etapa.ligaQA
              },
              {
                key: 'stagingEntregado',
                titulo: '3. Liga 2: Ambiente Staging',
                sub: 'Pre-producción y revisión con cliente',
                fecha: formatearFechaCorta(hitosCalculados.fechaStaging),
                completado: Boolean(etapa.stagingEntregado),
                url: etapa.ligaStaging
              },
              {
                key: 'produccionEntregado',
                titulo: '4. Liga 3: Producción (Entrega Final)',
                sub: `Meta comprometida (${contrato.plazoDias || 7} días hábiles)`,
                fecha: formatearFechaCorta(hitosCalculados.fechaProduccion),
                completado: Boolean(etapa.produccionEntregado),
                url: etapa.ligaProduccion
              }
            ];

            return (
              <article
                key={contrato.id}
                className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4"
              >
                {/* Cabecera del Proyecto */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        {contrato.folio || `#${contrato.id}`}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Inicio: {formatearFechaCorta(contrato.fecha)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#1E3A5F] truncate mt-0.5">
                      {contrato.empresa}
                    </h3>
                    <p className="text-xs font-medium text-[#65174E] truncate">
                      {contrato.servicio}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-full flex-shrink-0 ${badgeUrgencia.clase}`}
                  >
                    {badgeUrgencia.texto}
                  </span>
                </div>

                {/* LÍNEA DE TIEMPO VISUAL VERTICAL (Insumos -> QA -> Staging -> Producción) */}
                <div className="pl-2 pt-1 space-y-0">
                  {pasosTimeline.map((hito, idx) => {
                    const esUltimo = idx === pasosTimeline.length - 1;
                    return (
                      <div key={hito.key} className="relative pl-6 pb-4">
                        {/* Línea vertical conectora */}
                        {!esUltimo && (
                          <div
                            className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${
                              hito.completado ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          />
                        )}

                        {/* Círculo interactivo para marcar avance */}
                        <button
                          type="button"
                          onClick={() => handleToggleHito(contrato, hito.key)}
                          title="Toca para marcar/desmarcar esta etapa"
                          className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition ${
                            hito.completado
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-[#1A5276]'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>

                        {/* Contenido del Hito */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleHito(contrato, hito.key)}
                              className={`text-xs font-bold text-left block ${
                                hito.completado
                                  ? 'text-emerald-800 line-through decoration-emerald-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              {hito.titulo}
                            </button>
                            <span className="text-[11px] text-slate-400 block">
                              {hito.sub}
                            </span>
                            {hito.url && (
                              <a
                                href={
                                  hito.url.startsWith('http')
                                    ? hito.url
                                    : `https://${hito.url}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A5276] hover:underline mt-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="truncate max-w-[180px]">{hito.url}</span>
                              </a>
                            )}
                          </div>

                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                              hito.completado
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {hito.fecha}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hitos Post-Entrega: Garantía de 1 Mes y Límite de Liquidación (2 Meses) */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Fin Garantía (30 días)</span>
                    <strong className="text-slate-700">
                      {formatearFechaCorta(hitosCalculados.fechaFinGarantia)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">
                      {estaLiquidado ? 'Código Fuente' : 'Límite Liquidar (2 meses)'}
                    </span>
                    <strong className={estaLiquidado ? 'text-emerald-700' : 'text-[#65174E]'}>
                      {estaLiquidado
                        ? '🔓 Entregable (Pagado)'
                        : `🔒 ${formatearFechaCorta(hitosCalculados.fechaLimiteLiquidacion)}`}
                    </strong>
                  </div>
                </div>

                {/* Editor rápido para guardar las 3 ligas (QA, Staging y Producción) */}
                {editandoLigasId === contrato.id ? (
                  <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-[#5DADE2]/40 space-y-2.5 text-xs">
                    <span className="font-bold text-[#1E3A5F] block">
                      Configurar URLs de las 3 Ligas del Proyecto
                    </span>
                    <input
                      type="text"
                      value={formLigas.ligaQA}
                      onChange={(e) =>
                        setFormLigas((p) => ({ ...p, ligaQA: e.target.value }))
                      }
                      placeholder="1. URL Liga QA (ej. qa-cliente.netlify.app)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                    />
                    <input
                      type="text"
                      value={formLigas.ligaStaging}
                      onChange={(e) =>
                        setFormLigas((p) => ({ ...p, ligaStaging: e.target.value }))
                      }
                      placeholder="2. URL Liga Staging (ej. staging-cliente.netlify.app)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                    />
                    <input
                      type="text"
                      value={formLigas.ligaProduccion}
                      onChange={(e) =>
                        setFormLigas((p) => ({ ...p, ligaProduccion: e.target.value }))
                      }
                      placeholder="3. URL Liga Producción Final (ej. www.cliente.com)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditandoLigasId(null)}
                        className="px-3 py-1.5 text-slate-500 font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => guardarLigasContrato(contrato.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1E3A5F] text-white font-bold"
                      >
                        Guardar Ligas
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => abrirEditorLigas(contrato)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#1A5276]" />
                      <span>Pegar Ligas QA / Staging / Prod</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => descargarContratoPDF(contrato)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#1A5276] font-semibold text-xs transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
