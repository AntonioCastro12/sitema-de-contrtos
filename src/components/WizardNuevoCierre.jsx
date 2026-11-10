import React, { useState, useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import {
  Building2,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  CalendarClock,
  ShieldCheck,
  PenTool,
  Eraser,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileDown,
  Plus,
  Trash2,
  Tag,
  RotateCcw
} from 'lucide-react';
import { guardarContratoLocal } from '../db/database';
import { descargarContratoPDF, formatearMonedaMXN } from '../services/pdfGenerator';
import {
  obtenerClausulasIniciales,
  CLAUSULAS_PROMOCIONALES_SUGERIDAS,
  METODOS_PAGO_RCM
} from '../services/clausulasCatalogo';

export const CATALOGO_SERVICIOS_RCM = [
  {
    id: 'bot-whatsapp-ia',
    nombre: 'Bot de WhatsApp con IA (Atención y pedidos)',
    plazoSugerido: 7,
    inversionSugerida: 6500,
    tag: 'Automatización IA'
  },
  {
    id: 'landing-page-express',
    nombre: 'Página Web / Landing Page Express (5-7 días hábiles)',
    plazoSugerido: 6,
    inversionSugerida: 4800,
    tag: 'Entrega Rápida'
  },
  {
    id: 'menu-catalogo-qr',
    nombre: 'Menú Interactivo / Catálogo Digital QR',
    plazoSugerido: 5,
    inversionSugerida: 3500,
    tag: 'Comercio / Gastro'
  },
  {
    id: 'tarjeta-digital',
    nombre: 'Tarjeta de Presentación Digital Interactiva',
    plazoSugerido: 3,
    inversionSugerida: 1800,
    tag: 'Networking'
  },
  {
    id: 'software-medida',
    nombre: 'Software / Sistema Web a la Medida',
    plazoSugerido: 20,
    inversionSugerida: 18500,
    tag: 'Arquitectura Custom'
  }
];

export default function WizardNuevoCierre({ onCierreGuardado }) {
  const [pasoActual, setPasoActual] = useState(1);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [clausulasExpandidas, setClausulasExpandidas] = useState(false);
  const [clausulaDetalleId, setClausulaDetalleId] = useState(null);
  const [nuevaClausulaTitulo, setNuevaClausulaTitulo] = useState('');
  const [nuevaClausulaTexto, setNuevaClausulaTexto] = useState('');
  const [mostrarFormClausula, setMostrarFormClausula] = useState(false);

  const [formData, setFormData] = useState({
    empresa: '',
    representante: '',
    vendedor:
      (typeof window !== 'undefined' && localStorage.getItem('rcm_vendedor_actual')) ||
      '',
    telefono: '',
    correo: '',
    domicilio: '',

    servicio: CATALOGO_SERVICIOS_RCM[0].nombre,
    entregables: {
      hostingDominioPropio: false,
      metaBusinessVerificado: false,
      incluyeCapacitacion: true,
      incluyeSoporte30Dias: true
    },
    requerimientos: '',

    montoTotal: '6500',
    anticipo: '3250',
    anticipoEditadoManualmente: false,
    metodoPagoAnticipo: 'Tarjeta de Crédito',
    referenciaAnticipo: '',
    plazoDias: '7',
    clausulas: obtenerClausulasIniciales(),

    firmaBase64: ''
  });

  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);
  const [tieneFirma, setTieneFirma] = useState(false);

  useEffect(() => {
    if (pasoActual !== 4 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (signaturePadRef.current) {
        signaturePadRef.current.clear();
        if (formData.firmaBase64) {
          signaturePadRef.current.fromDataURL(formData.firmaBase64, {
            ratio,
            width: rect.width,
            height: rect.height
          });
          setTieneFirma(true);
        } else {
          setTieneFirma(false);
        }
      }
    };

    const pad = new SignaturePad(canvas, {
      minWidth: 1.4,
      maxWidth: 3.2,
      penColor: '#1E3A5F',
      backgroundColor: 'rgb(255, 255, 255)',
      throttle: 8
    });

    const handleEndStroke = () => {
      if (!pad.isEmpty()) {
        setTieneFirma(true);
        const dataUrl = pad.toDataURL('image/png');
        setFormData((prev) => ({ ...prev, firmaBase64: dataUrl }));
        setErrores((prev) => ({ ...prev, firma: null }));
      }
    };

    pad.addEventListener('endStroke', handleEndStroke);
    signaturePadRef.current = pad;
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      pad.removeEventListener('endStroke', handleEndStroke);
      pad.off();
    };
  }, [pasoActual]);

  const limpiarFirma = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
    setTieneFirma(false);
    setFormData((prev) => ({ ...prev, firmaBase64: '' }));
  };

  const handleChangeCampo = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
    if (errores[campo]) {
      setErrores((prev) => ({ ...prev, [campo]: null }));
    }
  };

  const handleTelefonoChange = (e) => {
    const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 10);
    handleChangeCampo('telefono', soloDigitos);
  };

  const handleSeleccionarServicio = (servicioNombre) => {
    const encontrado = CATALOGO_SERVICIOS_RCM.find((s) => s.nombre === servicioNombre);
    setFormData((prev) => {
      const nuevoTotal = encontrado ? String(encontrado.inversionSugerida) : prev.montoTotal;
      const nuevoAnticipo = String(Math.round((Number(nuevoTotal) || 0) * 0.5));
      return {
        ...prev,
        servicio: servicioNombre,
        plazoDias: encontrado ? String(encontrado.plazoSugerido) : prev.plazoDias,
        montoTotal: nuevoTotal,
        anticipo: prev.anticipoEditadoManualmente ? prev.anticipo : nuevoAnticipo
      };
    });
  };

  const handleToggleEntregable = (clave) => {
    setFormData((prev) => ({
      ...prev,
      entregables: {
        ...prev.entregables,
        [clave]: !prev.entregables[clave]
      }
    }));
  };

  const handleToggleClausulaActiva = (id) => {
    setFormData((prev) => ({
      ...prev,
      clausulas: prev.clausulas.map((c) =>
        c.id === id ? { ...c, activa: !c.activa } : c
      )
    }));
  };

  const handleEliminarClausula = (id) => {
    setFormData((prev) => ({
      ...prev,
      clausulas: prev.clausulas.filter((c) => c.id !== id)
    }));
  };

  const handleRestaurarClausulasBase = () => {
    setFormData((prev) => ({
      ...prev,
      clausulas: obtenerClausulasIniciales()
    }));
  };

  const handleAgregarPromoSugerida = (promo) => {
    setFormData((prev) => {
      const yaExiste = prev.clausulas.some((c) => c.id === promo.id);
      if (yaExiste) {
        return {
          ...prev,
          clausulas: prev.clausulas.map((c) =>
            c.id === promo.id ? { ...c, activa: true } : c
          )
        };
      }
      return {
        ...prev,
        clausulas: [
          ...prev.clausulas,
          {
            id: promo.id,
            titulo: promo.titulo,
            texto: promo.texto,
            categoria: 'Promoción',
            activa: true
          }
        ]
      };
    });
  };

  const handleAgregarClausulaPersonalizada = () => {
    if (!nuevaClausulaTexto.trim()) return;
    const tituloFinal = nuevaClausulaTitulo.trim() || 'Promoción / Acuerdo Especial';
    const nueva = {
      id: `custom-${Date.now()}`,
      titulo: tituloFinal,
      texto: nuevaClausulaTexto.trim(),
      categoria: 'Promoción',
      activa: true
    };
    setFormData((prev) => ({
      ...prev,
      clausulas: [...prev.clausulas, nueva]
    }));
    setNuevaClausulaTitulo('');
    setNuevaClausulaTexto('');
    setMostrarFormClausula(false);
  };

  const handleMontoTotalChange = (valorStr) => {
    const limpio = valorStr.replace(/[^0-9.]/g, '');
    const numeroTotal = parseFloat(limpio) || 0;
    const anticipoCalculado = Math.round(numeroTotal * 0.5 * 100) / 100;

    setFormData((prev) => ({
      ...prev,
      montoTotal: limpio,
      anticipo: prev.anticipoEditadoManualmente ? prev.anticipo : String(anticipoCalculado)
    }));
    if (errores.montoTotal) {
      setErrores((prev) => ({ ...prev, montoTotal: null }));
    }
  };

  const handleAnticipoChange = (valorStr) => {
    const limpio = valorStr.replace(/[^0-9.]/g, '');
    setFormData((prev) => ({
      ...prev,
      anticipo: limpio,
      anticipoEditadoManualmente: true
    }));
    if (errores.anticipo) {
      setErrores((prev) => ({ ...prev, anticipo: null }));
    }
  };

  const aplicar50PorcientoSugerido = () => {
    const total = parseFloat(formData.montoTotal) || 0;
    const mitad = Math.round(total * 0.5 * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      anticipo: String(mitad),
      anticipoEditadoManualmente: false
    }));
  };

  const montoTotalNum = parseFloat(formData.montoTotal) || 0;
  const anticipoNum = parseFloat(formData.anticipo) || 0;
  const saldoContraEntrega = Math.max(0, montoTotalNum - anticipoNum);
  const clausulasActivasList = formData.clausulas.filter((c) => c.activa !== false);
  const promosActivasList = clausulasActivasList.filter((c) => c.categoria === 'Promoción');

  const validarPaso = (paso) => {
    const nuevosErrores = {};

    if (paso === 1) {
      if (!formData.empresa.trim()) {
        nuevosErrores.empresa = 'El nombre de la empresa es obligatorio.';
      }
      if (!formData.representante.trim()) {
        nuevosErrores.representante = 'El nombre del representante es obligatorio.';
      }
      if (!/^\d{10}$/.test(formData.telefono.trim())) {
        nuevosErrores.telefono = 'Ingresa los 10 dígitos de WhatsApp.';
      }
      if (
        formData.correo.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())
      ) {
        nuevosErrores.correo = 'El correo electrónico no tiene un formato válido.';
      }
    }

    if (paso === 2) {
      if (!formData.servicio) {
        nuevosErrores.servicio = 'Selecciona un servicio.';
      }
      if (!formData.requerimientos.trim() || formData.requerimientos.trim().length < 8) {
        nuevosErrores.requerimientos =
          'Anota un breve resumen de lo que necesita el cliente.';
      }
    }

    if (paso === 3) {
      if (montoTotalNum <= 0) {
        nuevosErrores.montoTotal = 'La inversión total debe ser mayor a $0.';
      }
      if (anticipoNum < 0 || anticipoNum > montoTotalNum) {
        nuevosErrores.anticipo = 'El anticipo no puede superar el total.';
      }
      if (!formData.plazoDias || Number(formData.plazoDias) <= 0) {
        nuevosErrores.plazoDias = 'Indica los días hábiles.';
      }
      if (clausulasActivasList.length === 0) {
        nuevosErrores.clausulas = 'Activa al menos una cláusula del contrato.';
      }
    }

    if (paso === 4) {
      const padVacio = signaturePadRef.current ? signaturePadRef.current.isEmpty() : !tieneFirma;
      if (padVacio && !formData.firmaBase64) {
        nuevosErrores.firma = 'Pide al cliente que firme en el recuadro blanco.';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const avanzarPaso = () => {
    if (validarPaso(pasoActual)) {
      setPasoActual((p) => Math.min(4, p + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const retrocederPaso = () => {
    setPasoActual((p) => Math.max(1, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerarYGuardarContrato = async () => {
    if (!validarPaso(4)) return;

    try {
      setGuardando(true);
      const firmaFinal =
        signaturePadRef.current && !signaturePadRef.current.isEmpty()
          ? signaturePadRef.current.toDataURL('image/png')
          : formData.firmaBase64;

      const contratoGuardado = await guardarContratoLocal({
        ...formData,
        montoTotal: montoTotalNum,
        anticipo: anticipoNum,
        saldo: saldoContraEntrega,
        plazoDias: Number(formData.plazoDias) || 7,
        clausulas: clausulasActivasList,
        firmaBase64: firmaFinal
      });

      const nombreArchivoPDF = await descargarContratoPDF(contratoGuardado);

      if (onCierreGuardado) {
        onCierreGuardado(contratoGuardado, nombreArchivoPDF);
      }
    } catch (error) {
      console.error('Error al guardar o generar el contrato:', error);
      setErrores({
        general: 'Ocurrió un problema al generar el contrato. Intenta nuevamente.'
      });
    } finally {
      setGuardando(false);
    }
  };

  const cargarDatosEjemploRapido = () => {
    setFormData((prev) => ({
      ...prev,
      empresa: 'Grupo Gastronómico La Parroquia S.A.',
      representante: 'Lic. Roberto Méndez Garza',
      telefono: '5541238900',
      correo: 'rmendez@laparroquiagrupo.mx',
      domicilio: 'Av. Insurgentes Sur 1450, CDMX',
      servicio: 'Bot de WhatsApp con IA (Atención y pedidos)',
      entregables: {
        hostingDominioPropio: true,
        metaBusinessVerificado: true,
        incluyeCapacitacion: true,
        incluyeSoporte30Dias: true
      },
      requerimientos:
        'Automatización de toma de pedidos a domicilio por WhatsApp con IA conversacional, validación de cobertura por código postal y catálogo conectado a sucursal.',
      montoTotal: '12500',
      anticipo: '6250',
      anticipoEditadoManualmente: false,
      metodoPagoAnticipo: 'Tarjeta de Crédito',
      referenciaAnticipo: 'Aut. 48192',
      plazoDias: '10',
      clausulas: obtenerClausulasIniciales(),
      firmaBase64: ''
    }));
    setErrores({});
  };

  const PASOS_INFO = [
    { num: 1, titulo: 'Datos del Cliente', corto: 'Cliente' },
    { num: 2, titulo: 'Servicio y Alcance', corto: 'Alcance' },
    { num: 3, titulo: 'Inversión y Cláusulas', corto: 'Inversión' },
    { num: 4, titulo: 'Confirmación y Firma', corto: 'Firma' }
  ];

  return (
    <div className="pb-28 md:pb-16">
      {/* Barra de Progreso Responsiva (Compacta en Celular / Completa en Laptop) */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 sticky top-16 z-20 shadow-2xs">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#1E3A5F] text-white text-xs font-extrabold flex items-center justify-center shadow-xs">
                {pasoActual}
              </span>
              <div>
                <span className="text-sm sm:text-base font-extrabold text-[#1E3A5F] block leading-tight">
                  {PASOS_INFO[pasoActual - 1].titulo}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Paso {pasoActual} de 4 • Generador de Contratos RCM CodeDev
                </span>
              </div>
            </div>

            {pasoActual === 1 && (
              <button
                type="button"
                onClick={cargarDatosEjemploRapido}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A5276] bg-sky-50 hover:bg-sky-100 border border-sky-200/60 px-3 py-1.5 rounded-full transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#65174E]" />
                <span>Autollenar demo</span>
              </button>
            )}
          </div>

          {/* Stepper adaptable */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {PASOS_INFO.map((p) => {
              const completado = pasoActual > p.num;
              const activo = pasoActual === p.num;
              return (
                <button
                  key={p.num}
                  type="button"
                  onClick={() => {
                    if (p.num < pasoActual) setPasoActual(p.num);
                  }}
                  disabled={p.num > pasoActual}
                  className="text-left focus:outline-none group"
                >
                  <div className="hidden sm:flex items-center gap-1.5 mb-1.5">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition ${
                        completado
                          ? 'bg-emerald-500 text-white'
                          : activo
                          ? 'bg-[#1E3A5F] text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {completado ? '✓' : p.num}
                    </span>
                    <span
                      className={`text-xs font-bold truncate ${
                        activo
                          ? 'text-[#1E3A5F]'
                          : completado
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {p.titulo}
                    </span>
                  </div>
                  <div
                    className={`h-2 rounded-full transition-all ${
                      completado
                        ? 'bg-emerald-500'
                        : activo
                        ? 'bg-gradient-to-r from-[#1E3A5F] to-[#5DADE2]'
                        : 'bg-slate-200'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenedor Principal Responsivo */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {errores.general && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        {/* ==================== PASO 1: CLIENTE (1 col en móvil / 2 cols en laptop) ==================== */}
        {pasoActual === 1 && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] px-6 py-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5DADE2] block">
                  Paso 1 • Información del Prospecto
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold mt-0.5">
                  ¿Con quién estamos cerrando el proyecto hoy?
                </h2>
              </div>
              <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-white/10 items-center justify-center text-[#5DADE2]">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Empresa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nombre comercial o empresa <span className="text-[#65174E]">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={formData.empresa}
                      onChange={(e) => handleChangeCampo('empresa', e.target.value)}
                      placeholder="Ej. Clínica Dental Sonrisa Real"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-slate-900 font-medium focus:outline-none focus:ring-2 transition ${
                        errores.empresa
                          ? 'border-red-300 bg-red-50/40 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#1A5276] focus:ring-[#5DADE2]/30'
                      }`}
                    />
                  </div>
                  {errores.empresa && (
                    <p className="mt-1 text-xs text-red-600">{errores.empresa}</p>
                  )}
                </div>

                {/* Representante */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Representante o tomador de decisión <span className="text-[#65174E]">*</span>
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={formData.representante}
                      onChange={(e) => handleChangeCampo('representante', e.target.value)}
                      placeholder="Ej. Dr. Carlos Eduardo Ramírez"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-slate-900 font-medium focus:outline-none focus:ring-2 transition ${
                        errores.representante
                          ? 'border-red-300 bg-red-50/40 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#1A5276] focus:ring-[#5DADE2]/30'
                      }`}
                    />
                  </div>
                  {errores.representante && (
                    <p className="mt-1 text-xs text-red-600">{errores.representante}</p>
                  )}
                </div>

                {/* Teléfono */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      WhatsApp (10 dígitos) <span className="text-[#65174E]">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-bold ${
                        formData.telefono.length === 10
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {formData.telefono.length}/10
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={formData.telefono}
                      onChange={handleTelefonoChange}
                      placeholder="5512345678"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-slate-900 font-medium tracking-wide focus:outline-none focus:ring-2 transition ${
                        errores.telefono
                          ? 'border-red-300 bg-red-50/40 focus:ring-red-200'
                          : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#1A5276] focus:ring-[#5DADE2]/30'
                      }`}
                    />
                  </div>
                  {errores.telefono && (
                    <p className="mt-1 text-xs text-red-600">{errores.telefono}</p>
                  )}
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Correo electrónico <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={(e) => handleChangeCampo('correo', e.target.value)}
                      placeholder="cliente@empresa.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none focus:border-[#1A5276] transition"
                    />
                  </div>
                  {errores.correo && (
                    <p className="mt-1 text-xs text-red-600">{errores.correo}</p>
                  )}
                </div>

                {/* Ciudad o domicilio */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ciudad o domicilio <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={formData.domicilio}
                      onChange={(e) => handleChangeCampo('domicilio', e.target.value)}
                      placeholder="Ej. Irapuato, Gto. / CDMX"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none focus:border-[#1A5276] transition"
                    />
                  </div>
                </div>

                {/* Vendedor asignado (para el cálculo del 25% de comisión) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Vendedor que realiza el cierre
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-[#65174E] absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={formData.vendedor || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleChangeCampo('vendedor', val);
                        try {
                          localStorage.setItem('rcm_vendedor_actual', val);
                        } catch {
                          // ignore
                        }
                      }}
                      placeholder="Ej. Tu nombre (se guarda automático)"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none focus:border-[#1A5276] transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PASO 2: SERVICIO Y ALCANCE (2 columnas en Laptop) ==================== */}
        {pasoActual === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Selector de Servicio */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#65174E] block">
                  Catálogo RCM CodeDev
                </span>
                <h2 className="text-lg font-extrabold text-[#1E3A5F]">
                  Servicio a Contratar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecciona la solución tecnológica para pre-cargar inversión y tiempo sugerido.
                </p>
              </div>

              <div className="space-y-2.5">
                {CATALOGO_SERVICIOS_RCM.map((item) => {
                  const seleccionado = formData.servicio === item.nombre;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSeleccionarServicio(item.nombre)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        seleccionado
                          ? 'bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] text-white border-[#1E3A5F] shadow-md'
                          : 'bg-slate-50/60 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold leading-snug">
                          {item.nombre}
                        </div>
                        <div
                          className={`text-[11px] mt-1 font-medium ${
                            seleccionado ? 'text-[#5DADE2]' : 'text-slate-500'
                          }`}
                        >
                          {item.tag} • ~{item.plazoSugerido} días hábiles • Sugerido:{' '}
                          {formatearMonedaMXN(item.inversionSugerida)}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                          seleccionado
                            ? 'border-[#5DADE2] bg-[#5DADE2] text-[#1E3A5F]'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {seleccionado && <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Columna Derecha: Entregables y Requerimientos */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                    Alcance Técnico
                  </span>
                  <h3 className="text-lg font-extrabold text-[#1E3A5F]">
                    Insumos y Entregables
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      key: 'hostingDominioPropio',
                      titulo: 'Hosting y Dominio',
                      sub: 'El cliente ya cuenta con él'
                    },
                    {
                      key: 'metaBusinessVerificado',
                      titulo: 'Meta Verificado',
                      sub: 'Business Suite listo'
                    },
                    {
                      key: 'incluyeCapacitacion',
                      titulo: 'Capacitación',
                      sub: 'Incluida al personal'
                    },
                    {
                      key: 'incluyeSoporte30Dias',
                      titulo: 'Garantía 30 Días',
                      sub: 'Soporte post-entrega'
                    }
                  ].map((chk) => {
                    const activo = Boolean(formData.entregables[chk.key]);
                    return (
                      <button
                        key={chk.key}
                        type="button"
                        onClick={() => handleToggleEntregable(chk.key)}
                        className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                          activo
                            ? 'bg-sky-50/90 border-[#5DADE2] text-[#1E3A5F] shadow-2xs'
                            : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <span className="text-xs font-bold">{chk.titulo}</span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              activo
                                ? 'bg-[#1A5276] text-white'
                                : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {activo ? '✓' : ''}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500 leading-tight">
                          {chk.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Notas del requerimiento */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Requerimientos específicos y detalles acordados{' '}
                    <span className="text-[#65174E]">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.requerimientos}
                    onChange={(e) => handleChangeCampo('requerimientos', e.target.value)}
                    placeholder="Anota qué necesita el cliente, funciones clave, integraciones o dolores de su negocio..."
                    className={`w-full p-4 rounded-2xl border text-slate-900 leading-relaxed focus:outline-none focus:ring-2 transition ${
                      errores.requerimientos
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#1A5276]'
                    }`}
                  />
                  {errores.requerimientos && (
                    <p className="mt-1 text-xs text-red-600">{errores.requerimientos}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== PASO 3: CONDICIONES ECONÓMICAS Y CLÁUSULAS (2 columnas en Laptop) ==================== */}
        {pasoActual === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Inversión y Método de Pago */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Condiciones Comerciales
                </span>
                <h2 className="text-lg font-extrabold text-[#1E3A5F]">
                  Inversión y Anticipo
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  El cliente cuenta con hasta 2 meses para liquidar y liberar su código fuente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Inversión Total (MXN)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formData.montoTotal}
                      onChange={(e) => handleMontoTotalChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white font-extrabold text-[#1E3A5F] focus:outline-none focus:border-[#1A5276]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-emerald-800">
                      Anticipo Hoy
                    </label>
                    <button
                      type="button"
                      onClick={aplicar50PorcientoSugerido}
                      className="text-[11px] font-bold text-[#1A5276] hover:underline"
                    >
                      Sugerir 50%
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm font-bold text-emerald-600">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formData.anticipo}
                      onChange={(e) => handleAnticipoChange(e.target.value)}
                      className="w-full pl-8 pr-3 py-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 focus:bg-white font-extrabold text-emerald-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {(errores.montoTotal || errores.anticipo) && (
                <p className="text-xs text-red-600">
                  {errores.montoTotal || errores.anticipo}
                </p>
              )}

              {/* Resumen visual Saldo + Plazo */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">
                    Saldo restante por abonar
                  </span>
                  <span className="text-lg font-extrabold text-[#65174E]">
                    {formatearMonedaMXN(saldoContraEntrega)}
                  </span>
                </div>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                  <CalendarClock className="w-4 h-4 text-[#1A5276]" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Entrega est.</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="180"
                        value={formData.plazoDias}
                        onChange={(e) => handleChangeCampo('plazoDias', e.target.value)}
                        className="w-12 py-0.5 px-1.5 text-center rounded-lg border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                      />
                      <span className="text-xs font-semibold text-slate-700">días</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selector de Método de Pago del Anticipo */}
              <div className="pt-1 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700">
                  ¿Cómo paga el anticipo?{' '}
                  <span className="text-slate-400 font-normal">(Emite Ticket #1)</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {METODOS_PAGO_RCM.map((m) => {
                    const activo = formData.metodoPagoAnticipo === m.label;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleChangeCampo('metodoPagoAnticipo', m.label)}
                        className={`py-2.5 px-3 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition ${
                          activo
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{m.icono}</span>
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={formData.referenciaAnticipo || ''}
                  onChange={(e) => handleChangeCampo('referenciaAnticipo', e.target.value)}
                  placeholder="Referencia opcional (ej. últimos 4 dígitos tarjeta / clave SPEI)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white text-xs focus:outline-none focus:border-[#1A5276]"
                />
              </div>
            </div>

            {/* Columna Derecha: Promociones y Cláusulas */}
            <div className="lg:col-span-6 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-5">
              <div className="space-y-2.5">
                <span className="text-xs font-extrabold text-[#65174E] flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  Promociones en 1 Toque (Opcional)
                </span>
                <p className="text-xs text-slate-500">
                  Toca cualquier promoción para incluirla o quitarla del contrato PDF:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {CLAUSULAS_PROMOCIONALES_SUGERIDAS.map((promo) => {
                    const activa = formData.clausulas.some(
                      (c) => c.id === promo.id && c.activa !== false
                    );
                    return (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() =>
                          activa
                            ? handleEliminarClausula(promo.id)
                            : handleAgregarPromoSugerida(promo)
                        }
                        className={`text-xs font-semibold px-3.5 py-2 rounded-full border transition flex items-center gap-1.5 ${
                          activa
                            ? 'bg-[#65174E] text-white border-[#65174E] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#65174E]/40'
                        }`}
                      >
                        <span>{activa ? '✓' : '+'}</span>
                        <span>{promo.titulo.replace('Promoción: ', '')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón Acordeón para ver/editar las Cláusulas de Protección */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClausulasExpandidas((prev) => !prev)}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between text-left transition"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-[#1A5276] shrink-0" />
                    <div>
                      <span className="text-xs font-extrabold text-[#1E3A5F] block">
                        Cláusulas de Protección Incluidas ({clausulasActivasList.length})
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        3 ligas (QA/Staging/Prod), 2 meses para liquidar, garantía 1 mes
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[#1A5276]">
                    <span>{clausulasExpandidas ? 'Ocultar' : 'Revisar'}</span>
                    {clausulasExpandidas ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {clausulasExpandidas && (
                  <div className="mt-3 space-y-2.5 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-slate-500">
                        Toca una cláusula para leer su detalle o desmarcarla:
                      </span>
                      <button
                        type="button"
                        onClick={handleRestaurarClausulasBase}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A5276] hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurar
                      </button>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {formData.clausulas.map((clausula, index) => {
                        const activa = clausula.activa !== false;
                        const expandida = clausulaDetalleId === clausula.id;
                        return (
                          <div
                            key={clausula.id}
                            className={`p-3 rounded-2xl border transition ${
                              activa
                                ? 'bg-white border-slate-200 text-slate-800'
                                : 'bg-slate-50 border-slate-200/60 text-slate-400 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={activa}
                                  onChange={() => handleToggleClausulaActiva(clausula.id)}
                                  className="w-4 h-4 rounded text-[#1A5276]"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setClausulaDetalleId(expandida ? null : clausula.id)
                                  }
                                  className="text-left text-xs font-semibold truncate flex-1"
                                >
                                  {index + 1}. {clausula.titulo}
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleEliminarClausula(clausula.id)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {expandida && (
                              <p className="mt-2 pl-6 text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
                                {clausula.texto}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!mostrarFormClausula ? (
                      <button
                        type="button"
                        onClick={() => setMostrarFormClausula(true)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-[#1A5276] hover:text-[#1A5276] font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Escribir cláusula o acuerdo personalizado</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <input
                          type="text"
                          value={nuevaClausulaTitulo}
                          onChange={(e) => setNuevaClausulaTitulo(e.target.value)}
                          placeholder="Título del acuerdo"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                        />
                        <textarea
                          rows={2}
                          value={nuevaClausulaTexto}
                          onChange={(e) => setNuevaClausulaTexto(e.target.value)}
                          placeholder="Descripción de la cláusula o promoción..."
                          className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setMostrarFormClausula(false)}
                            className="px-3 py-1.5 text-xs text-slate-500"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleAgregarClausulaPersonalizada}
                            className="px-3.5 py-1.5 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== PASO 4: FIRMA DIGITAL Y GENERACIÓN DE PDF (2 columnas en Laptop) ==================== */}
        {pasoActual === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Resumen Ejecutivo del Contrato */}
            <div className="lg:col-span-5 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A5276] block">
                  Resumen Ejecutivo
                </span>
                <h2 className="text-lg font-extrabold text-[#1E3A5F]">
                  Datos del Acuerdo
                </h2>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">
                      Cliente
                    </span>
                    <span className="text-sm font-extrabold text-[#1E3A5F] block">
                      {formData.empresa}
                    </span>
                    <span className="text-xs text-slate-600 block">
                      {formData.representante}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-100 text-[#1A5276] text-[11px] font-bold">
                    {formData.plazoDias} días hábiles
                  </span>
                </div>

                <div className="text-xs font-bold text-[#65174E] bg-white p-3 rounded-xl border border-slate-200/60">
                  {formData.servicio}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                    <span className="block text-[10px] text-slate-400">Total</span>
                    <span className="text-xs font-extrabold text-[#1E3A5F]">
                      {formatearMonedaMXN(montoTotalNum)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                    <span className="block text-[10px] text-emerald-700">Anticipo</span>
                    <span className="text-xs font-extrabold text-emerald-800">
                      {formatearMonedaMXN(anticipoNum)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-pink-50/60 border border-pink-200/60">
                    <span className="block text-[10px] text-[#65174E]">Saldo</span>
                    <span className="text-xs font-extrabold text-[#65174E]">
                      {formatearMonedaMXN(saldoContraEntrega)}
                    </span>
                  </div>
                </div>

                {promosActivasList.length > 0 && (
                  <div className="text-[11px] text-[#65174E] font-semibold pt-1">
                    🎁 Incluye {promosActivasList.length}{' '}
                    {promosActivasList.length === 1 ? 'promoción' : 'promociones'} y{' '}
                    {clausulasActivasList.length} cláusulas de garantía.
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Lienzo de Firma y Botón Descargar PDF */}
            <div className="lg:col-span-7 bg-white rounded-3xl shadow-card border border-slate-100 p-5 sm:p-6 space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <label className="text-sm font-extrabold text-[#1E3A5F] block">
                      Firma de Conformidad del Cliente <span className="text-[#65174E]">*</span>
                    </label>
                    <span className="text-xs text-slate-500">
                      Puede firmar con el dedo en pantalla táctil o con mouse/trackpad en laptop.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={limpiarFirma}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                </div>

                <div
                  className={`relative rounded-2xl border-2 border-dashed overflow-hidden bg-white ${
                    errores.firma ? 'border-red-300' : 'border-slate-300 hover:border-[#1A5276]'
                  }`}
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full h-52 sm:h-60 touch-none cursor-crosshair block"
                  />
                  {!tieneFirma && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <PenTool className="w-7 h-7 mb-1.5 opacity-30" />
                      <span className="text-xs font-medium opacity-75">
                        Trace su firma dentro de este recuadro
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-3 inset-x-10 border-b border-slate-200 text-center">
                    <span className="text-[10px] font-medium text-slate-400 bg-white px-2">
                      {formData.representante || 'Firma de Conformidad'}
                    </span>
                  </div>
                </div>

                {errores.firma && (
                  <p className="mt-1.5 text-xs text-red-600">{errores.firma}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerarYGuardarContrato}
                disabled={guardando}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#1E3A5F] to-[#1A5276] hover:opacity-95 text-white font-extrabold text-sm shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <FileDown className="w-5 h-5 text-[#5DADE2]" />
                <span>
                  {guardando
                    ? 'Generando Contrato PDF...'
                    : 'Generar y Descargar Contrato PDF'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Navegación Inferior del Wizard */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {pasoActual > 1 ? (
            <button
              type="button"
              onClick={retrocederPaso}
              className="py-3.5 px-6 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <div />
          )}

          {pasoActual < 4 && (
            <button
              type="button"
              onClick={avanzarPaso}
              className="py-3.5 px-8 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4 text-[#5DADE2]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
