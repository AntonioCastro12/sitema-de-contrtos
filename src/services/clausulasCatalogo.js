/**
 * Catálogo oficial de Cláusulas Contractuales, Blindaje Bilateral, Pagos y Promociones de RCM CodeDev
 *
 * Incluye:
 * 1. Cláusulas base de protección mutua (Proveedor y Cliente):
 *    - Entrega de Insumos y Pausa de Cronograma (3 días hábiles).
 *    - Plazo Máximo de 2 Meses (60 días naturales) para Liquidar mediante Abonos y Retención de Código hasta Liquidación Total.
 *    - Métodos de Pago Aceptados (Efectivo, Transferencia SPEI, Tarjeta de Crédito y Débito) y Emisión de Tickets de Abono.
 *    - Falta de Liquidación, Retención de Anticipo/Abonos y Desactivación de Desarrollo.
 *    - Entrega de 3 Ligas (QA, Staging y Producción) y Ventana de Revisión.
 *    - Garantía de 1 Mes (30 días) y Evaluación Técnica de Modificaciones vs. Errores.
 *    - Tabulador de Cambios o Modificaciones Posteriores (Desde $250 MXN).
 *    - Deslinde sobre Servicios de Terceros (Meta/WhatsApp, Hosting, APIs externas).
 *    - Confidencialidad y Protección de Información del Cliente.
 */

export const METODOS_PAGO_RCM = [
  { id: 'efectivo', label: 'Efectivo', icono: '💵' },
  { id: 'transferencia', label: 'Transferencia SPEI', icono: '🏦' },
  { id: 'tarjeta_credito', label: 'Tarjeta de Crédito', icono: '💳' },
  { id: 'tarjeta_debito', label: 'Tarjeta de Débito', icono: '🏧' }
];

export const CLAUSULAS_BASE_RCM = [
  {
    id: 'clausula-insumos',
    titulo: 'Entrega de Insumos y Pausa de Cronograma (Máximo 3 Días Hábiles)',
    texto:
      'El cliente se compromete a entregar accesos, logotipos, textos y contenidos en un máximo de 3 días hábiles. El plazo estimado de entrega comenzará a correr únicamente a partir de la recepción completa de dichos insumos; cualquier demora del cliente recorrerá proporcionalmente la fecha de entrega sin penalización para RCM CodeDev.',
    activaPorDefecto: true,
    categoria: 'Operativa'
  },
  {
    id: 'clausula-plazo-2-meses-codigo',
    titulo: 'Plazo Máximo de 2 Meses para Liquidar y Liberación de Código Fuente',
    texto:
      'El cliente cuenta con un plazo máximo de 2 meses (60 días naturales) a partir de la firma de este contrato para realizar abonos parciales y liquidar el 100% del saldo total. Cada abono generará su ticket comprobante oficial foliado. El código fuente, accesos maestros y liberación definitiva del sistema se entregarán única y exclusivamente hasta el momento en que quede liquidado el total del contrato.',
    activaPorDefecto: true,
    categoria: 'Liquidación y Código'
  },
  {
    id: 'clausula-metodos-pago-tarjeta',
    titulo: 'Aceptación de Pagos con Tarjeta de Crédito, Débito, SPEI y Efectivo',
    texto:
      'El cliente podrá cubrir su anticipo, abonos parciales y liquidación final mediante Efectivo, Transferencia Interbancaria (SPEI), Tarjeta de Débito o Tarjeta de Crédito (sujeto a las condiciones o comisiones de terminal/pasarela vigentes en caso de meses o cargos con tarjeta). Todo pago registrado emitirá un Ticket Digital de Abono con el saldo actualizado.',
    activaPorDefecto: true,
    categoria: 'Pagos y Tickets'
  },
  {
    id: 'clausula-liquidacion-suspension',
    titulo: 'Falta de Liquidación, Retención de Anticipo/Abonos y Desactivación',
    texto:
      'En caso de que el cliente no liquide el saldo restante dentro del plazo máximo de 2 meses o cancele el proyecto una vez iniciado, NO se regresará el adelanto ni los abonos parciales bajo ninguna circunstancia (por concepto de ingeniería, arquitectura y horas devengadas) y se desactivará temporal o definitivamente el desarrollo y sus servidores hasta cubrir el adeudo.',
    activaPorDefecto: true,
    categoria: 'Protección Financiera'
  },
  {
    id: 'clausula-ambientes-ligas',
    titulo: 'Entrega de 3 Ligas: QA, Staging y Producción (Entrega Final)',
    texto:
      'RCM CodeDev entregará al cliente 3 ligas de seguimiento y despliegue: 1) Liga QA (Pruebas internas de calidad), 2) Liga Staging (Ambiente pre-productivo para revisión y validación del cliente) y 3) Liga de Producción, siendo esta última la entrega final y definitiva. Una vez notificada la liga Staging, el cliente contará con 5 días hábiles para reportar observaciones antes del pase final.',
    activaPorDefecto: true,
    categoria: 'Ingeniería'
  },
  {
    id: 'clausula-garantia-evaluacion',
    titulo: 'Garantía de 1 Mes (30 Días) y Evaluación Técnica de Modificaciones',
    texto:
      'El cliente cuenta con 1 mes (30 días naturales) de garantía a partir de la entrega para modificación y corrección de errores (bugs). Toda solicitud de modificación será evaluada técnicamente por RCM CodeDev para determinar si corresponde a un error del código original o si se trata de una modificación muy grande / funcionalidad nueva fuera del alcance contratado.',
    activaPorDefecto: true,
    categoria: 'Garantía'
  },
  {
    id: 'clausula-costo-cambios-post',
    titulo: 'Costo por Cambios o Modificaciones Posteriores (Desde $250 MXN)',
    texto:
      'Concluido el mes de garantía —o cuando una modificación solicitada sea grande o no corresponda a un error del sistema—, se cobrará cada cambio o modificación desde $250.00 MXN pudiendo ser más, dependiendo de la magnitud, impacto técnico y horas de programación requeridas.',
    activaPorDefecto: true,
    categoria: 'Tarifario'
  },
  {
    id: 'clausula-terceros-apis',
    titulo: 'Servicios de Terceros (Meta / WhatsApp, Hosting, Pasarelas y APIs)',
    texto:
      'RCM CodeDev garantiza la correcta programación e integración del sistema, pero no es responsable por caídas globales, cambios de políticas, bloqueos de cuentas o costos por consumo directo de proveedores externos como Meta Platforms (WhatsApp API), registradores de dominio, servidores cloud o modelos de IA.',
    activaPorDefecto: true,
    categoria: 'Deslinde Técnico'
  },
  {
    id: 'clausula-confidencialidad-datos',
    titulo: 'Confidencialidad y Protección de Información del Cliente',
    texto:
      'Para total seguridad del cliente, RCM CodeDev se obliga a guardar estricta confidencialidad sobre las bases de datos, precios, secretos comerciales, credenciales y flujos operativos proporcionados, utilizándolos exclusivamente para la ejecución de este proyecto.',
    activaPorDefecto: true,
    categoria: 'Protección al Cliente'
  },
  {
    id: 'clausula-facturacion-iva',
    titulo: 'Facturación Fiscal (CFDI) e Impuestos',
    texto:
      'Los montos expresados en este documento son en Pesos Mexicanos (MXN). En caso de que el cliente requiera factura fiscal (CFDI), se agregará el Impuesto al Valor Agregado (16% IVA) correspondiente conforme a las disposiciones fiscales vigentes.',
    activaPorDefecto: false,
    categoria: 'Fiscal'
  }
];

export const CLAUSULAS_PROMOCIONALES_SUGERIDAS = [
  {
    id: 'promo-msi-tarjeta',
    titulo: 'Promoción: Pago con Tarjeta de Crédito sin Comisión de Terminal',
    texto:
      'Por promoción autorizada en este cierre, RCM CodeDev absorbe la comisión por cobro con Tarjeta de Crédito en una sola exhibición para el pago del anticipo o liquidación.',
    categoria: 'Promoción'
  },
  {
    id: 'promo-hosting-dominio',
    titulo: 'Promoción: Hosting y Dominio .COM Anual Incluido',
    texto:
      'Por promoción comercial autorizada en campo, se incluye sin costo adicional el certificado SSL, servidor de hospedaje (Hosting) y dominio comercial por el primer año.',
    categoria: 'Promoción'
  },
  {
    id: 'promo-cambios-cortesia',
    titulo: 'Promoción: 2 Ajustes Menores Post-Garantía sin Costo',
    texto:
      'Se otorgan como cortesía comercial 2 cambios menores de texto o imagen sin costo adicional durante los primeros 60 días posteriores a la entrega en Producción.',
    categoria: 'Promoción'
  },
  {
    id: 'promo-prioridad-express',
    titulo: 'Promoción: Prioridad en Cola de Ingeniería (Fast-Track)',
    texto:
      'El proyecto ingresa con prioridad alta en el sprint de ingeniería de RCM CodeDev, habilitando la primera liga de avance (QA) en las primeras 72 horas hábiles tras recibir los insumos.',
    categoria: 'Promoción'
  }
];

/**
 * Genera el arreglo inicial de cláusulas para un nuevo cierre
 */
export function obtenerClausulasIniciales() {
  return CLAUSULAS_BASE_RCM.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    texto: c.texto,
    categoria: c.categoria,
    activa: c.activaPorDefecto
  }));
}
