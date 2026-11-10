import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { RCM_LOGO_BASE64 } from '../assets/logoBase64';
import { obtenerClausulasIniciales } from './clausulasCatalogo';
import { calcularFechaLimiteLiquidacion } from '../db/database';

// Inicialización segura de fuentes embebidas (vfs) para funcionamiento 100% offline
const vfs =
  pdfFonts?.pdfMake?.vfs ||
  pdfFonts?.default?.pdfMake?.vfs ||
  pdfFonts?.default ||
  pdfFonts;

if (pdfMake.addVirtualFileSystem) {
  pdfMake.addVirtualFileSystem(vfs);
} else {
  pdfMake.vfs = vfs;
}

/**
 * Formatea una cantidad numérica a moneda MXN ($0,000.00 MXN)
 */
export function formatearMonedaMXN(valor) {
  const num = Number(valor) || 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(num) + ' MXN';
}

/**
 * Formatea fecha ISO a texto legible en español de México
 */
export function formatearFechaLarga(fechaISO) {
  try {
    const fecha = fechaISO ? new Date(fechaISO) : new Date();
    return fecha.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return new Date().toLocaleDateString('es-MX');
  }
}

/**
 * Obtiene el arreglo normalizado de pagos de un contrato
 */
export function obtenerPagosNormalizados(contrato) {
  const montoTotal = Number(contrato.montoTotal) || 0;
  if (Array.isArray(contrato.pagos) && contrato.pagos.length > 0) {
    return contrato.pagos;
  }
  const anticipo = Number(contrato.anticipo) || 0;
  if (anticipo > 0) {
    return [
      {
        idPago: `pago-init-${contrato.id || '1'}`,
        folioTicket: `TKT-A1-${contrato.id || '001'}`,
        numeroAbono: 1,
        fecha: contrato.fecha,
        monto: anticipo,
        metodoPago: contrato.metodoPagoAnticipo || 'Transferencia SPEI',
        referencia: 'Anticipo Inicial',
        concepto: 'Anticipo Inicial de Contrato',
        saldoAnterior: montoTotal,
        saldoRestante: Math.max(0, montoTotal - anticipo)
      }
    ];
  }
  return [];
}

/**
 * Construye la definición formal del documento PDF para pdfmake (Contrato + Historial de Abonos)
 */
export function construirDefinicionPDF(contrato) {
  const montoTotal = Number(contrato.montoTotal) || 0;
  const pagos = obtenerPagosNormalizados(contrato);
  const totalPagado =
    contrato.totalPagado !== undefined
      ? Number(contrato.totalPagado)
      : pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const saldo = Math.max(0, montoTotal - totalPagado);
  const estaLiquidado = saldo <= 0 && montoTotal > 0;

  const folio = contrato.folio || `RCM-${contrato.id || '001'}`;
  const fechaTexto = formatearFechaLarga(contrato.fecha);
  const fechaLimiteISO =
    contrato.fechaLimiteLiquidacion || calcularFechaLimiteLiquidacion(contrato.fecha);
  const fechaLimiteTexto = formatearFechaLarga(fechaLimiteISO);

  const entregables = contrato.entregables || {};
  const clausulasActivas =
    Array.isArray(contrato.clausulas) && contrato.clausulas.length > 0
      ? contrato.clausulas.filter((c) => c.activa !== false)
      : obtenerClausulasIniciales();

  const stackClausulasPDF = clausulasActivas.map((c, idx) => ({
    text: [
      {
        text: `• Cláusula ${idx + 1} (${c.titulo}): `,
        bold: true,
        color: c.categoria === 'Promoción' ? '#65174E' : '#1E3A5F'
      },
      c.texto
    ],
    style: 'clauseText'
  }));

  const tablaEntregables = [
    [
      { text: 'Concepto / Insumo Técnico', style: 'tableHeader' },
      { text: 'Estado Acordado', style: 'tableHeader', alignment: 'center' }
    ],
    [
      { text: '¿El cliente cuenta con Hosting y Dominio propio?', style: 'tableCell' },
      {
        text: entregables.hostingDominioPropio ? 'SÍ CUENTA CON ÉL' : 'NO (Por gestionar / Incluido)',
        style: 'tableCellBold',
        color: entregables.hostingDominioPropio ? '#1A5276' : '#65174E',
        alignment: 'center'
      }
    ],
    [
      { text: '¿Cuenta con Meta Business Suite verificado?', style: 'tableCell' },
      {
        text: entregables.metaBusinessVerificado ? 'SÍ VERIFICADO' : 'NO VERIFICADO',
        style: 'tableCellBold',
        color: entregables.metaBusinessVerificado ? '#1A5276' : '#64748B',
        alignment: 'center'
      }
    ],
    [
      { text: 'Incluye capacitación operativa al personal', style: 'tableCell' },
      {
        text: entregables.incluyeCapacitacion ? 'INCLUIDA' : 'NO INCLUIDA',
        style: 'tableCellBold',
        color: entregables.incluyeCapacitacion ? '#047857' : '#64748B',
        alignment: 'center'
      }
    ],
    [
      { text: 'Incluye soporte técnico post-entrega (30 días naturales)', style: 'tableCell' },
      {
        text: entregables.incluyeSoporte30Dias ? 'INCLUIDO (30 DÍAS)' : 'NO INCLUIDO',
        style: 'tableCellBold',
        color: entregables.incluyeSoporte30Dias ? '#047857' : '#64748B',
        alignment: 'center'
      }
    ]
  ];

  // Tabla de Historial de Pagos / Abonos para el PDF
  const filasHistorialPagos = [
    [
      { text: 'Ticket / Folio', style: 'tableHeader' },
      { text: 'Fecha', style: 'tableHeader' },
      { text: 'Concepto', style: 'tableHeader' },
      { text: 'Método de Pago', style: 'tableHeader' },
      { text: 'Monto Abonado', style: 'tableHeader', alignment: 'right' },
      { text: 'Saldo Restante', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  if (pagos.length > 0) {
    pagos.forEach((p, idx) => {
      filasHistorialPagos.push([
        { text: p.folioTicket || `TKT-${idx + 1}`, style: 'tableCellBold', color: '#1E3A5F' },
        { text: formatearFechaLarga(p.fecha), style: 'tableCell' },
        { text: p.concepto || `Abono #${idx + 1}`, style: 'tableCell' },
        { text: `${p.metodoPago || 'Efectivo'}${p.referencia ? ` (${p.referencia})` : ''}`, style: 'tableCell' },
        {
          text: formatearMonedaMXN(p.monto),
          style: 'tableCellBold',
          color: '#047857',
          alignment: 'right'
        },
        {
          text: formatearMonedaMXN(p.saldoRestante),
          style: 'tableCellBold',
          color: Number(p.saldoRestante) === 0 ? '#047857' : '#65174E',
          alignment: 'right'
        }
      ]);
    });
  } else {
    filasHistorialPagos.push([
      {
        text: 'Sin abonos registrados aún.',
        style: 'tableCell',
        colSpan: 6,
        alignment: 'center'
      },
      {},
      {},
      {},
      {},
      {}
    ]);
  }

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 34, 40, 46],
    info: {
      title: `Contrato_${folio}_${contrato.empresa}`,
      author: 'RCM CodeDev - Agencia de Desarrollo de Software y Automatización',
      subject: `Contrato de Prestación de Servicios Tecnológicos - ${contrato.servicio}`,
      keywords: 'RCM CodeDev, Contrato, Software, Automatización, Firma Digital, Abonos'
    },
    footer: (currentPage, pageCount) => ({
      margin: [40, 10, 40, 0],
      columns: [
        {
          text: `RCM CodeDev • Folio: ${folio} • Código fuente: ${
            estaLiquidado ? 'LIBERADO (100% Liquidado)' : 'EN RESGUARDO HASTA LIQUIDAR SALDO'
          }`,
          fontSize: 7.5,
          color: '#64748B'
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'right',
          fontSize: 7.5,
          color: '#64748B'
        }
      ]
    }),
    content: [
      // MEMBRETE CORPORATIVO RCM CODEDEV
      {
        table: {
          widths: [72, '*', 150],
          body: [
            [
              {
                image: RCM_LOGO_BASE64,
                width: 65,
                alignment: 'left',
                border: [false, false, false, false]
              },
              {
                stack: [
                  { text: 'RCM CODEDEV', fontSize: 15, bold: true, color: '#1E3A5F' },
                  {
                    text: 'AGENCIA DE DESARROLLO DE SOFTWARE Y AUTOMATIZACIÓN',
                    fontSize: 7.5,
                    bold: true,
                    color: '#65174E',
                    margin: [0, 2, 0, 3]
                  },
                  {
                    text: 'Soluciones Web, Bots con IA, Sistemas a la Medida y Transformación Digital',
                    fontSize: 7.5,
                    color: '#475569'
                  }
                ],
                margin: [6, 3, 0, 0],
                border: [false, false, false, false]
              },
              {
                stack: [
                  {
                    text: 'CONTRATO Y ESTADO DE CUENTA',
                    fontSize: 8.5,
                    bold: true,
                    color: '#FFFFFF',
                    alignment: 'center'
                  },
                  {
                    text: `FOLIO: ${folio}`,
                    fontSize: 9,
                    bold: true,
                    color: '#5DADE2',
                    alignment: 'center',
                    margin: [0, 2, 0, 2]
                  },
                  {
                    text: fechaTexto,
                    fontSize: 7,
                    color: '#E2E8F0',
                    alignment: 'center'
                  }
                ],
                fillColor: '#1E3A5F',
                margin: [6, 6, 6, 6],
                border: [false, false, false, false]
              }
            ]
          ]
        },
        layout: 'noBorders'
      },

      // Barra divisoria corporativa tricolor
      {
        canvas: [
          { type: 'rect', x: 0, y: 4, w: 350, h: 3, color: '#1A5276' },
          { type: 'rect', x: 350, y: 4, w: 100, h: 3, color: '#5DADE2' },
          { type: 'rect', x: 450, y: 4, w: 82, h: 3, color: '#65174E' }
        ],
        margin: [0, 2, 0, 10]
      },

      // INTRODUCCIÓN LEGAL
      {
        text: [
          'CONTRATO DE PRESTACIÓN DE SERVICIOS TECNOLÓGICOS Y ORDEN DE TRABAJO QUE CELEBRAN POR UNA PARTE ',
          { text: 'RCM CODEDEV', bold: true, color: '#1E3A5F' },
          ' ("EL PROVEEDOR") Y POR LA OTRA PARTE ',
          { text: (contrato.empresa || '').toUpperCase(), bold: true, color: '#1E3A5F' },
          ', REPRESENTADA EN ESTE ACTO POR ',
          { text: (contrato.representante || '').toUpperCase(), bold: true, color: '#65174E' },
          ' ("EL CLIENTE"), AL TENOR DE LAS SIGUIENTES ESPECIFICACIONES Y CLÁUSULAS:'
        ],
        fontSize: 8,
        lineHeight: 1.25,
        alignment: 'justify',
        margin: [0, 0, 0, 8]
      },

      // SECCIÓN 1: DATOS DEL CLIENTE
      {
        text: '1. DATOS GENERALES DEL CLIENTE / PROSPECTO',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['26%', '24%', '22%', '28%'],
          body: [
            [
              { text: 'Nombre Comercial / Empresa:', style: 'labelCell' },
              { text: contrato.empresa || 'N/A', style: 'valueCellBold', colSpan: 3 },
              {},
              {}
            ],
            [
              { text: 'Representante / Decisor:', style: 'labelCell' },
              { text: contrato.representante || 'N/A', style: 'valueCell' },
              { text: 'WhatsApp / Teléfono:', style: 'labelCell' },
              { text: contrato.telefono || 'N/A', style: 'valueCellBold' }
            ],
            [
              { text: 'Correo Electrónico:', style: 'labelCell' },
              { text: contrato.correo || 'No especificado', style: 'valueCell' },
              { text: 'Domicilio / Municipio:', style: 'labelCell' },
              { text: contrato.domicilio || 'No especificado', style: 'valueCell' }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1'
        },
        margin: [0, 0, 0, 10]
      },

      // SECCIÓN 2: SERVICIO Y ALCANCE TÉCNICO
      {
        text: '2. SERVICIO CONTRATADO Y CHECKLIST DE ENTREGABLES / INSUMOS',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [
              { text: 'SOLUCIÓN TECNOLÓGICA:', style: 'labelCell', fillColor: '#F1F5F9' },
              {
                text: contrato.servicio || 'Servicio de Desarrollo RCM CodeDev',
                fontSize: 10,
                bold: true,
                color: '#65174E',
                margin: [6, 4, 6, 4]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.75,
          vLineWidth: () => 0.75,
          hLineColor: () => '#1A5276',
          vLineColor: () => '#1A5276'
        },
        margin: [0, 0, 0, 5]
      },
      {
        table: {
          widths: ['70%', '30%'],
          body: tablaEntregables
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1'
        },
        margin: [0, 0, 0, 6]
      },

      // REQUERIMIENTOS ESPECÍFICOS
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'REQUERIMIENTOS ESPECÍFICOS, INTEGRACIONES Y DOLORES DEL NEGOCIO:',
                fontSize: 8,
                bold: true,
                color: '#1E3A5F',
                fillColor: '#EFF6FF',
                margin: [6, 3, 6, 3]
              }
            ],
            [
              {
                text:
                  contrato.requerimientos && contrato.requerimientos.trim().length > 0
                    ? contrato.requerimientos
                    : 'Requerimientos estándar de acuerdo con el paquete seleccionado.',
                fontSize: 8,
                color: '#1E293B',
                lineHeight: 1.2,
                margin: [6, 5, 6, 5]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#93C5FD',
          vLineColor: () => '#93C5FD'
        },
        margin: [0, 0, 0, 10]
      },

      // SECCIÓN 3: CONDICIONES ECONÓMICAS, HISTORIAL DE ABONOS Y PLAZO MÁXIMO DE 2 MESES
      {
        text: '3. CONDICIONES ECONÓMICAS, ABONOS Y PLAZO MÁXIMO DE LIQUIDACIÓN (2 MESES)',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'INVERSIÓN TOTAL', style: 'econHeader', fillColor: '#1E3A5F' },
              { text: 'TOTAL ABONADO', style: 'econHeader', fillColor: '#047857' },
              { text: 'SALDO PENDIENTE', style: 'econHeader', fillColor: '#65174E' },
              { text: 'ENTREGA / CÓDIGO', style: 'econHeader', fillColor: '#0F172A' }
            ],
            [
              {
                text: formatearMonedaMXN(montoTotal),
                style: 'econValue',
                color: '#1E3A5F'
              },
              {
                text: formatearMonedaMXN(totalPagado),
                style: 'econValue',
                color: '#047857'
              },
              {
                text: formatearMonedaMXN(saldo),
                style: 'econValue',
                color: saldo === 0 ? '#047857' : '#65174E'
              },
              {
                text: estaLiquidado
                  ? '100% LIQUIDADO\nCÓDIGO LIBERADO'
                  : `${contrato.plazoDias || 7} Días Hábiles\nCódigo en Resguardo`,
                fontSize: 8,
                bold: true,
                alignment: 'center',
                color: estaLiquidado ? '#047857' : '#65174E',
                margin: [4, 5, 4, 5]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1'
        },
        margin: [0, 0, 0, 6]
      },

      // Aviso de Plazo de 2 Meses para Liquidar y Liberación de Código
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: [
                  {
                    text: 'PLAZO LÍMITE DE LIQUIDACIÓN (2 MESES / 60 DÍAS): ',
                    bold: true,
                    color: '#65174E'
                  },
                  `Fecha máxima para liquidar el total: ${fechaLimiteTexto}. `,
                  {
                    text: 'Se aceptan pagos en Efectivo, Transferencia SPEI, Tarjeta de Débito y Tarjeta de Crédito. El código fuente y accesos maestros se entregan únicamente al liquidar el 100% del proyecto.',
                    bold: true,
                    color: '#1E3A5F'
                  }
                ],
                fontSize: 7.5,
                fillColor: '#FDF2F8',
                margin: [6, 4, 6, 4]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#FBCFE8',
          vLineColor: () => '#FBCFE8'
        },
        margin: [0, 0, 0, 6]
      },

      // Tabla desglosada de Pagos / Abonos registrados
      {
        table: {
          widths: ['16%', '18%', '22%', '18%', '13%', '13%'],
          body: filasHistorialPagos
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1'
        },
        margin: [0, 0, 0, 10]
      },

      // SECCIÓN 4: CLÁUSULAS CONTRACTUALES, AMBIENTES Y PROMOCIONES
      {
        text: '4. CLÁUSULAS CONTRACTUALES, AMBIENTES (QA / STAGING / PRODUCCIÓN), GARANTÍA Y PROMOCIONES',
        style: 'sectionHeader'
      },
      {
        stack: stackClausulasPDF,
        margin: [4, 2, 4, 12]
      },

      // SECCIÓN 5: FIRMAS DE CONFORMIDAD
      {
        unbreakable: true,
        table: {
          widths: ['48%', '4%', '48%'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'POR "EL PROVEEDOR"',
                    fontSize: 8,
                    bold: true,
                    color: '#64748B',
                    alignment: 'center',
                    margin: [0, 4, 0, 12]
                  },
                  {
                    text: 'RCM CodeDev',
                    fontSize: 13,
                    bold: true,
                    color: '#1E3A5F',
                    alignment: 'center',
                    margin: [0, 10, 0, 4]
                  },
                  {
                    text: 'Dirección de Ingeniería y Operaciones Comerciales',
                    fontSize: 7.5,
                    color: '#5DADE2',
                    bold: true,
                    alignment: 'center',
                    margin: [0, 0, 0, 12]
                  },
                  {
                    canvas: [
                      { type: 'line', x1: 20, y1: 0, x2: 215, y2: 0, lineWidth: 1, lineColor: '#94A3B8' }
                    ]
                  },
                  {
                    text: 'RCM CODEDEV - REPRESENTACIÓN COMERCIAL',
                    fontSize: 8,
                    bold: true,
                    color: '#1E293B',
                    alignment: 'center',
                    margin: [0, 4, 0, 2]
                  },
                  {
                    text: 'Autorización Digital Pre-aprobada',
                    fontSize: 7.5,
                    color: '#64748B',
                    alignment: 'center'
                  }
                ],
                fillColor: '#F8FAFC',
                margin: [6, 6, 6, 6]
              },
              { text: '', border: [false, false, false, false] },
              {
                stack: [
                  {
                    text: 'ACEPTACIÓN Y FIRMA DE "EL CLIENTE"',
                    fontSize: 8,
                    bold: true,
                    color: '#65174E',
                    alignment: 'center',
                    margin: [0, 4, 0, 4]
                  },
                  contrato.firmaBase64
                    ? {
                        image: contrato.firmaBase64,
                        width: 145,
                        height: 56,
                        alignment: 'center',
                        margin: [0, 2, 0, 4]
                      }
                    : {
                        text: '[Firma Digital Registrada]',
                        fontSize: 9,
                        italics: true,
                        alignment: 'center',
                        margin: [0, 22, 0, 18]
                      },
                  {
                    canvas: [
                      { type: 'line', x1: 20, y1: 0, x2: 215, y2: 0, lineWidth: 1, lineColor: '#1E3A5F' }
                    ]
                  },
                  {
                    text: (contrato.representante || 'Representante Autorizado').toUpperCase(),
                    fontSize: 8.5,
                    bold: true,
                    color: '#1E3A5F',
                    alignment: 'center',
                    margin: [0, 4, 0, 1]
                  },
                  {
                    text: (contrato.empresa || '').toUpperCase(),
                    fontSize: 7.5,
                    bold: true,
                    color: '#475569',
                    alignment: 'center'
                  }
                ],
                fillColor: '#F8FAFC',
                margin: [6, 6, 6, 6]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1'
        }
      }
    ],
    styles: {
      sectionHeader: {
        fontSize: 9,
        bold: true,
        color: '#1E3A5F',
        margin: [0, 2, 0, 4]
      },
      labelCell: {
        fontSize: 7.5,
        bold: true,
        color: '#475569',
        fillColor: '#F8FAFC',
        margin: [4, 3, 4, 3]
      },
      valueCell: {
        fontSize: 8,
        color: '#0F172A',
        margin: [4, 3, 4, 3]
      },
      valueCellBold: {
        fontSize: 8,
        bold: true,
        color: '#1E3A5F',
        margin: [4, 3, 4, 3]
      },
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#1A5276',
        margin: [4, 3, 4, 3]
      },
      tableCell: {
        fontSize: 7.5,
        color: '#334155',
        margin: [4, 3, 4, 3]
      },
      tableCellBold: {
        fontSize: 7.5,
        bold: true,
        margin: [4, 3, 4, 3]
      },
      econHeader: {
        fontSize: 7,
        bold: true,
        color: '#FFFFFF',
        alignment: 'center',
        margin: [3, 4, 3, 4]
      },
      econValue: {
        fontSize: 9,
        bold: true,
        alignment: 'center',
        margin: [3, 6, 3, 6]
      },
      clauseText: {
        fontSize: 7.5,
        color: '#334155',
        lineHeight: 1.2,
        margin: [0, 1.5, 0, 2.5]
      }
    }
  };

  return docDefinition;
}

/**
 * Construye y descarga un TICKET COMPROBANTE DE PAGO / ABONO en PDF (formato recibo ejecutivo)
 * cada vez que el cliente realiza un abono o liquida con Efectivo, SPEI o Tarjeta de Crédito/Débito.
 */
export function descargarTicketAbonoPDF(contrato, ticketPago) {
  return new Promise((resolve, reject) => {
    try {
      const montoTotal = Number(contrato.montoTotal) || 0;
      const folioContrato = contrato.folio || `RCM-${contrato.id || '001'}`;
      const folioTicket = ticketPago.folioTicket || `TKT-${ticketPago.numeroAbono || 1}`;
      const saldoRestante = Number(ticketPago.saldoRestante) || 0;
      const estaLiquidado = saldoRestante <= 0;
      const fechaLimiteISO =
        contrato.fechaLimiteLiquidacion || calcularFechaLimiteLiquidacion(contrato.fecha);

      const docDefinition = {
        pageSize: { width: 320, height: 540 }, // Formato Ticket / Comprobante Digital Móvil
        pageMargins: [18, 18, 18, 18],
        info: {
          title: `Ticket_${folioTicket}_${contrato.empresa}`,
          author: 'RCM CodeDev',
          subject: `Comprobante de Abono #${ticketPago.numeroAbono} - ${contrato.empresa}`
        },
        content: [
          // Encabezado del Ticket
          {
            table: {
              widths: [46, '*'],
              body: [
                [
                  {
                    image: RCM_LOGO_BASE64,
                    width: 42,
                    border: [false, false, false, false]
                  },
                  {
                    stack: [
                      { text: 'RCM CODEDEV', fontSize: 12, bold: true, color: '#1E3A5F' },
                      {
                        text: 'COMPROBANTE OFICIAL DE PAGO / ABONO',
                        fontSize: 7.5,
                        bold: true,
                        color: '#65174E'
                      },
                      {
                        text: `Ticket Folio: ${folioTicket}`,
                        fontSize: 8.5,
                        bold: true,
                        color: '#1A5276',
                        margin: [0, 2, 0, 0]
                      }
                    ],
                    border: [false, false, false, false]
                  }
                ]
              ]
            },
            layout: 'noBorders'
          },

          {
            canvas: [
              { type: 'line', x1: 0, y1: 6, x2: 284, y2: 6, lineWidth: 1.5, lineColor: '#1E3A5F' }
            ],
            margin: [0, 2, 0, 8]
          },

          // Datos del Contrato y Cliente
          {
            table: {
              widths: ['38%', '62%'],
              body: [
                [
                  { text: 'Fecha de Pago:', fontSize: 7.5, bold: true, color: '#64748B' },
                  { text: formatearFechaLarga(ticketPago.fecha), fontSize: 7.5, bold: true, color: '#0F172A' }
                ],
                [
                  { text: 'Folio Contrato:', fontSize: 7.5, bold: true, color: '#64748B' },
                  { text: folioContrato, fontSize: 8, bold: true, color: '#1E3A5F' }
                ],
                [
                  { text: 'Empresa / Cliente:', fontSize: 7.5, bold: true, color: '#64748B' },
                  { text: contrato.empresa, fontSize: 8, bold: true, color: '#0F172A' }
                ],
                [
                  { text: 'Representante:', fontSize: 7.5, bold: true, color: '#64748B' },
                  { text: contrato.representante, fontSize: 7.5, color: '#334155' }
                ],
                [
                  { text: 'Servicio:', fontSize: 7.5, bold: true, color: '#64748B' },
                  { text: contrato.servicio, fontSize: 7.5, bold: true, color: '#65174E' }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 8]
          },

          // Recuadro Principal del Monto Abonado y Método (Efectivo / SPEI / Tarjeta Crédito-Débito)
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        text: `ABONO #${ticketPago.numeroAbono || 1} RECIBIDO (${(
                          ticketPago.metodoPago || 'Efectivo'
                        ).toUpperCase()})`,
                        fontSize: 8,
                        bold: true,
                        color: '#FFFFFF',
                        alignment: 'center'
                      },
                      {
                        text: formatearMonedaMXN(ticketPago.monto),
                        fontSize: 16,
                        bold: true,
                        color: '#5DADE2',
                        alignment: 'center',
                        margin: [0, 3, 0, 2]
                      },
                      {
                        text: `${ticketPago.concepto || 'Abono a cuenta'} • Ref: ${
                          ticketPago.referencia || 'N/A'
                        }`,
                        fontSize: 7,
                        color: '#E2E8F0',
                        alignment: 'center'
                      }
                    ],
                    fillColor: '#1E3A5F',
                    margin: [8, 8, 8, 8]
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 8]
          },

          // Desglose de Saldos (Anterior -> Abono -> Restante)
          {
            table: {
              widths: ['55%', '45%'],
              body: [
                [
                  { text: 'Inversión Total del Contrato:', fontSize: 7.5, color: '#475569' },
                  {
                    text: formatearMonedaMXN(montoTotal),
                    fontSize: 7.5,
                    bold: true,
                    alignment: 'right',
                    color: '#1E3A5F'
                  }
                ],
                [
                  { text: 'Saldo Anterior:', fontSize: 7.5, color: '#475569' },
                  {
                    text: formatearMonedaMXN(ticketPago.saldoAnterior),
                    fontSize: 7.5,
                    alignment: 'right',
                    color: '#475569'
                  }
                ],
                [
                  { text: '(-) Monto de este Abono:', fontSize: 8, bold: true, color: '#047857' },
                  {
                    text: `- ${formatearMonedaMXN(ticketPago.monto)}`,
                    fontSize: 8,
                    bold: true,
                    alignment: 'right',
                    color: '#047857'
                  }
                ],
                [
                  {
                    text: 'SALDO PENDIENTE POR LIQUIDAR:',
                    fontSize: 8.5,
                    bold: true,
                    color: estaLiquidado ? '#047857' : '#65174E'
                  },
                  {
                    text: formatearMonedaMXN(saldoRestante),
                    fontSize: 9.5,
                    bold: true,
                    alignment: 'right',
                    color: estaLiquidado ? '#047857' : '#65174E'
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: (i) => (i === 3 ? 1 : 0.4),
              vLineWidth: () => 0,
              hLineColor: () => '#CBD5E1'
            },
            margin: [0, 0, 0, 8]
          },

          // Estado de Liberación del Código Fuente y Plazo de 2 Meses
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        text: estaLiquidado
                          ? '✅ PROYECTO 100% LIQUIDADO — CÓDIGO FUENTE Y ACCESOS LIBERADOS'
                          : '🔒 CÓDIGO FUENTE EN RESGUARDO HASTA LIQUIDAR EL 100%',
                        fontSize: 7.5,
                        bold: true,
                        color: estaLiquidado ? '#047857' : '#65174E',
                        alignment: 'center'
                      },
                      {
                        text: estaLiquidado
                          ? 'El cliente ha cubierto la totalidad del contrato. Se autoriza la entrega definitiva del código fuente y accesos de Producción.'
                          : `Fecha límite para liquidar (Plazo 2 meses): ${formatearFechaLarga(
                              fechaLimiteISO
                            )}. El código fuente se entrega únicamente al liquidar el saldo total.`,
                        fontSize: 6.8,
                        color: '#334155',
                        alignment: 'center',
                        margin: [0, 2, 0, 0]
                      }
                    ],
                    fillColor: estaLiquidado ? '#ECFDF5' : '#FDF2F8',
                    margin: [6, 5, 6, 5]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => (estaLiquidado ? '#6EE7B7' : '#FBCFE8'),
              vLineColor: () => (estaLiquidado ? '#6EE7B7' : '#FBCFE8')
            },
            margin: [0, 0, 0, 8]
          },

          // Firma del Cliente y Sello Digital
          {
            columns: [
              {
                width: '50%',
                stack: [
                  {
                    text: 'RCM CodeDev',
                    fontSize: 9,
                    bold: true,
                    color: '#1E3A5F',
                    alignment: 'center',
                    margin: [0, 12, 0, 2]
                  },
                  {
                    text: 'Sello Digital de Caja',
                    fontSize: 6.5,
                    color: '#64748B',
                    alignment: 'center'
                  }
                ]
              },
              {
                width: '50%',
                stack: [
                  contrato.firmaBase64
                    ? {
                        image: contrato.firmaBase64,
                        width: 85,
                        height: 34,
                        alignment: 'center'
                      }
                    : { text: '', margin: [0, 14, 0, 14] },
                  {
                    text: contrato.representante,
                    fontSize: 7,
                    bold: true,
                    color: '#1E3A5F',
                    alignment: 'center'
                  },
                  {
                    text: 'Conformidad Cliente',
                    fontSize: 6.5,
                    color: '#64748B',
                    alignment: 'center'
                  }
                ]
              }
            ]
          }
        ]
      };

      const nombreLimpio = (contrato.empresa || 'Cliente')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/__+/g, '_');
      const fileName = `Ticket_${folioTicket}_${nombreLimpio}.pdf`;

      pdfMake.createPdf(docDefinition).download(fileName, () => {
        resolve(fileName);
      });
    } catch (error) {
      console.error('Error al generar Ticket PDF:', error);
      reject(error);
    }
  });
}

/**
 * Genera y descarga el archivo PDF del Contrato directamente en el dispositivo móvil o navegador
 */
export function descargarContratoPDF(contrato) {
  return new Promise((resolve, reject) => {
    try {
      const docDefinition = construirDefinicionPDF(contrato);
      const nombreLimpio = (contrato.empresa || 'Cliente')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/__+/g, '_');
      const folio = contrato.folio || `RCM-${contrato.id || '001'}`;
      const fileName = `Contrato_RCM_${nombreLimpio}_${folio}.pdf`;

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.download(fileName, () => {
        resolve(fileName);
      });
    } catch (error) {
      console.error('Error al generar PDF con pdfmake:', error);
      reject(error);
    }
  });
}
