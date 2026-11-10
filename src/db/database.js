import Dexie from 'dexie';

/**
 * Base de datos local IndexedDB gestionada con Dexie.js
 * Tabla principal: `contratos`
 * Incluye control de pagos / abonos parciales, método de pago (Efectivo, SPEI, Tarjeta de Crédito/Débito),
 * fecha límite de 2 meses (60 días) para liquidación y liberación de código fuente.
 */
export class RCMCierresDB extends Dexie {
  constructor() {
    super('RCMCierresCodeDevDB');

    this.version(1).stores({
      contratos: '++id, folio, fecha, empresa, representante, telefono, correo, servicio, sincronizado'
    });
  }
}

export const db = new RCMCierresDB();

/**
 * Genera un folio único corporativo para el contrato (ej. RCM-20261110-4821)
 */
export function generarFolioContrato() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `RCM-${yyyy}${mm}${dd}-${randomSuffix}`;
}

/**
 * Genera un folio único para un Ticket de Pago / Abono (ej. TKT-20261110-739)
 */
export function generarFolioTicket(numeroAbono = 1) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `TKT-${mm}${dd}-A${numeroAbono}-${rand}`;
}

/**
 * Calcula la fecha máxima de liquidación (2 meses / 60 días naturales desde la fecha del contrato)
 */
export function calcularFechaLimiteLiquidacion(fechaInicioISO) {
  const fecha = fechaInicioISO ? new Date(fechaInicioISO) : new Date();
  const limite = new Date(fecha);
  limite.setDate(limite.getDate() + 60); // 2 meses = 60 días naturales
  return limite.toISOString();
}

/**
 * Suma días hábiles (Lunes a Viernes) a una fecha dada para calcular hitos reales de entrega
 */
export function sumarDiasHabiles(fechaInicioISO, diasHabiles) {
  const fecha = fechaInicioISO ? new Date(fechaInicioISO) : new Date();
  const resultado = new Date(fecha);
  let restantes = Math.max(1, Math.round(Number(diasHabiles) || 1));

  while (restantes > 0) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay(); // 0 = Domingo, 6 = Sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      restantes--;
    }
  }
  return resultado.toISOString();
}

/**
 * Calcula los hitos de la Línea de Tiempo de Ingeniería para un contrato:
 * 1. Recepción de Insumos (Día 3 hábil)
 * 2. Entrega Liga 1: QA (~45% del plazo)
 * 3. Entrega Liga 2: Staging (~75% del plazo)
 * 4. Entrega Liga 3: Producción Final (100% del plazo en días hábiles)
 * 5. Fin de Garantía (30 días naturales después de Producción)
 * 6. Límite de Liquidación (60 días naturales / 2 meses)
 */
export function calcularHitosLineaTiempo(fechaInicioISO, plazoDias = 7) {
  const plazo = Math.max(3, Number(plazoDias) || 7);
  const diasInsumos = Math.min(3, Math.max(1, Math.floor(plazo * 0.3)));
  const diasQA = Math.max(diasInsumos + 1, Math.round(plazo * 0.5));
  const diasStaging = Math.max(diasQA + 1, Math.round(plazo * 0.8));
  const diasProduccion = Math.max(diasStaging + 1, plazo);

  const fechaInsumos = sumarDiasHabiles(fechaInicioISO, diasInsumos);
  const fechaQA = sumarDiasHabiles(fechaInicioISO, diasQA);
  const fechaStaging = sumarDiasHabiles(fechaInicioISO, diasStaging);
  const fechaProduccion = sumarDiasHabiles(fechaInicioISO, diasProduccion);

  const finGarantia = new Date(fechaProduccion);
  finGarantia.setDate(finGarantia.getDate() + 30);

  return {
    fechaInsumos,
    fechaQA,
    fechaStaging,
    fechaProduccion,
    fechaFinGarantia: finGarantia.toISOString(),
    fechaLimiteLiquidacion: calcularFechaLimiteLiquidacion(fechaInicioISO)
  };
}

/**
 * Guarda un nuevo cierre en IndexedDB con estado sincronizado = false
 * e inicializa el historial de pagos (`pagos`) con el Anticipo Inicial si es > 0.
 * @param {Object} datosCierre
 * @returns {Promise<Object>} Registro completo con su ID autogenerado
 */
export async function guardarContratoLocal(datosCierre) {
  const fechaISO = new Date().toISOString();
  const folio = datosCierre.folio || generarFolioContrato();
  const fechaLimiteLiquidacion = calcularFechaLimiteLiquidacion(fechaISO);

  const montoTotal = Number(datosCierre.montoTotal) || 0;
  const anticipo = Number(datosCierre.anticipo) || 0;
  const saldo = Math.max(0, montoTotal - anticipo);
  const metodoPagoAnticipo = datosCierre.metodoPagoAnticipo || 'Transferencia SPEI';
  const referenciaAnticipo = (datosCierre.referenciaAnticipo || '').trim();

  // Si hay anticipo inicial > 0, se crea automáticamente el Ticket #1 en el historial de pagos
  const pagosIniciales = [];
  if (anticipo > 0) {
    pagosIniciales.push({
      idPago: `pago-${Date.now()}-1`,
      folioTicket: generarFolioTicket(1),
      numeroAbono: 1,
      fecha: fechaISO,
      monto: anticipo,
      metodoPago: metodoPagoAnticipo,
      referencia: referenciaAnticipo || 'Pago de Anticipo Inicial en Cierre',
      concepto: 'Anticipo Inicial de Contrato',
      saldoAnterior: montoTotal,
      saldoRestante: saldo
    });
  }

  const plazoDiasNum = Number(datosCierre.plazoDias) || 7;
  const hitos = calcularHitosLineaTiempo(fechaISO, plazoDiasNum);

  const registro = {
    folio,
    fecha: fechaISO,
    fechaLimiteLiquidacion,
    hitos,
    etapaIngenieria: {
      insumosRecibidos: false,
      qaEntregado: false,
      stagingEntregado: false,
      produccionEntregado: false,
      ligaQA: '',
      ligaStaging: '',
      ligaProduccion: '',
      notasInternas: ''
    },
    empresa: datosCierre.empresa.trim(),
    representante: datosCierre.representante.trim(),
    vendedor: (datosCierre.vendedor || 'Vendedor en Campo').trim() || 'Vendedor en Campo',
    comisionPorcentaje: 25,
    comisionPagada: false,
    telefono: datosCierre.telefono.trim(),
    correo: (datosCierre.correo || '').trim(),
    domicilio: (datosCierre.domicilio || '').trim(),
    servicio: datosCierre.servicio,
    entregables: {
      hostingDominioPropio: Boolean(datosCierre.entregables?.hostingDominioPropio),
      metaBusinessVerificado: Boolean(datosCierre.entregables?.metaBusinessVerificado),
      incluyeCapacitacion: Boolean(datosCierre.entregables?.incluyeCapacitacion),
      incluyeSoporte30Dias: Boolean(datosCierre.entregables?.incluyeSoporte30Dias),
    },
    requerimientos: (datosCierre.requerimientos || '').trim(),
    montoTotal,
    anticipo,
    totalPagado: anticipo,
    saldo,
    liquidado: saldo <= 0 && montoTotal > 0,
    codigoLiberado: saldo <= 0 && montoTotal > 0,
    metodoPagoAnticipo,
    pagos: pagosIniciales,
    plazoDias: Number(datosCierre.plazoDias) || 7,
    clausulas: Array.isArray(datosCierre.clausulas) ? datosCierre.clausulas : [],
    firmaBase64: datosCierre.firmaBase64,
    sincronizado: false,
    fechaSincronizacion: null,
    ultimaModificacion: fechaISO
  };

  const id = await db.contratos.add(registro);
  return { ...registro, id };
}

/**
 * Registra un nuevo Abono / Pago en un contrato existente, recalcula el saldo restante,
 * genera su Ticket foliado y evalúa si ya se liquidó el 100% para liberar el código.
 *
 * @param {number} contratoId ID del contrato en IndexedDB
 * @param {{ monto: number, metodoPago: string, referencia?: string, concepto?: string }} datosAbono
 * @returns {Promise<{ contratoActualizado: Object, nuevoTicket: Object }>}
 */
export async function registrarAbonoContrato(contratoId, datosAbono) {
  const contrato = await db.contratos.get(contratoId);
  if (!contrato) {
    throw new Error('No se encontró el contrato para registrar el abono.');
  }

  const montoTotal = Number(contrato.montoTotal) || 0;
  const pagosPrevios = Array.isArray(contrato.pagos) ? [...contrato.pagos] : [];

  // Si era un contrato antiguo sin arreglo `pagos` pero con `anticipo > 0`, reconstruimos el pago 1
  if (pagosPrevios.length === 0 && Number(contrato.anticipo) > 0) {
    const ant = Number(contrato.anticipo);
    pagosPrevios.push({
      idPago: `pago-init-${contrato.id}`,
      folioTicket: generarFolioTicket(1),
      numeroAbono: 1,
      fecha: contrato.fecha,
      monto: ant,
      metodoPago: contrato.metodoPagoAnticipo || 'Transferencia SPEI',
      referencia: 'Anticipo Inicial',
      concepto: 'Anticipo Inicial de Contrato',
      saldoAnterior: montoTotal,
      saldoRestante: Math.max(0, montoTotal - ant)
    });
  }

  const totalPagadoAnterior = pagosPrevios.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldoAnterior = Math.max(0, montoTotal - totalPagadoAnterior);

  const montoAbono = Number(datosAbono.monto) || 0;
  if (montoAbono <= 0) {
    throw new Error('El monto del abono debe ser mayor a $0.00 MXN.');
  }
  if (montoAbono > saldoAnterior + 0.01) {
    throw new Error(`El abono no puede superar el saldo pendiente ($${saldoAnterior.toFixed(2)} MXN).`);
  }

  const nuevoTotalPagado = Math.min(montoTotal, Math.round((totalPagadoAnterior + montoAbono) * 100) / 100);
  const nuevoSaldo = Math.max(0, Math.round((montoTotal - nuevoTotalPagado) * 100) / 100);
  const numeroAbono = pagosPrevios.length + 1;

  const nuevoTicket = {
    idPago: `pago-${Date.now()}-${numeroAbono}`,
    folioTicket: generarFolioTicket(numeroAbono),
    numeroAbono,
    fecha: new Date().toISOString(),
    monto: montoAbono,
    metodoPago: datosAbono.metodoPago || 'Efectivo',
    referencia: (datosAbono.referencia || '').trim() || 'Abono en campo',
    concepto:
      (datosAbono.concepto || '').trim() ||
      (nuevoSaldo === 0 ? 'Liquidación Total de Proyecto (100%)' : `Abono Parcial #${numeroAbono}`),
    saldoAnterior,
    saldoRestante: nuevoSaldo
  };

  const nuevosPagos = [...pagosPrevios, nuevoTicket];
  const estaLiquidado = nuevoSaldo === 0 && montoTotal > 0;

  const cambios = {
    pagos: nuevosPagos,
    totalPagado: nuevoTotalPagado,
    saldo: nuevoSaldo,
    liquidado: estaLiquidado,
    codigoLiberado: estaLiquidado,
    sincronizado: false,
    ultimaModificacion: new Date().toISOString()
  };

  await db.contratos.update(contratoId, cambios);
  const contratoActualizado = await db.contratos.get(contratoId);

  return { contratoActualizado, nuevoTicket };
}

/**
 * Obtiene todos los contratos ordenados del más reciente al más antiguo
 */
export async function obtenerTodosLosContratos() {
  const lista = await db.contratos.toArray();
  return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/**
 * Obtiene únicamente los contratos pendientes de sincronización (sincronizado === false)
 */
export async function obtenerContratosPendientes() {
  const todos = await db.contratos.toArray();
  return todos
    .filter((c) => c.sincronizado === false)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

/**
 * Marca un contrato específico como sincronizado tras recibir 200 OK del servidor
 */
export async function marcarContratoSincronizado(id, metadataRespuesta = {}) {
  return await db.contratos.update(id, {
    sincronizado: true,
    fechaSincronizacion: new Date().toISOString(),
    ...metadataRespuesta
  });
}

/**
 * Regresa un contrato al estado pendiente (sincronizado = false) para reenviar el correo real
 */
export async function desmarcarContratoSincronizado(id) {
  return await db.contratos.update(id, {
    sincronizado: false,
    fechaSincronizacion: null
  });
}

/**
 * Actualiza el avance en la Línea de Tiempo de Ingeniería (Insumos, Liga QA, Liga Staging, Liga Producción)
 */
export async function actualizarAvanceIngenieria(id, nuevosDatosEtapa) {
  const contrato = await db.contratos.get(id);
  if (!contrato) return null;

  const etapaActual = contrato.etapaIngenieria || {
    insumosRecibidos: false,
    qaEntregado: false,
    stagingEntregado: false,
    produccionEntregado: false,
    ligaQA: '',
    ligaStaging: '',
    ligaProduccion: '',
    notasInternas: ''
  };

  const etapaActualizada = {
    ...etapaActual,
    ...nuevosDatosEtapa
  };

  await db.contratos.update(id, {
    etapaIngenieria: etapaActualizada,
    ultimaModificacion: new Date().toISOString()
  });

  return await db.contratos.get(id);
}

/**
 * Actualiza el vendedor asignado o el estado de pago de su comisión del 25%
 */
export async function actualizarDatosComisionVendedor(id, cambiosComision) {
  await db.contratos.update(id, {
    ...cambiosComision,
    ultimaModificacion: new Date().toISOString()
  });
  return await db.contratos.get(id);
}

/**
 * Sincroniza un contrato directamente dentro de la app (Bandeja Interna del Admin)
 * sin depender de configuración de servidor de correo externo.
 */
export async function sincronizarTodosEnAppInterna() {
  const pendientes = await obtenerContratosPendientes();
  const ahora = new Date().toISOString();
  for (const c of pendientes) {
    await db.contratos.update(c.id, {
      sincronizado: true,
      fechaSincronizacion: ahora
    });
  }
  return pendientes.length;
}

/**
 * Elimina un contrato local por ID (opcional para mantenimiento)
 */
export async function eliminarContratoLocal(id) {
  return await db.contratos.delete(id);
}

const STORAGE_INVERSION_KEY = 'rcm_inversiones_admin_v1';

/**
 * Obtiene las partidas de inversión/costos operativos y el % de fondo de reinversión del administrador
 */
export function obtenerDatosInversionAdmin() {
  try {
    const raw = localStorage.getItem(STORAGE_INVERSION_KEY);
    if (!raw) {
      return {
        porcentajeReinversion: 15,
        partidas: [],
        updatedAt: null
      };
    }
    const parsed = JSON.parse(raw);
    return {
      porcentajeReinversion:
        typeof parsed.porcentajeReinversion === 'number'
          ? parsed.porcentajeReinversion
          : 15,
      partidas: Array.isArray(parsed.partidas) ? parsed.partidas : [],
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return {
      porcentajeReinversion: 15,
      partidas: [],
      updatedAt: null
    };
  }
}

export function guardarDatosInversionAdmin(datos) {
  const actual = obtenerDatosInversionAdmin();
  const nuevo = {
    ...actual,
    ...datos,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_INVERSION_KEY, JSON.stringify(nuevo));
  return nuevo;
}

export function agregarPartidaInversion({ concepto, categoria, monto, proyectoEmpresa }) {
  const actual = obtenerDatosInversionAdmin();
  const nuevaPartida = {
    id: `inv-${Date.now()}`,
    fecha: new Date().toISOString(),
    concepto: (concepto || 'Inversión operativa').trim(),
    categoria: categoria || 'Infraestructura / APIs',
    monto: Math.max(0, Number(monto) || 0),
    proyectoEmpresa: proyectoEmpresa || 'General RCM CodeDev'
  };
  const actualizado = {
    ...actual,
    partidas: [nuevaPartida, ...actual.partidas],
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_INVERSION_KEY, JSON.stringify(actualizado));
  return actualizado;
}

export function eliminarPartidaInversion(idPartida) {
  const actual = obtenerDatosInversionAdmin();
  const actualizado = {
    ...actual,
    partidas: actual.partidas.filter((p) => p.id !== idPartida),
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_INVERSION_KEY, JSON.stringify(actualizado));
  return actualizado;
}

/**
 * Sincronización Bidireccional Cloud (Celular <-> Ordenador) vía Netlify Blobs
 * Sube los contratos e inversiones locales y descarga cualquier cierre levantado en otro dispositivo.
 */
export async function sincronizarDispositivosNube() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, offline: true, nuevosDescargados: 0 };
  }

  try {
    const contratosLocales = await db.contratos.toArray();
    const inversionesLocales = obtenerDatosInversionAdmin();

    let configSyncLocal = { pinAdmin: '2026', pinUpdatedAt: null };
    try {
      const rawCfg = localStorage.getItem('rcm_sync_config_v1');
      if (rawCfg) {
        const parsedCfg = JSON.parse(rawCfg);
        configSyncLocal = {
          ...parsedCfg,
          pinAdmin: parsedCfg.pinAdmin || '2026',
          pinUpdatedAt: parsedCfg.pinUpdatedAt || null
        };
      }
    } catch {
      // ignore
    }

    const response = await fetch('/.netlify/functions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contratos: contratosLocales,
        inversiones: inversionesLocales,
        configAdmin: {
          pinAdmin: configSyncLocal.pinAdmin,
          pinUpdatedAt: configSyncLocal.pinUpdatedAt
        }
      })
    });

    if (!response.ok) {
      return { ok: false, status: response.status, nuevosDescargados: 0 };
    }

    const data = await response.json();
    if (!data || !data.ok) {
      return { ok: false, nuevosDescargados: 0 };
    }

    const contratosNube = Array.isArray(data.contratos) ? data.contratos : [];
    const todosLocalesActuales = await db.contratos.toArray();
    const mapaLocalPorFolio = new Map();
    for (const loc of todosLocalesActuales) {
      const clave = loc.folio || `RCM-ID-${loc.id}-${loc.fecha}`;
      mapaLocalPorFolio.set(clave, loc);
    }

    let nuevosDescargados = 0;
    const ahora = new Date().toISOString();

    for (const remoto of contratosNube) {
      if (!remoto) continue;
      const clave = remoto.folio || `RCM-ID-${remoto.id}-${remoto.fecha}`;
      const existenteLocal = mapaLocalPorFolio.get(clave);

      if (!existenteLocal) {
        // Es un contrato creado en otro dispositivo (ej. en el celular y ahora llega al ordenador)
        const copiaSinId = { ...remoto };
        delete copiaSinId.id;
        copiaSinId.sincronizado = true;
        copiaSinId.fechaSincronizacion = ahora;
        await db.contratos.add(copiaSinId);
        nuevosDescargados++;
      } else {
        // Actualizar registro local con la versión fusionada de la nube conservando su id local
        const copiaActualizada = {
          ...existenteLocal,
          ...remoto,
          id: existenteLocal.id,
          sincronizado: true,
          fechaSincronizacion: existenteLocal.fechaSincronizacion || ahora
        };
        await db.contratos.put(copiaActualizada);
      }
    }

    // Sincronizar también el apartado de inversiones si hay datos más recientes en la nube
    if (data.inversiones && typeof data.inversiones === 'object') {
      const fechaNube = new Date(data.inversiones.updatedAt || 0).getTime();
      const fechaLocal = new Date(inversionesLocales.updatedAt || 0).getTime();
      if (fechaNube > fechaLocal) {
        localStorage.setItem(STORAGE_INVERSION_KEY, JSON.stringify(data.inversiones));
      }
    }

    // Sincronizar el PIN de Administrador entre todos los dispositivos (Celular <-> Ordenador)
    if (data.configAdmin && data.configAdmin.pinAdmin) {
      const fechaPinNube = new Date(data.configAdmin.pinUpdatedAt || 0).getTime();
      const fechaPinLocal = new Date(configSyncLocal.pinUpdatedAt || 0).getTime();
      if (fechaPinNube >= fechaPinLocal && data.configAdmin.pinUpdatedAt) {
        try {
          const rawCfg = localStorage.getItem('rcm_sync_config_v1');
          const baseCfg = rawCfg ? JSON.parse(rawCfg) : {};
          localStorage.setItem(
            'rcm_sync_config_v1',
            JSON.stringify({
              ...baseCfg,
              pinAdmin: String(data.configAdmin.pinAdmin).trim(),
              pinUpdatedAt: data.configAdmin.pinUpdatedAt
            })
          );
        } catch {
          // ignore
        }
      }
    }

    return {
      ok: true,
      nuevosDescargados,
      totalNube: contratosNube.length,
      pinAdmin: data.configAdmin?.pinAdmin || configSyncLocal.pinAdmin
    };
  } catch (err) {
    console.warn('Aviso en sincronización cloud entre dispositivos:', err);
    return { ok: false, error: err.message, nuevosDescargados: 0 };
  }
}
