import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  RefreshCw,
  Mail,
  X,
  PlusCircle,
  CloudUpload,
  RotateCcw,
  ExternalLink,
  CreditCard,
  Receipt,
  Lock,
  Unlock,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import {
  descargarContratoPDF,
  descargarTicketAbonoPDF,
  formatearMonedaMXN,
  formatearFechaLarga,
  obtenerPagosNormalizados
} from '../services/pdfGenerator';
import {
  construirCorreoCierreHTML,
  construirMailtoFallback,
  obtenerConfigSincronizacion
} from '../services/syncService';
import {
  desmarcarContratoSincronizado,
  registrarAbonoContrato,
  calcularFechaLimiteLiquidacion,
  eliminarContratoLocal
} from '../db/database';
import { METODOS_PAGO_RCM } from '../services/clausulasCatalogo';

export default function ListaMisCierres({
  contratos,
  isSyncing,
  syncProgress,
  onSyncNow,
  onIrANuevoCierre,
  onReintentarEnvio,
  onNotificarAbono
}) {
  const [descargandoId, setDescargandoId] = useState(null);
  const [descargandoTicketId, setDescargandoTicketId] = useState(null);
  const [contratoPreviewCorreo, setContratoPreviewCorreo] = useState(null);
  const [tarjetaExpandidaId, setTarjetaExpandidaId] = useState(null);

  // Estado del Modal para Registrar un Nuevo Abono
  const [contratoAbonoActivo, setContratoAbonoActivo] = useState(null);
  const [montoAbonoInput, setMontoAbonoInput] = useState('');
  const [metodoAbonoInput, setMetodoAbonoInput] = useState('Tarjeta de Crédito');
  const [referenciaAbonoInput, setReferenciaAbonoInput] = useState('');
  const [conceptoAbonoInput, setConceptoAbonoInput] = useState('');
  const [errorAbono, setErrorAbono] = useState('');
  const [procesandoAbono, setProcesandoAbono] = useState(false);

  const pendientesCount = contratos.filter((c) => !c.sincronizado).length;
  const sincronizadosCount = contratos.filter((c) => c.sincronizado).length;

  const handleVerPDF = async (contrato) => {
    try {
      setDescargandoId(contrato.id);
      await descargarContratoPDF(contrato);
    } finally {
      setDescargandoId(null);
    }
  };

  const handleDescargarTicketIndividual = async (contrato, pago) => {
    try {
      setDescargandoTicketId(pago.idPago || pago.folioTicket);
      await descargarTicketAbonoPDF(contrato, pago);
    } finally {
      setDescargandoTicketId(null);
    }
  };

  const handleReencolarParaEnvio = async (id) => {
    await desmarcarContratoSincronizado(id);
    if (onReintentarEnvio) {
      await onReintentarEnvio();
    }
    onSyncNow();
  };

  const handleAbrirAppCorreoNativa = (contrato) => {
    const config = obtenerConfigSincronizacion();
    const mailtoUrl = construirMailtoFallback(contrato, config.emailDestino);
    window.location.href = mailtoUrl;
  };

  const handleEliminarTarjeta = async (contrato) => {
    if (!contrato || !contrato.id) return;
    const confirmar = window.confirm(
      `¿Seguro que deseas borrar la tarjeta de "${contrato.empresa}"? Se eliminará de este dispositivo y de la nube.`
    );
    if (!confirmar) return;

    await eliminarContratoLocal(contrato.id);
    if (onReintentarEnvio) {
      await onReintentarEnvio();
    }
  };

  const abrirModalAbono = (contrato) => {
    const montoTotal = Number(contrato.montoTotal) || 0;
    const pagos = obtenerPagosNormalizados(contrato);
    const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const saldoPendiente = Math.max(0, montoTotal - totalPagado);

    setContratoAbonoActivo({ ...contrato, saldoCalculado: saldoPendiente });
    setMontoAbonoInput(String(saldoPendiente));
    setMetodoAbonoInput('Tarjeta de Crédito');
    setReferenciaAbonoInput('');
    setConceptoAbonoInput('');
    setErrorAbono('');
  };

  const handleConfirmarAbono = async (e) => {
    e.preventDefault();
    if (!contratoAbonoActivo) return;

    const monto = parseFloat(montoAbonoInput) || 0;
    if (monto <= 0) {
      setErrorAbono('Ingresa un monto mayor a $0.00 MXN.');
      return;
    }
    if (monto > contratoAbonoActivo.saldoCalculado + 0.01) {
      setErrorAbono(
        `El abono no puede superar el saldo pendiente (${formatearMonedaMXN(
          contratoAbonoActivo.saldoCalculado
        )}).`
      );
      return;
    }

    try {
      setProcesandoAbono(true);
      setErrorAbono('');

      const { contratoActualizado, nuevoTicket } = await registrarAbonoContrato(
        contratoAbonoActivo.id,
        {
          monto,
          metodoPago: metodoAbonoInput,
          referencia: referenciaAbonoInput,
          concepto: conceptoAbonoInput
        }
      );

      await descargarTicketAbonoPDF(contratoActualizado, nuevoTicket);

      if (onReintentarEnvio) {
        await onReintentarEnvio();
      }
      if (onNotificarAbono) {
        onNotificarAbono(contratoActualizado, nuevoTicket);
      }

      setTarjetaExpandidaId(contratoActualizado.id);
      setContratoAbonoActivo(null);
    } catch (err) {
      setErrorAbono(err.message || 'Error al registrar el abono.');
    } finally {
      setProcesandoAbono(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 md:pb-16 space-y-5">
      {/* Cabecera Responsiva */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
            Historial y Cobranza
          </span>
          <h2 className="text-xl font-extrabold text-[#1E3A5F]">Mis Cierres</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {contratos.length}{' '}
            {contratos.length === 1
              ? 'contrato registrado en este dispositivo'
              : 'contratos registrados en este dispositivo'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          {pendientesCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {pendientesCount} pendientes
            </span>
          )}
          {sincronizadosCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {sincronizadosCount} sincronizados
            </span>
          )}

          <button
            type="button"
            onClick={onIrANuevoCierre}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4 text-[#5DADE2]" />
            <span>Nuevo Cierre</span>
          </button>
        </div>
      </div>

      {/* Progreso de sincronización si está corriendo */}
      {isSyncing && syncProgress && (
        <div className="p-4 rounded-2xl bg-[#1E3A5F] text-white text-xs flex items-center gap-2.5 shadow-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-[#5DADE2] shrink-0" />
          <span className="truncate font-medium">
            Sincronizando ({syncProgress.actual}/{syncProgress.total}): {syncProgress.empresa}
          </span>
        </div>
      )}

      {/* Estado vacío amigable */}
      {contratos.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-[#1A5276] flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#1E3A5F]">
            Aún no tienes cierres guardados
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Crea tu primer cierre; el contrato PDF y sus tickets de abono se generan al instante en celular o laptop.
          </p>
          <button
            type="button"
            onClick={onIrANuevoCierre}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#1E3A5F] text-white text-xs font-bold shadow-md hover:bg-[#1A5276] transition"
          >
            <PlusCircle className="w-4 h-4 text-[#5DADE2]" />
            Levantar Primer Cierre
          </button>
        </div>
      ) : (
        /* Grid Responsivo: 1 col en Celular, 2 cols en Tablet/Laptop, 3 cols en Monitor Grande */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {contratos.map((contrato) => {
            const esSincronizado = Boolean(contrato.sincronizado);
            const montoTotal = Number(contrato.montoTotal) || 0;
            const pagos = obtenerPagosNormalizados(contrato);
            const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
            const saldo = Math.max(0, montoTotal - totalPagado);
            const porcentajePagado =
              montoTotal > 0 ? Math.min(100, Math.round((totalPagado / montoTotal) * 100)) : 0;
            const estaLiquidado = saldo <= 0 && montoTotal > 0;
            const expandida = tarjetaExpandidaId === contrato.id;
            const fechaLimiteISO =
              contrato.fechaLimiteLiquidacion || calcularFechaLimiteLiquidacion(contrato.fecha);

            return (
              <article
                key={contrato.id}
                className="bg-white rounded-3xl shadow-card hover:shadow-lg border border-slate-100 p-5 space-y-4 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Fila 1: Empresa + Estado */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        {contrato.folio || `#${contrato.id}`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            esSincronizado ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <h3 className="text-base font-extrabold text-[#1E3A5F] truncate">
                          {contrato.empresa}
                        </h3>
                      </div>
                      <p className="text-xs font-medium text-[#65174E] truncate mt-0.5 pl-3.5">
                        {contrato.servicio}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                        esSincronizado
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {esSincronizado ? 'Sincronizado' : 'En cola'}
                    </span>
                  </div>

                  {/* Fila 2: Resumen Financiero y Barra */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] font-medium block">
                          Abonado
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          {formatearMonedaMXN(totalPagado)}
                        </span>
                      </div>

                      <div className="text-center">
                        <span className="text-slate-400 text-[10px] font-medium block">
                          Total
                        </span>
                        <span className="font-extrabold text-[#1E3A5F]">
                          {formatearMonedaMXN(montoTotal)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 text-[10px] font-medium block">
                          Restante
                        </span>
                        <span
                          className={`font-extrabold ${
                            estaLiquidado ? 'text-emerald-700' : 'text-[#65174E]'
                          }`}
                        >
                          {formatearMonedaMXN(saldo)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          estaLiquidado
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-[#1E3A5F] to-[#5DADE2]'
                        }`}
                        style={{ width: `${porcentajePagado}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span
                        className={`font-bold flex items-center gap-1 ${
                          estaLiquidado ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {estaLiquidado ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            Código Liberado (100%)
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-[#65174E]" />
                            Código al liquidar (2 meses)
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setTarjetaExpandidaId(expandida ? null : contrato.id)
                        }
                        className="text-[#1A5276] font-bold flex items-center gap-0.5 hover:underline"
                      >
                        <span>
                          {pagos.length} {pagos.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                        {expandida ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Panel Desplegable: Historial de Tickets */}
                  {expandida && (
                    <div className="pt-1 space-y-2.5 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                        <span>
                          Cliente:{' '}
                          <strong className="text-slate-700">
                            {contrato.representante}
                          </strong>
                        </span>
                        {!estaLiquidado && (
                          <span>Límite: {formatearFechaLarga(fechaLimiteISO)}</span>
                        )}
                      </div>

                      {pagos.length > 0 && (
                        <div className="space-y-1.5">
                          {pagos.map((pago, idx) => (
                            <div
                              key={pago.idPago || idx}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>
                                    #{pago.numeroAbono || idx + 1}:{' '}
                                    {formatearMonedaMXN(pago.monto)}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                                    {pago.metodoPago}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {pago.folioTicket} • {formatearFechaLarga(pago.fecha)}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDescargarTicketIndividual(contrato, pago)
                                }
                                disabled={
                                  descargandoTicketId ===
                                  (pago.idPago || pago.folioTicket)
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#1E3A5F] hover:text-white text-[#1E3A5F] border border-slate-200 font-bold text-[11px] flex items-center gap-1 transition shrink-0"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#65174E]" />
                                <span>Ticket</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {esSincronizado && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleReencolarParaEnvio(contrato.id)}
                            className="text-[11px] font-medium text-amber-700 hover:underline flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Re-sincronizar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones Principales */}
                <div className="flex items-center gap-2 pt-1">
                  {!estaLiquidado && (
                    <button
                      type="button"
                      onClick={() => abrirModalAbono(contrato)}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-[#65174E] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition"
                    >
                      <CreditCard className="w-4 h-4 text-pink-200" />
                      <span>Abonar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleVerPDF(contrato)}
                    disabled={descargandoId === contrato.id}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition"
                  >
                    <FileText className="w-4 h-4 text-[#5DADE2]" />
                    <span>
                      {descargandoId === contrato.id ? 'Generando...' : 'Ver PDF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContratoPreviewCorreo(contrato)}
                    title="Vista previa del resumen"
                    className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition"
                  >
                    <Mail className="w-4 h-4 text-slate-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEliminarTarjeta(contrato)}
                    title="Borrar tarjeta"
                    className="py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-[#65174E] text-[#65174E] hover:text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Botón Flotante "Sincronizar ahora" */}
      <div className="fixed bottom-20 md:bottom-8 inset-x-0 z-20 px-4 sm:px-6 pointer-events-none">
        <div className="max-w-6xl mx-auto flex justify-end">
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className={`pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-full font-extrabold text-xs shadow-xl transition-all active:scale-95 ${
              pendientesCount > 0
                ? 'bg-[#65174E] text-white'
                : 'bg-[#1E3A5F] text-white'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#5DADE2]" />
            ) : (
              <CloudUpload className="w-4 h-4 text-[#5DADE2]" />
            )}
            <span>
              {isSyncing
                ? 'Sincronizando...'
                : pendientesCount > 0
                ? `Sincronizar (${pendientesCount})`
                : 'Sincronizar ahora'}
            </span>
          </button>
        </div>
      </div>

      {/* MODAL PARA REGISTRAR UN NUEVO ABONO */}
      {contratoAbonoActivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-[#1E3A5F] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-[#5DADE2] block">
                  Nuevo Abono y Ticket PDF
                </span>
                <h3 className="text-sm font-bold truncate">
                  {contratoAbonoActivo.empresa}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContratoAbonoActivo(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarAbono} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="block text-[11px] text-slate-500">
                    Saldo pendiente
                  </span>
                  <span className="text-base font-extrabold text-[#65174E]">
                    {formatearMonedaMXN(contratoAbonoActivo.saldoCalculado)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMontoAbonoInput(String(contratoAbonoActivo.saldoCalculado))
                  }
                  className="px-3 py-1.5 rounded-xl bg-sky-100 text-[#1A5276] font-bold text-xs"
                >
                  Liquidar total
                </button>
              </div>

              {errorAbono && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorAbono}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Monto del abono (MXN)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    required
                    value={montoAbonoInput}
                    onChange={(e) => setMontoAbonoInput(e.target.value)}
                    className="w-full pl-9 pr-14 py-3 rounded-2xl border border-emerald-300 bg-emerald-50/40 font-extrabold text-sm text-emerald-950 focus:outline-none focus:bg-white"
                  />
                  <span className="absolute right-4 top-3.5 font-bold text-emerald-700">
                    MXN
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Método de pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO_RCM.map((m) => {
                    const activo = metodoAbonoInput === m.label;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodoAbonoInput(m.label)}
                        className={`p-2.5 rounded-xl border text-left font-bold flex items-center gap-2 transition ${
                          activo
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{m.icono}</span>
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Referencia <span className="text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={referenciaAbonoInput}
                    onChange={(e) => setReferenciaAbonoInput(e.target.value)}
                    placeholder="Ej. Visa *4821"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    Concepto <span className="text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={conceptoAbonoInput}
                    onChange={(e) => setConceptoAbonoInput(e.target.value)}
                    placeholder="Ej. Abono quincenal"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setContratoAbonoActivo(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAbono}
                  className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Receipt className="w-4 h-4 text-[#5DADE2]" />
                  <span>
                    {procesandoAbono ? 'Generando...' : 'Guardar y Descargar Ticket'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vista Previa del Correo */}
      {contratoPreviewCorreo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-[#5DADE2] block">
                  Vista Previa del Correo
                </span>
                <h4 className="text-xs font-bold truncate">
                  {construirCorreoCierreHTML(contratoPreviewCorreo).asunto}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setContratoPreviewCorreo(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 text-xs text-slate-700 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="truncate text-[11px]">
                Puedes enviarlo automáticamente o abrir tu app de correo:
              </span>
              <button
                type="button"
                onClick={() => handleAbrirAppCorreoNativa(contratoPreviewCorreo)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#65174E] text-white font-semibold text-[11px] shadow-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir en mi Correo
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
              <div
                className="rounded-2xl overflow-hidden border border-slate-200 bg-white"
                dangerouslySetInnerHTML={{
                  __html: construirCorreoCierreHTML(contratoPreviewCorreo).html
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
