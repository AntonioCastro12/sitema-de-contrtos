import React, { useState, useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import {
  Building2,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Cpu,
  CheckSquare,
  FileText,
  DollarSign,
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
    tag: 'Comercio / gastro'
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

  // Acordeón limpio para que la sección de cláusulas no sature la pantalla en el Paso 3
  const [clausulasExpandidas, setClausulasExpandidas] = useState(false);
  const [clausulaDetalleId, setClausulaDetalleId] = useState(null);
  const [nuevaClausulaTitulo, setNuevaClausulaTitulo] = useState('');
  const [nuevaClausulaTexto, setNuevaClausulaTexto] = useState('');
  const [mostrarFormClausula, setMostrarFormClausula] = useState(false);

  const [formData, setFormData] = useState({
    empresa: '',
    representante: '',
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
      pad.removeEventListener('endStroke', handleEndStroke);
      pad.off();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [pasoActual]);

  const limpiarFirma = () => {
    if (signaturePadRef.current && canvasRef.current) {
      signaturePadRef.current.clear();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setTieneFirma(false);
      setFormData((prev) => ({ ...prev, firmaBase64: '' }));
    }
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

  const handleSeleccionarServicio = (nombreServicio) => {
    const item = CATALOGO_SERVICIOS_RCM.find((s) => s.nombre === nombreServicio);
    if (item) {
      const nuevoTotal = String(item.inversionSugerida);
      setFormData((prev) => ({
        ...prev,
        servicio: nombreServicio,
        montoTotal: prev.montoTotal ? prev.montoTotal : nuevoTotal,
        anticipo: prev.anticipoEditadoManualmente
          ? prev.anticipo
          : String(Math.round((Number(prev.montoTotal) || item.inversionSugerida) * 0.5)),
        plazoDias: String(item.plazoSugerido)
      }));
    } else {
      handleChangeCampo('servicio', nombreServicio);
    }
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

  const handleToggleClausulaActiva = (idClausula) => {
    setFormData((prev) => ({
      ...prev,
      clausulas: prev.clausulas.map((c) =>
        c.id === idClausula ? { ...c, activa: !c.activa } : c
      )
    }));
  };

  const handleEliminarClausula = (idClausula) => {
    setFormData((prev) => ({
      ...prev,
      clausulas: prev.clausulas.filter((c) => c.id !== idClausula)
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
    setFormData({
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
    });
    setErrores({});
  };

  const PASOS_INFO = [
    { num: 1, titulo: 'Cliente' },
    { num: 2, titulo: 'Alcance' },
    { num: 3, titulo: 'Pago' },
    { num: 4, titulo: 'Firma' }
  ];

  return (
    <div className="pb-28">
      {/* Stepper Minimalista y Amigable */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sticky top-[60px] z-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center">
                {pasoActual}
              </span>
              <span className="text-sm font-bold text-slate-800">
                {PASOS_INFO[pasoActual - 1].titulo}
              </span>
              <span className="text-xs text-slate-400 font-medium">de 4</span>
            </div>

            {pasoActual === 1 && (
              <button
                type="button"
                onClick={cargarDatosEjemploRapido}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A5276] bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-full transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#65174E]" />
                Autollenar demo
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
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
                  className="text-left focus:outline-none"
                >
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      completado
                        ? 'bg-emerald-500'
                        : activo
                        ? 'bg-[#1A5276]'
                        : 'bg-slate-200'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenedor Principal con Espaciado Aireado */}
      <div className="max-w-md mx-auto px-4 pt-5">
        {errores.general && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errores.general}</span>
          </div>
        )}

        {/* ==================== PASO 1: CLIENTE ==================== */}
        {pasoActual === 1 && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#1E3A5F]">
                Datos del Cliente
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ¿Con quién estamos cerrando el proyecto hoy?
              </p>
            </div>

            <div className="space-y-4">
              {/* Empresa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                  <label className="text-xs font-semibold text-slate-700">
                    WhatsApp (10 dígitos) <span className="text-[#65174E]">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-semibold ${
                      formData.telefono.length === 10 ? 'text-emerald-600' : 'text-slate-400'
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

              {/* Correo y Domicilio opcionales más limpios */}
              <div className="pt-2 border-t border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Correo electrónico <span className="text-slate-400">(opcional)</span>
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

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Ciudad o domicilio <span className="text-slate-400">(opcional)</span>
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
              </div>
            </div>
          </div>
        )}

        {/* ==================== PASO 2: SERVICIO Y ALCANCE ==================== */}
        {pasoActual === 2 && (
          <div className="space-y-4">
            {/* Selector de Servicio */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1E3A5F]">
                  Servicio a Contratar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige la solución principal que requiere el cliente.
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
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        seleccionado
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm'
                          : 'bg-slate-50/60 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-snug">{item.nombre}</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            seleccionado ? 'text-[#5DADE2]' : 'text-slate-500'
                          }`}
                        >
                          {item.tag} • ~{item.plazoSugerido} días hábiles
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
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

            {/* Checkboxes en Grid 2x2 compacto y amigable */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#1E3A5F]">
                Insumos y Entregables Incluidos
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
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
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        activo
                          ? 'bg-sky-50/80 border-[#5DADE2] text-[#1E3A5F]'
                          : 'bg-slate-50/50 border-slate-200 text-slate-600'
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Requerimientos específicos y detalles acordados <span className="text-[#65174E]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.requerimientos}
                  onChange={(e) => handleChangeCampo('requerimientos', e.target.value)}
                  placeholder="Anota qué necesita el cliente, funciones clave, integraciones o dolores de su negocio..."
                  className={`w-full p-3.5 rounded-2xl border text-slate-900 leading-relaxed focus:outline-none focus:ring-2 transition ${
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
        )}

        {/* ==================== PASO 3: CONDICIONES ECONÓMICAS Y CLÁUSULAS LIMPIAS ==================== */}
        {pasoActual === 3 && (
          <div className="space-y-4">
            {/* Tarjeta Financiera Principal */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1E3A5F]">
                  Inversión y Anticipo
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  El cliente cuenta con hasta 2 meses para liquidar y liberar su código.
                </p>
              </div>

              {/* Inversión y Anticipo lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                      className="w-full pl-8 pr-3 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white font-bold text-[#1E3A5F] focus:outline-none focus:border-[#1A5276]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-emerald-800">
                      Anticipo Hoy
                    </label>
                    <button
                      type="button"
                      onClick={aplicar50PorcientoSugerido}
                      className="text-[11px] font-semibold text-[#1A5276] hover:underline"
                    >
                      50%
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
                      className="w-full pl-8 pr-3 py-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 focus:bg-white font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
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
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block">
                    Saldo restante por abonar
                  </span>
                  <span className="text-base font-bold text-[#65174E]">
                    {formatearMonedaMXN(saldoContraEntrega)}
                  </span>
                </div>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
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
                <label className="block text-xs font-semibold text-slate-700">
                  ¿Cómo paga el anticipo? <span className="text-slate-400 font-normal">(Emite Ticket #1)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO_RCM.map((m) => {
                    const activo = formData.metodoPagoAnticipo === m.label;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleChangeCampo('metodoPagoAnticipo', m.label)}
                        className={`py-2.5 px-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition ${
                          activo
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
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

            {/* Tarjeta de Promociones Rápidas y Cláusulas (Colapsable para no saturar) */}
            <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-4">
              {/* Promociones en 1 toque siempre a la mano pero limpias */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#65174E] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Agregar promoción al contrato (opcional)
                </span>
                <div className="flex flex-wrap gap-1.5">
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
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
                          activa
                            ? 'bg-[#65174E] text-white border-[#65174E]'
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
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClausulasExpandidas((prev) => !prev)}
                  className="w-full py-2.5 px-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between text-left transition"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#1A5276]" />
                    <div>
                      <span className="text-xs font-bold text-[#1E3A5F] block">
                        Cláusulas de Protección Incluidas ({clausulasActivasList.length})
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        3 ligas (QA/Staging/Prod), 2 meses para liquidar, garantía 1 mes
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#1A5276]">
                    <span>{clausulasExpandidas ? 'Ocultar' : 'Personalizar'}</span>
                    {clausulasExpandidas ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Contenido desplegable solo cuando el vendedor quiere ajustar cláusulas */}
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

                    {/* Agregar cláusula escrita a mano */}
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

        {/* ==================== PASO 4: FIRMA DIGITAL Y GENERACIÓN DE PDF ==================== */}
        {pasoActual === 4 && (
          <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#1E3A5F]">
                Confirmación y Firma
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Muestra este resumen al cliente y solicita su firma en pantalla.
              </p>
            </div>

            {/* Resumen Ejecutivo Limpio */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Cliente</span>
                  <span className="text-sm font-bold text-[#1E3A5F] block">
                    {formData.empresa}
                  </span>
                  <span className="text-xs text-slate-600 block">
                    {formData.representante}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-sky-100 text-[#1A5276] text-[11px] font-semibold">
                  {formData.plazoDias} días hábiles
                </span>
              </div>

              <div className="text-xs font-semibold text-[#65174E] bg-white p-2.5 rounded-xl border border-slate-200/60">
                {formData.servicio}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-white border border-slate-200/60">
                  <span className="block text-[10px] text-slate-400">Total</span>
                  <span className="text-xs font-bold text-[#1E3A5F]">
                    {formatearMonedaMXN(montoTotalNum)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                  <span className="block text-[10px] text-emerald-700">Anticipo</span>
                  <span className="text-xs font-bold text-emerald-800">
                    {formatearMonedaMXN(anticipoNum)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-pink-50/60 border border-pink-200/60">
                  <span className="block text-[10px] text-[#65174E]">Saldo</span>
                  <span className="text-xs font-bold text-[#65174E]">
                    {formatearMonedaMXN(saldoContraEntrega)}
                  </span>
                </div>
              </div>

              {promosActivasList.length > 0 && (
                <div className="text-[11px] text-[#65174E] font-medium pt-1">
                  🎁 Incluye {promosActivasList.length}{' '}
                  {promosActivasList.length === 1 ? 'promoción' : 'promociones'} y{' '}
                  {clausulasActivasList.length} cláusulas de garantía.
                </div>
              )}
            </div>

            {/* Lienzo de Firma Táctil */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  Firma del Cliente <span className="text-[#65174E]">*</span>
                </label>
                <button
                  type="button"
                  onClick={limpiarFirma}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              </div>

              <div
                className={`relative rounded-2xl border-2 border-dashed overflow-hidden bg-white ${
                  errores.firma ? 'border-red-300' : 'border-slate-300'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 touch-none cursor-crosshair block"
                />
                {!tieneFirma && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <PenTool className="w-6 h-6 mb-1 opacity-30" />
                    <span className="text-xs font-medium opacity-70">
                      Firme aquí con su dedo
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

            {/* Botón Principal */}
            <button
              type="button"
              onClick={handleGenerarYGuardarContrato}
              disabled={guardando}
              className="w-full py-4 px-5 rounded-2xl bg-[#1E3A5F] hover:bg-[#1A5276] text-white font-bold text-sm shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <FileDown className="w-5 h-5 text-[#5DADE2]" />
              <span>
                {guardando
                  ? 'Generando Contrato PDF...'
                  : 'Generar y Descargar Contrato PDF'}
              </span>
            </button>
          </div>
        )}

        {/* Navegación Inferior del Wizard */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {pasoActual > 1 ? (
            <button
              type="button"
              onClick={retrocederPaso}
              className="py-3.5 px-5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
          ) : (
            <div />
          )}

          {pasoActual < 4 && (
            <button
              type="button"
              onClick={avanzarPaso}
              className="flex-1 max-w-[220px] ml-auto py-3.5 px-5 rounded-2xl bg-[#1A5276] hover:bg-[#1E3A5F] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
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
