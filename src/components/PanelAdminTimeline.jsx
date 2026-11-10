import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  Link2,
  ExternalLink,
  FileText,
  KeyRound,
  LogOut,
  Check,
  Layers,
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
  Wallet,
  Award,
  Edit3
} from 'lucide-react';
import {
  calcularHitosLineaTiempo,
  actualizarAvanceIngenieria,
  actualizarDatosComisionVendedor
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

export default function PanelAdminTimeline({
  contratos,
  onRecargar,
  onActualizarContratos,
  onNotificar
}) {
  const recargarDatos = onRecargar || onActualizarContratos;
  const config = obtenerConfigSincronizacion();
  const pinGuardado = config.pinAdmin || '2026';

  const [autenticado, setAutenticado] = useState(
    () => sessionStorage.getItem('rcm_admin_unlocked') === 'true'
  );
  const [pinInput, setPinInput] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const [nuevoPinInput, setNuevoPinInput] = useState('');

  // Vista interna del Admin: 'dashboard' (Ventas y 25% Comisión) | 'timeline' (Entregas)
  const [vistaAdmin, setVistaAdmin] = useState('dashboard');

  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activos' | 'completados'
  const [editandoLigasId, setEditandoLigasId] = useState(null);
  const [formLigas, setFormLigas] = useState({
    ligaQA: '',
    ligaStaging: '',
    ligaProduccion: ''
  });

  // Edición rápida del nombre del vendedor en un cierre
  const [editandoVendedorId, setEditandoVendedorId] = useState(null);
  const [nombreVendedorTemp, setNombreVendedorTemp] = useState('');

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
    if (onNotificar) {
      onNotificar('PIN Actualizado', 'Tu nuevo código de acceso privado quedó guardado.');
    }
  };

  // Alternar check de un hito en la línea de tiempo
  const handleToggleHito = async (contrato, campoHito) => {
    const etapa = contrato.etapaIngenieria || {};
    const nuevoValor = !etapa[campoHito];
    await actualizarAvanceIngenieria(contrato.id, {
      [campoHito]: nuevoValor
    });
    if (recargarDatos) {
      await recargarDatos();
    }
  };

  // Alternar pago de comisión del 25% al vendedor
  const handleToggleComisionPagada = async (contrato) => {
    const nuevoEstado = !contrato.comisionPagada;
    await actualizarDatosComisionVendedor(contrato.id, {
      comisionPagada: nuevoEstado,
      fechaPagoComision: nuevoEstado ? new Date().toISOString() : null
    });
    if (recargarDatos) {
      await recargarDatos();
    }
    if (onNotificar) {
      onNotificar(
        nuevoEstado ? 'Comisión 25% Marcada como Pagada' : 'Comisión Marcada como Pendiente',
        `${contrato.empresa} (${contrato.vendedor || 'Vendedor en Campo'})`
      );
    }
  };

  const handleGuardarNombreVendedor = async (contratoId) => {
    const limpio = nombreVendedorTemp.trim() || 'Vendedor en Campo';
    await actualizarDatosComisionVendedor(contratoId, {
      vendedor: limpio
    });
    setEditandoVendedorId(null);
    setNombreVendedorTemp('');
    if (recargarDatos) {
      await recargarDatos();
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
    if (recargarDatos) {
      await recargarDatos();
    }
    if (onNotificar) {
      onNotificar('Ligas Guardadas', 'Se actualizaron las URLs de QA, Staging y Producción.');
    }
  };

  // ==================== PANTALLA DE BLOQUEO PRIVADO ====================
  if (!autenticado) {
    return (
      <div className="max-w-md mx-auto px-4 pt-12 pb-28">
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-7 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#65174E] text-white flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-7 h-7 text-[#5DADE2]" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] bg-pink-50 px-3 py-1 rounded-full">
              Acceso Exclusivo Dirección
            </span>
            <h2 className="text-xl font-extrabold text-[#1E3A5F] mt-2.5">
              Panel de Administrador
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consulta el <strong>Dashboard de Ventas</strong>, el cálculo automático del{' '}
              <strong>25% de comisión para el vendedor</strong>, tu{' '}
              <strong>75% de ganancia neta</strong> y el cronograma de entregas.
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
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-center font-extrabold tracking-[0.3em] text-lg text-[#1E3A5F] focus:bg-white focus:outline-none focus:border-[#1A5276]"
            />

            {errorPin && (
              <p className="text-xs text-red-600 font-medium">{errorPin}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] hover:opacity-95 text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4 text-[#5DADE2]" />
              <span>Desbloquear Panel de Administrador</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== CÁLCULOS FINANCIEROS Y COMISIONES (25% VENDEDOR / 75% RCM) ====================
  const PORCENTAJE_VENDEDOR = 0.25; // 25% para el vendedor
  const PORCENTAJE_RCM = 0.75; // 75% ganancia para RCM CodeDev

  const contratosFinanzas = contratos.map((c) => {
    const montoTotal = Number(c.montoTotal) || 0;
    const pagos = obtenerPagosNormalizados(c);
    const totalPagado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const saldo = Math.max(0, montoTotal - totalPagado);

    const comisionTotal25 = Math.round(montoTotal * PORCENTAJE_VENDEDOR * 100) / 100;
    const comisionSobreCobrado25 = Math.round(totalPagado * PORCENTAJE_VENDEDOR * 100) / 100;

    const gananciaTotalRCM75 = Math.round(montoTotal * PORCENTAJE_RCM * 100) / 100;
    const gananciaCobradaRCM75 = Math.round(totalPagado * PORCENTAJE_RCM * 100) / 100;

    return {
      ...c,
      montoTotal,
      totalPagado,
      saldo,
      comisionTotal25,
      comisionSobreCobrado25,
      gananciaTotalRCM75,
      gananciaCobradaRCM75,
      vendedorNombre: (c.vendedor || 'Vendedor en Campo').trim() || 'Vendedor en Campo'
    };
  });

  const sumaVentasTotales = contratosFinanzas.reduce((acc, c) => acc + c.montoTotal, 0);
  const sumaTotalCobrado = contratosFinanzas.reduce((acc, c) => acc + c.totalPagado, 0);
  const sumaSaldoPorCobrar = contratosFinanzas.reduce((acc, c) => acc + c.saldo, 0);

  const sumaComisionTotal25 = contratosFinanzas.reduce((acc, c) => acc + c.comisionTotal25, 0);
  const sumaComisionSobreCobrado25 = contratosFinanzas.reduce(
    (acc, c) => acc + c.comisionSobreCobrado25,
    0
  );
  const sumaComisionesYaPagadas = contratosFinanzas
    .filter((c) => c.comisionPagada)
    .reduce((acc, c) => acc + c.comisionTotal25, 0);

  const sumaGananciaTotalRCM75 = contratosFinanzas.reduce(
    (acc, c) => acc + c.gananciaTotalRCM75,
    0
  );
  const sumaGananciaCobradaRCM75 = contratosFinanzas.reduce(
    (acc, c) => acc + c.gananciaCobradaRCM75,
    0
  );

  // Agrupación por Vendedor
  const mapaVendedores = {};
  contratosFinanzas.forEach((c) => {
    const key = c.vendedorNombre;
    if (!mapaVendedores[key]) {
      mapaVendedores[key] = {
        nombre: key,
        cierresCount: 0,
        totalVendido: 0,
        totalCobrado: 0,
        comision25Total: 0,
        comision25SobreCobrado: 0,
        gananciaRCM75: 0
      };
    }
    mapaVendedores[key].cierresCount += 1;
    mapaVendedores[key].totalVendido += c.montoTotal;
    mapaVendedores[key].totalCobrado += c.totalPagado;
    mapaVendedores[key].comision25Total += c.comisionTotal25;
    mapaVendedores[key].comision25SobreCobrado += c.comisionSobreCobrado25;
    mapaVendedores[key].gananciaRCM75 += c.gananciaTotalRCM75;
  });
  const listaVendedores = Object.values(mapaVendedores).sort(
    (a, b) => b.totalVendido - a.totalVendido
  );

  // ==================== PROCESAMIENTO DE LÍNEA DE TIEMPO ====================
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
    .sort(
      (a, b) =>
        new Date(a.hitosCalculados.fechaProduccion) -
        new Date(b.hitosCalculados.fechaProduccion)
    );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 md:pb-16 space-y-6">
      {/* Cabecera Ejecutiva Responsiva */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#1A5276] to-[#65174E] text-white rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-[#5DADE2] shrink-0">
              {vistaAdmin === 'dashboard' ? (
                <BarChart3 className="w-6 h-6" />
              ) : (
                <Layers className="w-6 h-6" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                Panel de Dirección • RCM CodeDev
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold">
                {vistaAdmin === 'dashboard'
                  ? 'Dashboard de Ventas y Comisiones (25%)'
                  : 'Línea de Tiempo de Entregas'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCambiandoPin((p) => !p)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <KeyRound className="w-4 h-4 text-[#5DADE2]" />
              <span>Cambiar PIN</span>
            </button>
            <button
              type="button"
              onClick={handleLock}
              className="px-3.5 py-2 rounded-xl bg-black/25 hover:bg-black/40 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-pink-300" />
              <span>Bloquear</span>
            </button>
          </div>
        </div>

        {/* Cambio rápido de PIN */}
        {cambiandoPin && (
          <form
            onSubmit={handleGuardarNuevoPin}
            className="p-3 rounded-2xl bg-black/20 flex items-center gap-2 max-w-md"
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={nuevoPinInput}
              onChange={(e) => setNuevoPinInput(e.target.value)}
              placeholder="Nuevo PIN (mín. 4 dígitos)"
              className="flex-1 px-3 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#5DADE2] text-[#1E3A5F] text-xs font-extrabold"
            >
              Guardar PIN
            </button>
          </form>
        )}

        {/* Selector Principal: Dashboard de Ventas (25%) vs Línea de Tiempo */}
        <div className="grid grid-cols-2 gap-2 bg-black/20 p-1.5 rounded-2xl text-xs max-w-lg">
          <button
            type="button"
            onClick={() => setVistaAdmin('dashboard')}
            className={`py-2.5 px-3 rounded-xl font-extrabold flex items-center justify-center gap-2 transition ${
              vistaAdmin === 'dashboard'
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Ventas y Comisión 25%</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaAdmin('timeline')}
            className={`py-2.5 px-3 rounded-xl font-extrabold flex items-center justify-center gap-2 transition ${
              vistaAdmin === 'timeline'
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Línea de Tiempo ({contratos.length})</span>
          </button>
        </div>
      </div>

      {/* ==================== VISTA 1: DASHBOARD DE VENTAS Y COMISIONES (25% VENDEDOR / 75% RCM) ==================== */}
      {vistaAdmin === 'dashboard' && (
        <div className="space-y-6">
          {/* Fila de 4 Tarjetas KPI (1 col en móvil, 2 en tablet, 4 en laptop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Volumen Total */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Vendido (100%)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1E3A5F] mt-1">
                  {formatearMonedaMXN(sumaVentasTotales)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {contratos.length}{' '}
                  {contratos.length === 1 ? 'contrato firmado' : 'contratos firmados'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#1A5276] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2: Cobrado en Caja */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Cobrado en Caja
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
                  {formatearMonedaMXN(sumaTotalCobrado)}
                </p>
                <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                  Por cobrar: {formatearMonedaMXN(sumaSaldoPorCobrar)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Tu Ganancia Neta RCM (75%) */}
            <div className="bg-[#1E3A5F] text-white rounded-3xl shadow-card p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                  Tu Ganancia RCM (75%)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold mt-1">
                  {formatearMonedaMXN(sumaGananciaTotalRCM75)}
                </p>
                <span className="text-[11px] text-emerald-300 font-semibold mt-1 block">
                  En caja hoy: {formatearMonedaMXN(sumaGananciaCobradaRCM75)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#5DADE2] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4: Comisión Vendedor (25%) */}
            <div className="bg-[#65174E] text-white rounded-3xl shadow-card p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-200 block">
                  Comisión Vendedor (25%)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold mt-1">
                  {formatearMonedaMXN(sumaComisionTotal25)}
                </p>
                <span className="text-[11px] text-amber-300 font-semibold mt-1 block">
                  Sobre lo cobrado: {formatearMonedaMXN(sumaComisionSobreCobrado25)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Layout de 2 Columnas en Laptop: Izquierda (Reparto y Ranking Vendedores) | Derecha (Proyectos) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda (5 cols en Laptop) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Barra Visual de Reparto 75% RCM vs 25% Vendedor */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#1E3A5F]">
                    Esquema de Reparto de Ventas
                  </h3>
                  <span className="text-[11px] font-bold text-[#65174E] bg-pink-50 px-2.5 py-1 rounded-full">
                    75% Agencia / 25% Vendedor
                  </span>
                </div>

                <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 p-0.5 gap-0.5">
                  <div
                    style={{ width: '75%' }}
                    className="bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] h-full rounded-l-full flex items-center justify-center text-[10px] font-bold text-white"
                  >
                    75% RCM
                  </div>
                  <div
                    style={{ width: '25%' }}
                    className="bg-[#65174E] h-full rounded-r-full flex items-center justify-center text-[10px] font-bold text-white"
                  >
                    25%
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Por cada cierre, el sistema separa automáticamente el{' '}
                  <strong className="text-[#65174E]">25% de comisión para el vendedor</strong>{' '}
                  (mostrándote cuánto le toca sobre lo ya pagado por el cliente) y el{' '}
                  <strong className="text-[#1E3A5F]">75% libre para RCM CodeDev</strong>.
                </p>
              </div>

              {/* Rendimiento por Vendedor */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#1E3A5F] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#65174E]" />
                    <span>Comisiones por Vendedor (25%)</span>
                  </h3>
                </div>

                {listaVendedores.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Sin vendedores registrados todavía.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {listaVendedores.map((vend) => (
                      <div
                        key={vend.nombre}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-extrabold text-[#1E3A5F]">
                              {vend.nombre}
                            </p>
                            <span className="text-[11px] text-slate-500">
                              {vend.cierresCount}{' '}
                              {vend.cierresCount === 1
                                ? 'venta cerrada'
                                : 'ventas cerradas'}{' '}
                              • Total: {formatearMonedaMXN(vend.totalVendido)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase text-[#65174E] block">
                              Comisión 25%
                            </span>
                            <span className="text-sm font-extrabold text-[#65174E]">
                              {formatearMonedaMXN(vend.comision25Total)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">
                              25% sobre lo cobrado:
                            </span>
                            <strong className="text-emerald-700">
                              {formatearMonedaMXN(vend.comision25SobreCobrado)}
                            </strong>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block">
                              Tu 75% libre (RCM):
                            </span>
                            <strong className="text-[#1E3A5F]">
                              {formatearMonedaMXN(vend.gananciaRCM75)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha (7 cols en Laptop): Desglose por Proyecto */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Desglose de Ventas y Pago de Comisiones ({contratosFinanzas.length})
                </h3>
                {sumaComisionesYaPagadas > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    Comisiones pagadas: {formatearMonedaMXN(sumaComisionesYaPagadas)}
                  </span>
                )}
              </div>

              {contratosFinanzas.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-10 text-center space-y-2">
                  <DollarSign className="w-8 h-8 text-[#5DADE2] mx-auto" />
                  <h4 className="text-sm font-bold text-[#1E3A5F]">
                    Aún no hay ventas registradas
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    En cuanto se levante el primer cierre, verás aquí cuánto le toca al vendedor (25%) y tu ganancia neta (75%).
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {contratosFinanzas.map((c) => (
                    <article
                      key={c.id}
                      className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-3.5 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {c.folio} • {formatearFechaCorta(c.fecha)}
                          </span>
                          <h4 className="text-base font-extrabold text-[#1E3A5F] truncate">
                            {c.empresa}
                          </h4>
                          <p className="text-xs font-medium text-[#65174E] truncate">
                            {c.servicio}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block">
                            Contrato (100%)
                          </span>
                          <span className="text-base font-extrabold text-[#1E3A5F]">
                            {formatearMonedaMXN(c.montoTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Vendedor asignado */}
                      {editandoVendedorId === c.id ? (
                        <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                          <input
                            type="text"
                            value={nombreVendedorTemp}
                            onChange={(e) => setNombreVendedorTemp(e.target.value)}
                            placeholder="Nombre del vendedor"
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => handleGuardarNombreVendedor(c.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold"
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs bg-slate-50 px-3.5 py-2.5 rounded-2xl">
                          <span className="text-slate-600">
                            Vendedor:{' '}
                            <strong className="text-[#1E3A5F]">{c.vendedorNombre}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoVendedorId(c.id);
                              setNombreVendedorTemp(c.vendedorNombre);
                            }}
                            className="text-[11px] font-bold text-[#1A5276] hover:underline flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Asignar / Cambiar</span>
                          </button>
                        </div>
                      )}

                      {/* Tarjetas de 75% Ganancia RCM vs 25% Comisión Vendedor */}
                      <div className="grid grid-cols-3 gap-2.5 text-center text-[11px]">
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">
                            Cobrado Cliente
                          </span>
                          <strong className="text-emerald-700 text-xs sm:text-sm">
                            {formatearMonedaMXN(c.totalPagado)}
                          </strong>
                        </div>

                        <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-100">
                          <span className="text-[#65174E] font-bold block text-[10px]">
                            25% Vendedor
                          </span>
                          <strong className="text-[#65174E] text-xs sm:text-sm">
                            {formatearMonedaMXN(c.comisionTotal25)}
                          </strong>
                          <span className="block text-[10px] text-slate-500">
                            Cobrado: {formatearMonedaMXN(c.comisionSobreCobrado25)}
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100">
                          <span className="text-[#1E3A5F] font-bold block text-[10px]">
                            75% Tu Ganancia
                          </span>
                          <strong className="text-[#1E3A5F] text-xs sm:text-sm">
                            {formatearMonedaMXN(c.gananciaTotalRCM75)}
                          </strong>
                          <span className="block text-[10px] text-slate-500">
                            En caja: {formatearMonedaMXN(c.gananciaCobradaRCM75)}
                          </span>
                        </div>
                      </div>

                      {/* Botón para marcar si ya le pagaste el 25% al vendedor */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleComisionPagada(c)}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                            c.comisionPagada
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#65174E] text-white shadow-2xs hover:opacity-95'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {c.comisionPagada
                              ? '✓ Comisión 25% Liquidada al Vendedor'
                              : `Marcar 25% Pagado al Vendedor (${formatearMonedaMXN(
                                  c.comisionSobreCobrado25
                                )} sobre lo cobrado)`}
                          </span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VISTA 2: LÍNEA DE TIEMPO DE ENTREGAS (1 col en móvil / 2 cols en laptop) ==================== */}
      {vistaAdmin === 'timeline' && (
        <div className="space-y-5">
          {/* Filtros rápidos de entregas */}
          <div className="grid grid-cols-3 gap-2 bg-slate-200/70 p-1.5 rounded-2xl text-xs max-w-md">
            {[
              { id: 'todos', label: `Todos (${contratos.length})` },
              {
                id: 'activos',
                label: `En Desarrollo (${
                  contratos.filter((c) => !c.etapaIngenieria?.produccionEntregado)
                    .length
                })`
              },
              {
                id: 'completados',
                label: `Entregados (${
                  contratos.filter((c) => c.etapaIngenieria?.produccionEntregado)
                    .length
                })`
              }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroEstado(tab.id)}
                className={`py-2 rounded-xl font-bold transition ${
                  filtroEstado === tab.id
                    ? 'bg-white text-[#1E3A5F] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {contratosConTimeline.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-10 text-center space-y-2">
              <Calendar className="w-8 h-8 text-[#5DADE2] mx-auto" />
              <h3 className="text-sm font-bold text-[#1E3A5F]">
                No hay proyectos en esta vista
              </h3>
              <p className="text-xs text-slate-500">
                Cada vez que guardes un cierre, aparecerá aquí ordenado por su fecha compromiso de entrega.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {contratosConTimeline.map((contrato) => {
                const {
                  hitosCalculados,
                  etapa,
                  diasParaEntregaFinal,
                  completado
                } = contrato;
                const montoTotal = Number(contrato.montoTotal) || 0;
                const pagos = obtenerPagosNormalizados(contrato);
                const totalPagado = pagos.reduce(
                  (acc, p) => acc + (Number(p.monto) || 0),
                  0
                );
                const saldo = Math.max(0, montoTotal - totalPagado);
                const estaLiquidado = saldo <= 0 && montoTotal > 0;

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
                    texto:
                      diasParaEntregaFinal === 0
                        ? 'Se entrega HOY'
                        : `Urgente (${diasParaEntregaFinal}d)`,
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
                    sub: `Meta comprometida (${
                      contrato.plazoDias || 7
                    } días hábiles)`,
                    fecha: formatearFechaCorta(hitosCalculados.fechaProduccion),
                    completado: Boolean(etapa.produccionEntregado),
                    url: etapa.ligaProduccion
                  }
                ];

                return (
                  <article
                    key={contrato.id}
                    className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-4"
                  >
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
                        <h3 className="text-base font-extrabold text-[#1E3A5F] truncate mt-0.5">
                          {contrato.empresa}
                        </h3>
                        <p className="text-xs font-medium text-[#65174E] truncate">
                          {contrato.servicio}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full shrink-0 ${badgeUrgencia.clase}`}
                      >
                        {badgeUrgencia.texto}
                      </span>
                    </div>

                    {/* LÍNEA DE TIEMPO VISUAL VERTICAL */}
                    <div className="pl-2 pt-1 space-y-0">
                      {pasosTimeline.map((hito, idx) => {
                        const esUltimo = idx === pasosTimeline.length - 1;
                        return (
                          <div key={hito.key} className="relative pl-6 pb-4">
                            {!esUltimo && (
                              <div
                                className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${
                                  hito.completado
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-200'
                                }`}
                              />
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleHito(contrato, hito.key)
                              }
                              title="Toca para marcar/desmarcar esta etapa"
                              className={`absolute left-0 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition ${
                                hito.completado
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'bg-white border-slate-300 text-transparent hover:border-[#1A5276]'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </button>

                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleHito(contrato, hito.key)
                                  }
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
                                    <span className="truncate max-w-[200px]">
                                      {hito.url}
                                    </span>
                                  </a>
                                )}
                              </div>

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${
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

                    {/* Hitos Post-Entrega */}
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">
                          Fin Garantía (30 días)
                        </span>
                        <strong className="text-slate-700">
                          {formatearFechaCorta(hitosCalculados.fechaFinGarantia)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block">
                          {estaLiquidado
                            ? 'Código Fuente'
                            : 'Límite Liquidar (2 meses)'}
                        </span>
                        <strong
                          className={
                            estaLiquidado ? 'text-emerald-700' : 'text-[#65174E]'
                          }
                        >
                          {estaLiquidado
                            ? '🔓 Entregable (Pagado)'
                            : `🔒 ${formatearFechaCorta(
                                hitosCalculados.fechaLimiteLiquidacion
                              )}`}
                        </strong>
                      </div>
                    </div>

                    {/* Editor de las 3 ligas */}
                    {editandoLigasId === contrato.id ? (
                      <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-[#5DADE2]/40 space-y-2.5 text-xs">
                        <span className="font-bold text-[#1E3A5F] block">
                          Configurar URLs de las 3 Ligas del Proyecto
                        </span>
                        <input
                          type="text"
                          value={formLigas.ligaQA}
                          onChange={(e) =>
                            setFormLigas((p) => ({
                              ...p,
                              ligaQA: e.target.value
                            }))
                          }
                          placeholder="1. URL Liga QA (ej. qa.rcmcodedev.com/cliente)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={formLigas.ligaStaging}
                          onChange={(e) =>
                            setFormLigas((p) => ({
                              ...p,
                              ligaStaging: e.target.value
                            }))
                          }
                          placeholder="2. URL Liga Staging (ej. staging.rcmcodedev.com/cliente)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={formLigas.ligaProduccion}
                          onChange={(e) =>
                            setFormLigas((p) => ({
                              ...p,
                              ligaProduccion: e.target.value
                            }))
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#1A5276]" />
                          <span>Pegar Ligas QA / Staging / Prod</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => descargarContratoPDF(contrato)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#1A5276] font-bold text-xs transition"
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
      )}
    </div>
  );
}
