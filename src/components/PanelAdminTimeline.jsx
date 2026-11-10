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
  Edit3,
  PieChart,
  PiggyBank,
  Plus,
  Trash2,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  calcularHitosLineaTiempo,
  actualizarAvanceIngenieria,
  actualizarDatosComisionVendedor,
  obtenerDatosInversionAdmin,
  guardarDatosInversionAdmin,
  agregarPartidaInversion,
  eliminarPartidaInversion,
  sincronizarDispositivosNube
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

const CATEGORIAS_INVERSION = [
  'Infraestructura / Hosting / Dominios',
  'APIs IA / WhatsApp / Cloud',
  'Publicidad / Meta Ads / Ventas',
  'Equipo / Licencias de Software',
  'Otros Costos Operativos'
];

const PLANTILLAS_INVERSION_RAPIDA = [
  {
    concepto: 'Dominio + Hosting Anual Cliente',
    categoria: 'Infraestructura / Hosting / Dominios',
    monto: 950
  },
  {
    concepto: 'Créditos API IA / Bot WhatsApp',
    categoria: 'APIs IA / WhatsApp / Cloud',
    monto: 400
  },
  {
    concepto: 'Campaña Meta Ads Prospectos',
    categoria: 'Publicidad / Meta Ads / Ventas',
    monto: 1200
  },
  {
    concepto: 'Servidor VPS / Base de Datos',
    categoria: 'Infraestructura / Hosting / Dominios',
    monto: 600
  }
];

export default function PanelAdminTimeline({
  contratos,
  onRecargar,
  onActualizarContratos,
  onNotificar
}) {
  const recargarDatos = onRecargar || onActualizarContratos;
  const config = obtenerConfigSincronizacion() || {};
  const pinGuardado = String(config.pinAdmin || '2026').trim();

  const [autenticado, setAutenticado] = useState(() => {
    try {
      return sessionStorage.getItem('rcm_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const [nuevoPinInput, setNuevoPinInput] = useState('');

  // Vistas del Panel Administrativo: 'dashboard' | 'inversion' | 'timeline'
  const [vistaAdmin, setVistaAdmin] = useState('dashboard');

  // Modo de la gráfica: 'total' (Sobre el 100% vendido) | 'cobrado' (Sobre lo ya cobrado en caja hoy)
  const [modoGrafica, setModoGrafica] = useState('total');

  // Estado del Apartado de Inversión
  const [datosInversion, setDatosInversion] = useState(() =>
    obtenerDatosInversionAdmin()
  );
  const [formInversion, setFormInversion] = useState({
    concepto: '',
    categoria: CATEGORIAS_INVERSION[0],
    monto: '',
    proyectoEmpresa: 'General RCM CodeDev'
  });

  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activos' | 'completados'
  const [editandoLigasId, setEditandoLigasId] = useState(null);
  const [formLigas, setFormLigas] = useState({
    ligaQA: '',
    ligaStaging: '',
    ligaProduccion: ''
  });

  const [editandoVendedorId, setEditandoVendedorId] = useState(null);
  const [nombreVendedorTemp, setNombreVendedorTemp] = useState('');

  const esPinValido = (valor) => {
    const limpio = String(valor || '').trim();
    return limpio === '2026' || (pinGuardado && limpio === pinGuardado);
  };

  const ejecutarDesbloqueo = () => {
    try {
      sessionStorage.setItem('rcm_admin_unlocked', 'true');
    } catch {
      // Ignorar si sessionStorage está restringido
    }
    setAutenticado(true);
    setErrorPin('');
    setPinInput('');
  };

  // Desbloqueo con PIN privado (manual o automático al escribir los 4 dígitos)
  const handleUnlock = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (esPinValido(pinInput)) {
      ejecutarDesbloqueo();
    } else {
      setErrorPin('PIN incorrecto. Ingresa 2026 para acceder.');
    }
  };

  const handlePinInputChange = (e) => {
    const val = e.target.value;
    setPinInput(val);
    if (errorPin) setErrorPin('');
    if (esPinValido(val)) {
      ejecutarDesbloqueo();
    }
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem('rcm_admin_unlocked');
    } catch {
      // Ignorar
    }
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

  // Funciones de Inversión
  const handleCambiarPorcentajeReinversion = (nuevoPorcentaje) => {
    const num = Math.max(0, Math.min(50, Number(nuevoPorcentaje) || 0));
    const actualizado = guardarDatosInversionAdmin({ porcentajeReinversion: num });
    setDatosInversion(actualizado);
    sincronizarDispositivosNube();
  };

  const handleAgregarInversionForm = (e) => {
    e.preventDefault();
    const montoNum = parseFloat(formInversion.monto) || 0;
    if (!formInversion.concepto.trim() || montoNum <= 0) return;

    const actualizado = agregarPartidaInversion({
      concepto: formInversion.concepto,
      categoria: formInversion.categoria,
      monto: montoNum,
      proyectoEmpresa: formInversion.proyectoEmpresa
    });
    setDatosInversion(actualizado);
    sincronizarDispositivosNube();
    setFormInversion({
      concepto: '',
      categoria: CATEGORIAS_INVERSION[0],
      monto: '',
      proyectoEmpresa: 'General RCM CodeDev'
    });
    if (onNotificar) {
      onNotificar(
        'Inversión Registrada',
        `Se descontaron ${formatearMonedaMXN(montoNum)} (${formInversion.concepto}) en tu cálculo de utilidad.`
      );
    }
  };

  const handleAgregarPlantillaInversion = (plantilla) => {
    const actualizado = agregarPartidaInversion({
      concepto: plantilla.concepto,
      categoria: plantilla.categoria,
      monto: plantilla.monto,
      proyectoEmpresa: 'General RCM CodeDev'
    });
    setDatosInversion(actualizado);
    sincronizarDispositivosNube();
    if (onNotificar) {
      onNotificar(
        'Partida de Inversión Agregada',
        `${plantilla.concepto}: ${formatearMonedaMXN(plantilla.monto)}`
      );
    }
  };

  const handleEliminarInversion = (idPartida) => {
    const actualizado = eliminarPartidaInversion(idPartida);
    setDatosInversion(actualizado);
    sincronizarDispositivosNube();
  };

  const handleToggleHito = async (contrato, campoHito) => {
    const etapa = contrato.etapaIngenieria || {};
    const nuevoValor = !etapa[campoHito];
    await actualizarAvanceIngenieria(contrato.id, {
      [campoHito]: nuevoValor
    });
    sincronizarDispositivosNube();
    if (recargarDatos) {
      await recargarDatos();
    }
  };

  const handleToggleComisionPagada = async (contrato) => {
    const nuevoEstado = !contrato.comisionPagada;
    await actualizarDatosComisionVendedor(contrato.id, {
      comisionPagada: nuevoEstado,
      fechaPagoComision: nuevoEstado ? new Date().toISOString() : null
    });
    sincronizarDispositivosNube();
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
    sincronizarDispositivosNube();
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
    sincronizarDispositivosNube();
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
          <div className="w-16 h-16 rounded-2xl bg-[#1E3A5F] text-[#5DADE2] flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] bg-[#F8FAFC] border border-slate-200 px-3 py-1 rounded-full">
              Acceso Exclusivo Dirección
            </span>
            <h2 className="text-xl font-extrabold text-[#1E3A5F] mt-2.5">
              Panel de Administrador
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consulta tus <strong>Gráficas de Ganancia Libre</strong>, el{' '}
              <strong>25% de comisión al vendedor</strong>, tu{' '}
              <strong>Apartado de Inversión</strong> y la línea de tiempo de entregas.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3 pt-1">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={8}
              value={pinInput}
              onChange={handlePinInputChange}
              placeholder="Ingresa tu PIN (2026)"
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-[#F8FAFC] text-center font-extrabold tracking-[0.3em] text-lg text-[#1E3A5F] focus:bg-white focus:outline-none focus:border-[#1A5276]"
            />

            {errorPin && (
              <p className="text-xs text-[#65174E] font-semibold">{errorPin}</p>
            )}

            <button
              type="submit"
              onClick={handleUnlock}
              className="w-full py-3.5 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4 text-[#5DADE2]" />
              <span>Desbloquear Panel de Administrador</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== CÁLCULOS FINANCIEROS, COMISIONES (25%), INVERSIÓN Y LO QUE TE QUEDA ====================
  const PORCENTAJE_VENDEDOR = 0.25; // 25% para el vendedor
  const PORCENTAJE_RCM = 0.75; // 75% bruto para RCM CodeDev

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

  const sumaComisionTotal25 = contratosFinanzas.reduce((acc, c) => acc + c.comisionTotal25, 0);
  const sumaComisionSobreCobrado25 = contratosFinanzas.reduce(
    (acc, c) => acc + c.comisionSobreCobrado25,
    0
  );
  const sumaComisionesYaPagadas = contratosFinanzas
    .filter((c) => c.comisionPagada)
    .reduce((acc, c) => acc + c.comisionTotal25, 0);

  const sumaGananciaBrutaRCM75 = contratosFinanzas.reduce(
    (acc, c) => acc + c.gananciaTotalRCM75,
    0
  );
  const sumaGananciaCobradaRCM75 = contratosFinanzas.reduce(
    (acc, c) => acc + c.gananciaCobradaRCM75,
    0
  );

  // Inversión y Costos Operativos registrados por el Admin
  const partidasInversion = datosInversion.partidas || [];
  const totalGastosInversion = partidasInversion.reduce(
    (acc, p) => acc + (Number(p.monto) || 0),
    0
  );
  const pctReinversion = Number(datosInversion.porcentajeReinversion) || 0;

  // Fondo sugerido de reinversión (calculado sobre tu 75% bruto)
  const fondoReinversionTotal =
    Math.round(sumaGananciaBrutaRCM75 * (pctReinversion / 100) * 100) / 100;
  const fondoReinversionCobrado =
    Math.round(sumaGananciaCobradaRCM75 * (pctReinversion / 100) * 100) / 100;

  // LO QUE REALMENTE TE QUEDA LIBRE
  const utilidadLibreTotal = Math.max(
    0,
    Math.round(
      (sumaGananciaBrutaRCM75 - totalGastosInversion - fondoReinversionTotal) * 100
    ) / 100
  );
  const utilidadLibreEnCajaHoy = Math.max(
    0,
    Math.round(
      (sumaGananciaCobradaRCM75 - totalGastosInversion - fondoReinversionCobrado) * 100
    ) / 100
  );

  // Datos para el Gráfico de Anillo usando EXCLUSIVAMENTE la paleta oficial de RCM CodeDev:
  // #1E3A5F (Azul profundo oscuro) | #5DADE2 (Cian) | #1A5276 (Azul profundo medio) | #65174E (Vino)
  const baseGrafica = modoGrafica === 'total' ? sumaVentasTotales : sumaTotalCobrado;
  const valorUtilidadGrafica =
    modoGrafica === 'total' ? utilidadLibreTotal : utilidadLibreEnCajaHoy;
  const valorReinversionGrafica =
    modoGrafica === 'total' ? fondoReinversionTotal : fondoReinversionCobrado;
  const valorGastosGrafica = totalGastosInversion;
  const valorComisionGrafica =
    modoGrafica === 'total' ? sumaComisionTotal25 : sumaComisionSobreCobrado25;

  const sumaSegmentos = Math.max(
    1,
    valorUtilidadGrafica +
      valorReinversionGrafica +
      valorGastosGrafica +
      valorComisionGrafica
  );

  const segmentosDonut = [
    {
      id: 'utilidad',
      label: 'Te queda libre (Bolsillo Neto)',
      valor: valorUtilidadGrafica,
      pct: Math.round((valorUtilidadGrafica / sumaSegmentos) * 100),
      color: '#1E3A5F' // Azul profundo principal RCM
    },
    {
      id: 'reinversion',
      label: `Fondo de Reinversión (${pctReinversion}%)`,
      valor: valorReinversionGrafica,
      pct: Math.round((valorReinversionGrafica / sumaSegmentos) * 100),
      color: '#5DADE2' // Cian RCM
    },
    {
      id: 'gastos',
      label: 'Inversión / Gastos Operativos',
      valor: valorGastosGrafica,
      pct: Math.round((valorGastosGrafica / sumaSegmentos) * 100),
      color: '#1A5276' // Azul institucional RCM
    },
    {
      id: 'comision',
      label: 'Comisión Vendedor (25%)',
      valor: valorComisionGrafica,
      pct: Math.round((valorComisionGrafica / sumaSegmentos) * 100),
      color: '#65174E' // Vino / Borgoña RCM
    }
  ];

  const RADIO_DONUT = 40;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO_DONUT;
  let acumuladoOffset = 0;
  const arcosSVG = segmentosDonut.map((seg) => {
    const proporcion = baseGrafica > 0 ? seg.valor / sumaSegmentos : 0.25;
    const longitudArco = proporcion * CIRCUNFERENCIA;
    const dashArray = `${longitudArco} ${CIRCUNFERENCIA - longitudArco}`;
    const dashOffset = -acumuladoOffset;
    acumuladoOffset += longitudArco;
    return {
      ...seg,
      dashArray,
      dashOffset
    };
  });

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

  // Agrupación de Inversión por Categoría
  const gastosPorCategoria = CATEGORIAS_INVERSION.map((cat) => {
    const subtotal = partidasInversion
      .filter((p) => p.categoria === cat)
      .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    return {
      categoria: cat,
      monto: subtotal,
      pct:
        totalGastosInversion > 0
          ? Math.round((subtotal / totalGastosInversion) * 100)
          : 0
    };
  });

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
      {/* Cabecera Ejecutiva con la Paleta Oficial (#1E3A5F / #1A5276 / #5DADE2 / #65174E) */}
      <div className="bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] text-white rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-[#5DADE2] shrink-0">
              {vistaAdmin === 'dashboard' ? (
                <PieChart className="w-6 h-6" />
              ) : vistaAdmin === 'inversion' ? (
                <PiggyBank className="w-6 h-6" />
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
                  ? 'Dashboard Financiero: ¿Cuánto me queda?'
                  : vistaAdmin === 'inversion'
                  ? 'Apartado de Inversión y Costos Operativos'
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
              className="px-3.5 py-2 rounded-xl bg-[#65174E] hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-white" />
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

        {/* Selector Principal de 3 Pestañas */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-black/20 p-1.5 rounded-2xl text-xs max-w-2xl">
          <button
            type="button"
            onClick={() => setVistaAdmin('dashboard')}
            className={`py-2.5 px-2 sm:px-3 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition ${
              vistaAdmin === 'dashboard'
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Ventas y Gráfica</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaAdmin('inversion')}
            className={`py-2.5 px-2 sm:px-3 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition ${
              vistaAdmin === 'inversion'
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <PiggyBank className="w-4 h-4 shrink-0" />
            <span className="truncate">Mi Inversión</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaAdmin('timeline')}
            className={`py-2.5 px-2 sm:px-3 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition ${
              vistaAdmin === 'timeline'
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Entregas ({contratos.length})</span>
          </button>
        </div>
      </div>

      {/* ==================== VISTA 1: DASHBOARD Y GRÁFICA VISUAL ("¿CUÁNTO ME QUEDA?") ==================== */}
      {vistaAdmin === 'dashboard' && (
        <div className="space-y-6">
          {/* Fila de 4 Tarjetas KPI con los colores oficiales de RCM CodeDev */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Vendido */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Vendido (100%)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1E3A5F] mt-1">
                  {formatearMonedaMXN(sumaVentasTotales)}
                </p>
                <span className="text-[11px] text-[#1A5276] font-semibold mt-1 block">
                  Cobrado: {formatearMonedaMXN(sumaTotalCobrado)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-[#1A5276] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2: Comisión Vendedor (25%) */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] block">
                  Vendedor (25% Comisión)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-[#65174E] mt-1">
                  {formatearMonedaMXN(sumaComisionTotal25)}
                </p>
                <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                  Sobre cobrado: {formatearMonedaMXN(sumaComisionSobreCobrado25)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-[#65174E] flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Inversión + Reinversión */}
            <div
              onClick={() => setVistaAdmin('inversion')}
              className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 flex items-start justify-between cursor-pointer hover:border-[#5DADE2] transition"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                  Inversión + Fondo ({pctReinversion}%)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-[#1A5276] mt-1">
                  {formatearMonedaMXN(totalGastosInversion + fondoReinversionTotal)}
                </p>
                <span className="text-[11px] text-[#5DADE2] font-bold mt-1 flex items-center gap-1">
                  <span>Gastos: {formatearMonedaMXN(totalGastosInversion)}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-[#1A5276] flex items-center justify-center shrink-0">
                <PiggyBank className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4: LO QUE TE QUEDA LIBRE (Azul Profundo Institucional #1E3A5F + Cian #5DADE2) */}
            <div className="bg-[#1E3A5F] text-white rounded-3xl shadow-md p-5 flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                  Te Queda Libre (Neto)
                </span>
                <p className="text-xl sm:text-2xl font-extrabold mt-1">
                  {formatearMonedaMXN(utilidadLibreTotal)}
                </p>
                <span className="text-[11px] text-[#5DADE2] font-semibold mt-1 block">
                  En caja hoy: {formatearMonedaMXN(utilidadLibreEnCajaHoy)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#5DADE2] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* SECCIÓN CENTRAL: GRÁFICA VISUAL DE ANILLO (DONUT) + BARRAS POR PROYECTO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Gráfica de Anillo: "¿Cómo se reparte el dinero y cuánto me queda?" */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                    Distribución Financiera Real
                  </span>
                  <h3 className="text-base font-extrabold text-[#1E3A5F]">
                    ¿Cuánto me queda de las ventas?
                  </h3>
                </div>

                {/* Switch: Proyectado Total vs Cobrado en Caja */}
                <div className="inline-flex bg-[#F8FAFC] border border-slate-200 p-1 rounded-xl text-[11px] font-bold self-start">
                  <button
                    type="button"
                    onClick={() => setModoGrafica('total')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      modoGrafica === 'total'
                        ? 'bg-[#1E3A5F] text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Total Vendido
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoGrafica('cobrado')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      modoGrafica === 'cobrado'
                        ? 'bg-[#1A5276] text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Ya Cobrado
                  </button>
                </div>
              </div>

              {/* Contenedor del Donut Chart SVG + Leyenda Interactiva */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-1">
                {/* Anillo SVG con colores RCM CodeDev */}
                <div className="sm:col-span-5 flex justify-center">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full -rotate-90 transform overflow-visible"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r={RADIO_DONUT}
                        fill="transparent"
                        stroke="#F8FAFC"
                        strokeWidth="12"
                      />
                      {arcosSVG.map((arco) => (
                        <circle
                          key={arco.id}
                          cx="50"
                          cy="50"
                          r={RADIO_DONUT}
                          fill="transparent"
                          stroke={arco.color}
                          strokeWidth="12"
                          strokeDasharray={arco.dashArray}
                          strokeDashoffset={arco.dashOffset}
                          strokeLinecap="butt"
                          className="transition-all duration-500"
                        />
                      ))}
                    </svg>

                    {/* Texto Central del Anillo */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Te Queda Libre
                      </span>
                      <span className="text-sm font-extrabold text-[#1E3A5F] mt-0.5">
                        {formatearMonedaMXN(valorUtilidadGrafica)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#1A5276]">
                        {segmentosDonut[0].pct}% del ingreso
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leyenda detallada con los 4 tonos RCM */}
                <div className="sm:col-span-7 space-y-2.5">
                  {segmentosDonut.map((seg) => (
                    <div
                      key={seg.id}
                      className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#1E3A5F] block truncate">
                            {seg.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {seg.pct}% del total
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#1E3A5F] shrink-0">
                        {formatearMonedaMXN(seg.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  ¿Quieres registrar gastos de servidor, anuncios o ajustar tu reinversión?
                </span>
                <button
                  type="button"
                  onClick={() => setVistaAdmin('inversion')}
                  className="font-extrabold text-[#1A5276] hover:underline shrink-0 ml-2"
                >
                  Ir a Mi Inversión →
                </button>
              </div>
            </div>

            {/* Gráfica de Barras Comparativa por Proyecto (75% RCM vs 25% Vendedor) */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                    Comparativa Visual por Cierre
                  </span>
                  <h3 className="text-base font-extrabold text-[#1E3A5F]">
                    Tu Ganancia (75%) vs Vendedor (25%)
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-[#1E3A5F]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1E3A5F]" />
                    75% RCM
                  </span>
                  <span className="flex items-center gap-1 text-[#65174E]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#65174E]" />
                    25% Vend.
                  </span>
                </div>
              </div>

              {contratosFinanzas.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Aún no hay proyectos para graficar.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                  {contratosFinanzas.map((c) => {
                    const maxMonto = Math.max(
                      ...contratosFinanzas.map((item) => item.montoTotal),
                      1
                    );
                    const anchoTotalPct = Math.max(
                      18,
                      Math.round((c.montoTotal / maxMonto) * 100)
                    );
                    const pctCobrado =
                      c.montoTotal > 0
                        ? Math.round((c.totalPagado / c.montoTotal) * 100)
                        : 0;

                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-extrabold text-[#1E3A5F] truncate block">
                              {c.empresa}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Vendedor: {c.vendedorNombre} • Cobrado: {pctCobrado}%
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-extrabold text-[#1E3A5F] block">
                              +{formatearMonedaMXN(c.gananciaTotalRCM75)} libre
                            </span>
                            <span className="text-[10px] text-[#65174E] font-semibold">
                              Comisión 25%: {formatearMonedaMXN(c.comisionTotal25)}
                            </span>
                          </div>
                        </div>

                        {/* Barra proporcional apilada con colores RCM */}
                        <div className="w-full bg-slate-200/70 h-3 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${anchoTotalPct}%` }}
                            className="h-full flex rounded-full overflow-hidden"
                          >
                            <div
                              style={{ width: '75%' }}
                              className="bg-gradient-to-r from-[#1E3A5F] to-[#5DADE2] h-full"
                              title={`Tu 75%: ${formatearMonedaMXN(c.gananciaTotalRCM75)}`}
                            />
                            <div
                              style={{ width: '25%' }}
                              className="bg-[#65174E] h-full"
                              title={`25% Vendedor: ${formatearMonedaMXN(c.comisionTotal25)}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* FILA INFERIOR: RENDIMIENTO POR VENDEDOR + CONTROL DE PAGO DE COMISIONES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Ranking por Vendedor */}
            <div className="lg:col-span-5 bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-[#1E3A5F] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#65174E]" />
                <span>Rendimiento por Vendedor (25%)</span>
              </h3>

              {listaVendedores.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Sin vendedores registrados todavía.
                </p>
              ) : (
                <div className="space-y-3">
                  {listaVendedores.map((vend) => (
                    <div
                      key={vend.nombre}
                      className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-100 space-y-2.5"
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
                          <strong className="text-[#1A5276]">
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

            {/* Lista de Cierres para Marcar Comisión Pagada */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Control de Pago de Comisiones ({contratosFinanzas.length})
                </h3>
                {sumaComisionesYaPagadas > 0 && (
                  <span className="text-xs font-bold text-[#1E3A5F] bg-[#F8FAFC] border border-slate-200 px-3 py-1 rounded-full">
                    Comisiones pagadas: {formatearMonedaMXN(sumaComisionesYaPagadas)}
                  </span>
                )}
              </div>

              {contratosFinanzas.map((c) => (
                <article
                  key={c.id}
                  className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-3.5"
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
                    <div className="flex items-center gap-2 bg-[#F8FAFC] p-2.5 rounded-2xl border border-slate-200">
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
                    <div className="flex items-center justify-between text-xs bg-[#F8FAFC] px-3.5 py-2.5 rounded-2xl">
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
                        <span>Cambiar</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2.5 text-center text-[11px]">
                    <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">
                        Cobrado Cliente
                      </span>
                      <strong className="text-[#1A5276] text-xs sm:text-sm">
                        {formatearMonedaMXN(c.totalPagado)}
                      </strong>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200">
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

                    <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200">
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

                  <button
                    type="button"
                    onClick={() => handleToggleComisionPagada(c)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      c.comisionPagada
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-[#65174E] text-white shadow-2xs hover:opacity-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#5DADE2]" />
                    <span>
                      {c.comisionPagada
                        ? '✓ Comisión 25% Liquidada al Vendedor'
                        : `Marcar 25% Pagado (${formatearMonedaMXN(
                            c.comisionSobreCobrado25
                          )} sobre lo cobrado)`}
                    </span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VISTA 2: APARTADO DE INVERSIÓN Y REINVERSIONES ==================== */}
      {vistaAdmin === 'inversion' && (
        <div className="space-y-6">
          {/* Resumen Superior de Inversión vs Utilidad Libre con Colores RCM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Tu 75% Bruto (Tras Vendedor)
              </span>
              <p className="text-2xl font-extrabold text-[#1E3A5F] mt-1">
                {formatearMonedaMXN(sumaGananciaBrutaRCM75)}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                En caja hoy: {formatearMonedaMXN(sumaGananciaCobradaRCM75)}
              </span>
            </div>

            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] block">
                Total Gastos + Fondo Reinversión
              </span>
              <p className="text-2xl font-extrabold text-[#65174E] mt-1">
                {formatearMonedaMXN(totalGastosInversion + fondoReinversionTotal)}
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                Gastos: {formatearMonedaMXN(totalGastosInversion)} • Fondo ({pctReinversion}%):{' '}
                {formatearMonedaMXN(fondoReinversionTotal)}
              </span>
            </div>

            <div className="bg-[#1E3A5F] text-white rounded-3xl shadow-md p-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                Lo Que Te Queda Libre
              </span>
              <p className="text-2xl font-extrabold mt-1">
                {formatearMonedaMXN(utilidadLibreTotal)}
              </p>
              <span className="text-xs text-[#5DADE2] font-semibold mt-1 block">
                Disponible en caja hoy: {formatearMonedaMXN(utilidadLibreEnCajaHoy)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Simulador de Fondo de Reinversión + Registrar Nueva Inversión */}
            <div className="lg:col-span-6 space-y-5">
              {/* Control Deslizante de Fondo de Reinversión */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                      Crecimiento de Agencia
                    </span>
                    <h3 className="text-base font-extrabold text-[#1E3A5F]">
                      Fondo de Reinversión Automático
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#1E3A5F] text-[#5DADE2] text-xs font-extrabold">
                    {pctReinversion}%
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Elige qué porcentaje de tu ganancia quieres apartar para reinvertir en publicidad, servidores o crecimiento de RCM CodeDev:
                </p>

                <input
                  type="range"
                  min="0"
                  max="40"
                  step="5"
                  value={pctReinversion}
                  onChange={(e) => handleCambiarPorcentajeReinversion(e.target.value)}
                  className="w-full accent-[#1E3A5F] cursor-pointer"
                />

                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>0%</span>
                  <span>10%</span>
                  <span>20%</span>
                  <span>30%</span>
                  <span>40%</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-[#1A5276] block">
                      Apartado Reinversión ({pctReinversion}%)
                    </span>
                    <strong className="text-sm font-extrabold text-[#1E3A5F]">
                      {formatearMonedaMXN(fondoReinversionTotal)}
                    </strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-[#65174E] block">
                      De lo ya cobrado hoy
                    </span>
                    <strong className="text-sm font-extrabold text-[#65174E]">
                      {formatearMonedaMXN(fondoReinversionCobrado)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Formulario para Registrar Gastos / Inversión Operativa */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] block">
                    Control de Costos y Capital
                  </span>
                  <h3 className="text-base font-extrabold text-[#1E3A5F]">
                    Registrar Inversión o Gasto Operativo
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#65174E]" />
                    Agregar gasto frecuente en 1 toque:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PLANTILLAS_INVERSION_RAPIDA.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAgregarPlantillaInversion(item)}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#F8FAFC] hover:bg-[#1E3A5F] text-slate-700 hover:text-white border border-slate-200 transition"
                      >
                        + {item.concepto} (${item.monto})
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={handleAgregarInversionForm}
                  className="space-y-3 pt-2 border-t border-slate-100 text-xs"
                >
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Concepto de la inversión o gasto *
                    </label>
                    <input
                      type="text"
                      required
                      value={formInversion.concepto}
                      onChange={(e) =>
                        setFormInversion((p) => ({ ...p, concepto: e.target.value }))
                      }
                      placeholder="Ej. Compra de dominio .com, API OpenAI, Meta Ads..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white font-medium focus:outline-none focus:border-[#1A5276]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Monto invertido (MXN) *
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        required
                        value={formInversion.monto}
                        onChange={(e) =>
                          setFormInversion((p) => ({ ...p, monto: e.target.value }))
                        }
                        placeholder="Ej. 850"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white font-bold text-[#1E3A5F] focus:outline-none focus:border-[#1A5276]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Categoría
                      </label>
                      <select
                        value={formInversion.categoria}
                        onChange={(e) =>
                          setFormInversion((p) => ({ ...p, categoria: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white font-medium text-slate-800 focus:outline-none focus:border-[#1A5276]"
                      >
                        {CATEGORIAS_INVERSION.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Asignar a proyecto (opcional)
                    </label>
                    <select
                      value={formInversion.proyectoEmpresa}
                      onChange={(e) =>
                        setFormInversion((p) => ({
                          ...p,
                          proyectoEmpresa: e.target.value
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white font-medium text-slate-800 focus:outline-none focus:border-[#1A5276]"
                    >
                      <option value="General RCM CodeDev">
                        General RCM CodeDev (Agencia)
                      </option>
                      {contratos.map((c) => (
                        <option key={c.id} value={c.empresa}>
                          Proyecto: {c.empresa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4 text-[#5DADE2]" />
                    <span>Registrar Partida de Inversión</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Columna Derecha: Gráfica de Gastos por Categoría + Historial de Partidas */}
            <div className="lg:col-span-6 space-y-5">
              {/* Desglose por Categoría de Inversión con Colores RCM */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-4">
                <h3 className="text-base font-extrabold text-[#1E3A5F]">
                  Distribución de tu Inversión por Categoría
                </h3>

                <div className="space-y-3">
                  {gastosPorCategoria.map((item) => (
                    <div key={item.categoria} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 truncate">
                          {item.categoria}
                        </span>
                        <span className="font-extrabold text-[#1E3A5F]">
                          {formatearMonedaMXN(item.monto)} ({item.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.max(item.monto > 0 ? 6 : 0, item.pct)}%`
                          }}
                          className="h-full bg-gradient-to-r from-[#1E3A5F] via-[#1A5276] to-[#65174E] rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de Partidas de Inversión Registradas */}
              <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-[#1E3A5F]">
                    Historial de Inversión ({partidasInversion.length})
                  </h3>
                  <span className="text-xs font-extrabold text-[#65174E]">
                    Total: {formatearMonedaMXN(totalGastosInversion)}
                  </span>
                </div>

                {partidasInversion.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No has registrado gastos operativos aún. Usa los botones rápidos o el formulario para anotar tus inversiones.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {partidasInversion.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-[#1E3A5F] truncate">
                            {p.concepto}
                          </p>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {p.categoria} • {p.proyectoEmpresa}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatearFechaCorta(p.fecha)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold text-[#65174E]">
                            -{formatearMonedaMXN(p.monto)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEliminarInversion(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#65174E] hover:bg-slate-200/60 transition"
                            title="Eliminar partida"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VISTA 3: LÍNEA DE TIEMPO DE ENTREGAS ==================== */}
      {vistaAdmin === 'timeline' && (
        <div className="space-y-5">
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
                  clase: 'bg-[#F8FAFC] border border-slate-200 text-[#1A5276]'
                };
                if (completado) {
                  badgeUrgencia = {
                    texto: 'Entregado en Producción',
                    clase: 'bg-[#1E3A5F] text-white'
                  };
                } else if (diasParaEntregaFinal <= 2) {
                  badgeUrgencia = {
                    texto:
                      diasParaEntregaFinal < 0
                        ? `Vencido hace ${Math.abs(diasParaEntregaFinal)}d`
                        : diasParaEntregaFinal === 0
                        ? 'Se entrega HOY'
                        : `Urgente (${diasParaEntregaFinal}d)`,
                    clase: 'bg-[#65174E] text-white'
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
                                    ? 'bg-[#1A5276]'
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
                                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-[#5DADE2]'
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
                                      ? 'text-[#1A5276] line-through decoration-[#5DADE2]'
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
                                    ? 'bg-[#1E3A5F] text-white'
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
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">
                          Fin Garantía (30 días)
                        </span>
                        <strong className="text-[#1E3A5F]">
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
                            estaLiquidado ? 'text-[#1A5276]' : 'text-[#65174E]'
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
                      <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#5DADE2]/50 space-y-2.5 text-xs">
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-[#1E3A5F] font-bold text-xs transition"
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#1A5276]" />
                          <span>Pegar Ligas QA / Staging / Prod</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => descargarContratoPDF(contrato)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-xs transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#5DADE2]" />
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
