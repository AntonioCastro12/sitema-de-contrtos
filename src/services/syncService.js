import { obtenerContratosPendientes, marcarContratoSincronizado, calcularFechaLimiteLiquidacion } from '../db/database';
import { formatearMonedaMXN, formatearFechaLarga, obtenerPagosNormalizados } from './pdfGenerator';
import { obtenerClausulasIniciales } from './clausulasCatalogo';

const STORAGE_CONFIG_KEY = 'rcm_sync_config_v1';

/**
 * Obtiene la configuración actual del endpoint de sincronización y destinatario
 */
export function obtenerConfigSincronizacion() {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error leyendo configuración de sincronización:', e);
  }
  return {
    endpointUrl: import.meta.env.VITE_SYNC_API_URL || '/api/contratos/sincronizar',
    emailDestino: import.meta.env.VITE_NOTIFY_EMAIL || '',
    resendApiKey: import.meta.env.VITE_RESEND_API_KEY || '',
    web3formsKey: import.meta.env.VITE_WEB3FORMS_KEY || '',
    usarFormSubmitDirecto: true,
    sincronizacionInternaApp: true, // Permite sincronizar directamente al Panel Privado del Admin dentro de la app sin requerir correo externo
    pinAdmin: '2026' // PIN privado para que solo Antonio / Admin vea la Línea de Tiempo
  };
}

/**
 * Guarda la configuración personalizada del endpoint, correo o API Key
 */
export function guardarConfigSincronizacion(nuevaConfig) {
  const actual = obtenerConfigSincronizacion();
  const combinada = { ...actual, ...nuevaConfig };
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(combinada));
  return combinada;
}

/**
 * Construye el asunto y cuerpo HTML ejecutivo del correo para notificar el cierre
 * Formato requerido:
 * - Asunto: 📋 Nuevo Cierre en Campo: [Nombre Empresa] - [Servicio]
 * - Cuerpo HTML: Resumen ejecutivo del cliente, desglose de pagos, requerimientos técnicos anotados, cláusulas y firma incrustada.
 */
export function construirCorreoCierreHTML(contrato) {
  const asunto = `📋 Nuevo Cierre en Campo: ${contrato.empresa} - ${contrato.servicio}`;
  const montoTotal = Number(contrato.montoTotal) || 0;
  const pagos = obtenerPagosNormalizados(contrato);
  const totalPagado =
    contrato.totalPagado !== undefined
      ? Number(contrato.totalPagado)
      : pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldo = Math.max(0, montoTotal - totalPagado);
  const estaLiquidado = saldo <= 0 && montoTotal > 0;
  const fechaLimiteISO =
    contrato.fechaLimiteLiquidacion || calcularFechaLimiteLiquidacion(contrato.fecha);
  const entregables = contrato.entregables || {};
  const folio = contrato.folio || `RCM-${contrato.id || '001'}`;
  const clausulasActivas =
    Array.isArray(contrato.clausulas) && contrato.clausulas.length > 0
      ? contrato.clausulas.filter((c) => c.activa !== false)
      : obtenerClausulasIniciales();

  const filasPagosHtml = pagos
    .map(
      (p, idx) => `
      <tr style="border-bottom:1px solid #E2E8F0;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
        <td style="padding:6px 8px;font-weight:700;color:#1E3A5F;">${p.folioTicket || `TKT-${idx + 1}`}</td>
        <td style="padding:6px 8px;color:#475569;">${formatearFechaLarga(p.fecha)}</td>
        <td style="padding:6px 8px;font-weight:600;color:#334155;">${p.metodoPago || 'Efectivo'}</td>
        <td style="padding:6px 8px;font-weight:700;color:#047857;text-align:right;">${formatearMonedaMXN(p.monto)}</td>
        <td style="padding:6px 8px;font-weight:700;color:${Number(p.saldoRestante) === 0 ? '#047857' : '#65174E'};text-align:right;">${formatearMonedaMXN(p.saldoRestante)}</td>
      </tr>`
    )
    .join('');

  const clausulasHtmlItems = clausulasActivas
    .map(
      (c, i) => `
      <div style="margin-bottom:8px;padding:8px 10px;background-color:${
        c.categoria === 'Promoción' ? '#FDF2F8' : '#F8FAFC'
      };border-left:3px solid ${
        c.categoria === 'Promoción' ? '#65174E' : '#1A5276'
      };border-radius:4px;font-size:12px;line-height:1.4;">
        <strong style="color:${c.categoria === 'Promoción' ? '#65174E' : '#1E3A5F'};">
          Cláusula ${i + 1} (${c.titulo}):
        </strong>
        <span style="color:#334155;"> ${c.texto}</span>
      </div>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${asunto}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 16px rgba(30,58,95,0.08);">
          
          <!-- Header Corporativo RCM CodeDev -->
          <tr>
            <td style="background:linear-gradient(135deg,#1E3A5F 0%,#1A5276 65%,#65174E 100%);padding:24px 28px;color:#FFFFFF;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#5DADE2;text-transform:uppercase;">RCM CodeDev • Notificación Automática de Campo</div>
              <h1 style="margin:6px 0 4px 0;font-size:20px;font-weight:800;color:#FFFFFF;">Nuevo Cierre Comercial Registrado</h1>
              <div style="font-size:12px;color:#E2E8F0;">Folio: <strong>${folio}</strong> &nbsp;|&nbsp; Fecha: ${formatearFechaLarga(contrato.fecha)}</div>
            </td>
          </tr>

          <!-- Resumen Ejecutivo del Cliente -->
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#1E3A5F;text-transform:uppercase;border-bottom:2px solid #5DADE2;padding-bottom:6px;">
                1. Resumen Ejecutivo del Cliente
              </h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
                <tr>
                  <td width="38%" style="color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">Empresa / Negocio:</td>
                  <td style="color:#0F172A;font-weight:700;border-bottom:1px solid #F1F5F9;">${contrato.empresa}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">Representante / Decisor:</td>
                  <td style="color:#0F172A;border-bottom:1px solid #F1F5F9;">${contrato.representante}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">WhatsApp:</td>
                  <td style="color:#1A5276;font-weight:700;border-bottom:1px solid #F1F5F9;">${contrato.telefono}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">Correo Electrónico:</td>
                  <td style="color:#0F172A;border-bottom:1px solid #F1F5F9;">${contrato.correo || 'No proporcionado'}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-weight:600;">Domicilio / Municipio:</td>
                  <td style="color:#0F172A;">${contrato.domicilio || 'No proporcionado'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Desglose Económico -->
          <tr>
            <td style="padding:12px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#1E3A5F;text-transform:uppercase;border-bottom:2px solid #65174E;padding-bottom:6px;">
                2. Condiciones Comerciales y Desglose de Pagos
              </h2>
              <table width="100%" cellpadding="10" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;text-align:center;">
                <tr>
                  <td width="33%" style="border-right:1px solid #E2E8F0;">
                    <div style="font-size:11px;color:#64748B;font-weight:700;">INVERSIÓN TOTAL</div>
                    <div style="font-size:16px;font-weight:800;color:#1E3A5F;margin-top:4px;">${formatearMonedaMXN(montoTotal)}</div>
                  </td>
                  <td width="33%" style="border-right:1px solid #E2E8F0;">
                    <div style="font-size:11px;color:#64748B;font-weight:700;">TOTAL ABONADO</div>
                    <div style="font-size:16px;font-weight:800;color:#047857;margin-top:4px;">${formatearMonedaMXN(totalPagado)}</div>
                  </td>
                  <td width="34%">
                    <div style="font-size:11px;color:#64748B;font-weight:700;">SALDO PENDIENTE</div>
                    <div style="font-size:16px;font-weight:800;color:${estaLiquidado ? '#047857' : '#65174E'};margin-top:4px;">${formatearMonedaMXN(saldo)}</div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:8px;font-size:12px;color:#475569;display:flex;justify-content:space-between;">
                <span>Plazo entrega: <strong>${contrato.plazoDias || 7} días hábiles</strong> &nbsp;|&nbsp; Límite liquidación (2 meses): <strong>${formatearFechaLarga(fechaLimiteISO)}</strong></span>
              </div>
              <div style="margin-top:8px;padding:8px 12px;border-radius:6px;background-color:${estaLiquidado ? '#ECFDF5' : '#FDF2F8'};color:${estaLiquidado ? '#047857' : '#65174E'};font-size:12px;font-weight:700;text-align:center;">
                ${estaLiquidado ? '✅ 100% LIQUIDADO — CÓDIGO FUENTE Y ACCESOS LIBERADOS' : '🔒 CÓDIGO FUENTE EN RESGUARDO HASTA LIQUIDAR EL 100% DEL SALDO'}
              </div>
              ${
                pagos.length > 0
                  ? `<div style="margin-top:12px;">
                      <div style="font-size:11px;font-weight:700;color:#1E3A5F;text-transform:uppercase;margin-bottom:4px;">Historial de Tickets de Pago / Abonos (${pagos.length}):</div>
                      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;border-collapse:collapse;">
                        <tr style="background-color:#1A5276;color:#FFFFFF;text-align:left;">
                          <th style="padding:6px 8px;">Ticket</th>
                          <th style="padding:6px 8px;">Fecha</th>
                          <th style="padding:6px 8px;">Método</th>
                          <th style="padding:6px 8px;text-align:right;">Abono</th>
                          <th style="padding:6px 8px;text-align:right;">Restante</th>
                        </tr>
                        ${filasPagosHtml}
                      </table>
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Servicio y Requerimientos Técnicos -->
          <tr>
            <td style="padding:12px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#1E3A5F;text-transform:uppercase;border-bottom:2px solid #5DADE2;padding-bottom:6px;">
                3. Servicio y Requerimientos Técnicos Levantados
              </h2>
              <div style="background-color:#EFF6FF;border-left:4px solid #1A5276;padding:10px 14px;margin-bottom:12px;border-radius:4px;">
                <div style="font-size:11px;color:#1A5276;font-weight:700;text-transform:uppercase;">Servicio Principal Seleccionado</div>
                <div style="font-size:15px;font-weight:800;color:#1E3A5F;margin-top:2px;">${contrato.servicio}</div>
              </div>

              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:12px;margin-bottom:12px;border:1px solid #E2E8F0;border-radius:6px;">
                <tr style="background-color:#F8FAFC;">
                  <td style="font-weight:600;">¿Cuenta con Hosting y Dominio propio?</td>
                  <td align="right" style="font-weight:700;color:${entregables.hostingDominioPropio ? '#047857' : '#65174E'};">${entregables.hostingDominioPropio ? 'SÍ' : 'NO'}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;">¿Cuenta con Meta Business Suite verificado?</td>
                  <td align="right" style="font-weight:700;color:${entregables.metaBusinessVerificado ? '#047857' : '#64748B'};">${entregables.metaBusinessVerificado ? 'SÍ' : 'NO'}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="font-weight:600;">Incluye capacitación al personal</td>
                  <td align="right" style="font-weight:700;color:${entregables.incluyeCapacitacion ? '#047857' : '#64748B'};">${entregables.incluyeCapacitacion ? 'INCLUIDA' : 'NO'}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;">Incluye soporte post-entrega (30 días naturales)</td>
                  <td align="right" style="font-weight:700;color:${entregables.incluyeSoporte30Dias ? '#047857' : '#64748B'};">${entregables.incluyeSoporte30Dias ? 'INCLUIDO' : 'NO'}</td>
                </tr>
              </table>

              <div style="font-size:12px;font-weight:700;color:#1E3A5F;margin-bottom:4px;">Requerimientos específicos y dolores del negocio:</div>
              <div style="background-color:#F8FAFC;border:1px solid #CBD5E1;border-radius:6px;padding:12px;font-size:13px;line-height:1.5;color:#1E293B;white-space:pre-wrap;">${contrato.requerimientos || 'Sin requerimientos adicionales especificados.'}</div>
            </td>
          </tr>

          <!-- Cláusulas Contractuales y Promociones Acordadas -->
          <tr>
            <td style="padding:12px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#1E3A5F;text-transform:uppercase;border-bottom:2px solid #1A5276;padding-bottom:6px;">
                4. Cláusulas Contractuales, Ambientes (QA/Staging/Prod) y Promociones (${clausulasActivas.length})
              </h2>
              ${clausulasHtmlItems}
            </td>
          </tr>

          <!-- Firma Digital del Cliente Incrustada -->
          <tr>
            <td style="padding:12px 28px 28px 28px;">
              <h2 style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#65174E;text-transform:uppercase;border-bottom:2px solid #65174E;padding-bottom:6px;">
                5. Firma Digital de Conformidad del Cliente
              </h2>
              <div style="background-color:#FFFFFF;border:1px dashed #94A3B8;border-radius:8px;padding:16px;text-align:center;">
                <img src="${contrato.firmaBase64}" alt="Firma Digital de ${contrato.representante}" style="max-width:260px;max-height:110px;display:inline-block;" />
                <div style="margin-top:8px;border-top:1px solid #CBD5E1;padding-top:6px;font-size:12px;font-weight:700;color:#1E3A5F;">
                  ${contrato.representante} — ${contrato.empresa}
                </div>
                <div style="font-size:11px;color:#64748B;">Aceptación formal de las ${clausulasActivas.length} cláusulas contractuales, política de liquidación/anticipo, ambientes QA-Staging-Producción y tarifa post-garantía</div>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { asunto, html };
}

/**
 * Genera el enlace para abrir el cliente de correo nativo (Gmail / Outlook / Apple Mail)
 * con todo el resumen ejecutivo del cierre prellenado
 */
export function construirMailtoFallback(contrato, emailDestino) {
  const { asunto } = construirCorreoCierreHTML(contrato);
  const montoTotal = Number(contrato.montoTotal) || 0;
  const anticipo = Number(contrato.anticipo) || 0;
  const saldo = Math.max(0, montoTotal - anticipo);
  const clausulasActivas =
    Array.isArray(contrato.clausulas) && contrato.clausulas.length > 0
      ? contrato.clausulas.filter((c) => c.activa !== false)
      : obtenerClausulasIniciales();

  const cuerpoTexto = [
    `=== NUEVO CIERRE EN CAMPO - RCM CODEDEV ===`,
    `Folio: ${contrato.folio || contrato.id}`,
    `Fecha: ${formatearFechaLarga(contrato.fecha)}`,
    ``,
    `1. DATOS DEL CLIENTE`,
    `• Empresa: ${contrato.empresa}`,
    `• Representante: ${contrato.representante}`,
    `• WhatsApp: ${contrato.telefono}`,
    `• Correo: ${contrato.correo || 'N/A'}`,
    `• Domicilio: ${contrato.domicilio || 'N/A'}`,
    ``,
    `2. CONDICIONES ECONÓMICAS`,
    `• Servicio: ${contrato.servicio}`,
    `• Inversión Total: ${formatearMonedaMXN(montoTotal)}`,
    `• Anticipo Acordado: ${formatearMonedaMXN(anticipo)}`,
    `• Saldo Contra Entrega: ${formatearMonedaMXN(saldo)}`,
    `• Plazo Estimado: ${contrato.plazoDias || 7} días hábiles`,
    ``,
    `3. REQUERIMIENTOS TÉCNICOS`,
    `${contrato.requerimientos || 'Sin requerimientos adicionales.'}`,
    ``,
    `4. CLÁUSULAS ACEPTADAS Y FIRMADAS (${clausulasActivas.length})`,
    ...clausulasActivas.map((c, idx) => `${idx + 1}. ${c.titulo}: ${c.texto}`)
  ].join('\n');

  const destino = emailDestino && emailDestino.includes('@') ? emailDestino.trim() : '';
  return `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(
    asunto
  )}&body=${encodeURIComponent(cuerpoTexto)}`;
}

/**
 * Envía un contrato individual al proveedor de correo configurado:
 * 1) FormSubmit AJAX (envío real directo al correo del usuario sin servidor propio)
 * 2) Web3Forms API (si configuró Access Key)
 * 3) Resend API / Backend `/api/contratos/sincronizar`
 */
export async function enviarContratoIndividualAPI(contrato) {
  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet para sincronizar.');
  }

  const config = obtenerConfigSincronizacion();
  const { asunto, html } = construirCorreoCierreHTML(contrato);
  const montoTotal = Number(contrato.montoTotal) || 0;
  const anticipo = Number(contrato.anticipo) || 0;
  const saldo = Math.max(0, montoTotal - anticipo);
  const entregables = contrato.entregables || {};
  const clausulasActivas =
    Array.isArray(contrato.clausulas) && contrato.clausulas.length > 0
      ? contrato.clausulas.filter((c) => c.activa !== false)
      : obtenerClausulasIniciales();

  // Validación: Verificar que el usuario haya puesto su correo receptor real
  const correoReceptor = (config.emailDestino || '').trim();
  const tieneCorreoValido =
    correoReceptor.length > 5 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoReceptor) &&
    correoReceptor !== 'cierres@rcmcodedev.com';

  // OPCIÓN 1: Envío directo por FormSubmit.co AJAX (Funciona 100% desde el navegador / celular sin backend)
  if (config.usarFormSubmitDirecto && tieneCorreoValido) {
    const resumenClausulas = clausulasActivas
      .map((c, idx) => `${idx + 1}. ${c.titulo}: ${c.texto}`)
      .join(' | ');

    const formSubmitResponse = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(correoReceptor)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          _subject: asunto,
          _template: 'table',
          _captcha: 'false',
          ...(contrato.correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contrato.correo)
            ? { _cc: contrato.correo }
            : {}),
          Folio_Contrato: contrato.folio || `#${contrato.id}`,
          Fecha_Cierre: formatearFechaLarga(contrato.fecha),
          Empresa_Cliente: contrato.empresa,
          Representante_Legal: contrato.representante,
          Telefono_WhatsApp: contrato.telefono,
          Correo_Cliente: contrato.correo || 'No proporcionado',
          Domicilio_Municipio: contrato.domicilio || 'No proporcionado',
          Servicio_Contratado: contrato.servicio,
          Inversion_Total: formatearMonedaMXN(montoTotal),
          Anticipo_Acordado: formatearMonedaMXN(anticipo),
          Saldo_Contra_Entrega: formatearMonedaMXN(saldo),
          Plazo_Entrega_Dias_Habiles: `${contrato.plazoDias || 7} días hábiles`,
          Cuenta_Con_Hosting_Dominio: entregables.hostingDominioPropio ? 'SÍ' : 'NO',
          Meta_Business_Verificado: entregables.metaBusinessVerificado ? 'SÍ' : 'NO',
          Incluye_Capacitacion: entregables.incluyeCapacitacion ? 'SÍ' : 'NO',
          Incluye_Soporte_30_Dias: entregables.incluyeSoporte30Dias ? 'SÍ' : 'NO',
          Requerimientos_Tecnicos: contrato.requerimientos,
          Clausulas_Firmadas: resumenClausulas
        })
      }
    );

    const dataFS = await formSubmitResponse.json().catch(() => ({}));
    if (formSubmitResponse.ok && (dataFS.success === 'true' || dataFS.success === true)) {
      return {
        status: 200,
        modo: 'formsubmit_real',
        asunto,
        mensaje: `Correo enviado a ${correoReceptor}`
      };
    }

    // Si FormSubmit requiere que el usuario confirme su correo por primera vez, lanza aviso claro
    if (dataFS.message) {
      throw new Error(`FormSubmit: ${dataFS.message}`);
    }
  }

  // OPCIÓN 2: Web3Forms API (Si el usuario configuró su Access Key gratuita de web3forms.com)
  if (config.web3formsKey && config.web3formsKey.trim().length > 10) {
    const w3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        access_key: config.web3formsKey.trim(),
        subject: asunto,
        from_name: 'RCM CodeDev Cierres PWA',
        empresa: contrato.empresa,
        representante: contrato.representante,
        telefono: contrato.telefono,
        servicio: contrato.servicio,
        monto_total: formatearMonedaMXN(montoTotal),
        anticipo: formatearMonedaMXN(anticipo),
        saldo: formatearMonedaMXN(saldo),
        requerimientos: contrato.requerimientos
      })
    });

    if (w3Response.ok) {
      return { status: 200, modo: 'web3forms_real', asunto };
    }
  }

  // Si está activa la Sincronización Interna en la App (Panel Línea de Tiempo del Admin)
  // y no hay un correo externo configurado aún (o falló el correo externo), sincroniza en la bandeja interna
  if (config.sincronizacionInternaApp !== false && !tieneCorreoValido) {
    await new Promise((r) => setTimeout(r, 350));
    return {
      status: 200,
      modo: 'bandeja_interna_timeline',
      asunto,
      mensaje: 'Sincronizado en tu Línea de Tiempo Privada dentro de la App'
    };
  }
  const payload = {
    folio: contrato.folio,
    contratoId: contrato.id,
    fecha: contrato.fecha,
    destinatario: correoReceptor,
    copiaCliente: contrato.correo || null,
    asunto,
    html,
    datos: {
      empresa: contrato.empresa,
      representante: contrato.representante,
      telefono: contrato.telefono,
      correo: contrato.correo,
      domicilio: contrato.domicilio,
      servicio: contrato.servicio,
      entregables: contrato.entregables,
      requerimientos: contrato.requerimientos,
      montoTotal: contrato.montoTotal,
      anticipo: contrato.anticipo,
      saldo: contrato.saldo,
      plazoDias: contrato.plazoDias,
      clausulas: contrato.clausulas || [],
      firmaBase64: contrato.firmaBase64
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RCM-Client': 'RCM-CodeDev-PWA-1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 200 || response.ok) {
      return { status: 200, modo: 'backend_api', asunto };
    }

    if (config.modoSimulacionLocal && navigator.onLine) {
      await new Promise((r) => setTimeout(r, 600));
      return { status: 200, modo: 'simulador_online_200', asunto };
    }

    throw new Error(
      !tieneCorreoValido
        ? 'Configura tu correo electrónico real en el ícono de engrane (arriba a la derecha) para recibir los cierres.'
        : `El servidor respondió HTTP ${response.status}`
    );
  } catch (err) {
    if (config.modoSimulacionLocal && navigator.onLine) {
      await new Promise((r) => setTimeout(r, 600));
      return { status: 200, modo: 'simulador_online_200', asunto };
    }
    throw new Error(
      !tieneCorreoValido
        ? 'Ingresa tu correo real en Configuración (engrane superior derecho) para enviarte los cierres.'
        : err.message
    );
  }
}

let sincronizacionEnCurso = false;

/**
 * Cola iterativa de sincronización:
 * Toma todos los registros con `sincronizado === false` y los envía UNO A UNO.
 * Solo cuando recibe `200 OK`, actualiza `sincronizado = true` en IndexedDB.
 */
export async function procesarColaSincronizacion(onProgress) {
  if (sincronizacionEnCurso) {
    return { enCurso: true, sincronizados: 0, pendientesRestantes: 0 };
  }

  if (!navigator.onLine) {
    const pendientes = await obtenerContratosPendientes();
    return {
      sincronizados: 0,
      pendientesRestantes: pendientes.length,
      detenidosPorRed: true,
      mensaje: 'Dispositivo en modo Offline. La cola se ejecutará al recuperar señal.'
    };
  }

  sincronizacionEnCurso = true;
  let contadorSincronizados = 0;
  let detenidosPorRed = false;
  let ultimoCorreo = null;
  let errorDetalle = null;

  try {
    const colaPendientes = await obtenerContratosPendientes();
    const total = colaPendientes.length;

    for (let i = 0; i < colaPendientes.length; i++) {
      if (!navigator.onLine) {
        detenidosPorRed = true;
        break;
      }

      const contrato = colaPendientes[i];
      if (onProgress) {
        onProgress({
          actual: i + 1,
          total,
          empresa: contrato.empresa,
          folio: contrato.folio
        });
      }

      try {
        const resultado = await enviarContratoIndividualAPI(contrato);
        if (resultado && resultado.status === 200) {
          await marcarContratoSincronizado(contrato.id, {
            asuntoCorreoEnviado: resultado.asunto
          });
          contadorSincronizados++;
          ultimoCorreo = {
            empresa: contrato.empresa,
            servicio: contrato.servicio,
            asunto: resultado.asunto,
            destinatario: obtenerConfigSincronizacion().emailDestino
          };
        } else {
          detenidosPorRed = true;
          break;
        }
      } catch (errorEnvio) {
        console.warn(
          `Cola detenida en contrato ID ${contrato.id} (${contrato.empresa}):`,
          errorEnvio.message
        );
        errorDetalle = errorEnvio.message;
        detenidosPorRed = true;
        break;
      }
    }

    const restantes = await obtenerContratosPendientes();
    return {
      sincronizados: contadorSincronizados,
      pendientesRestantes: restantes.length,
      detenidosPorRed,
      ultimoCorreo,
      errorDetalle
    };
  } finally {
    sincronizacionEnCurso = false;
  }
}
