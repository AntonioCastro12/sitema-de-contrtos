/**
 * Serverless Function / Backend Endpoint de referencia:
 * Ruta: POST /api/contratos/sincronizar
 *
 * Recibe un registro individual de la cola de sincronización de RCM CodeDev PWA
 * y envía el correo electrónico detallado (con la firma Base64 incrustada) mediante Resend API.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { folio, destinatario, copiaCliente, asunto, html, datos } = body;

    if (!datos || !datos.empresa || !datos.servicio) {
      return res.status(400).json({ error: 'Datos de contrato incompletos.' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_TO = destinatario || process.env.NOTIFY_EMAIL || 'cierres@rcmcodedev.com';
    const EMAIL_FROM = process.env.EMAIL_FROM || 'RCM CodeDev Cierres <notificaciones@rcmcodedev.com>';

    // Si hay RESEND_API_KEY configurada en el servidor, realiza el disparo real a Resend
    if (RESEND_API_KEY) {
      const destinatarios = [EMAIL_TO];
      if (copiaCliente && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(copiaCliente)) {
        destinatarios.push(copiaCliente);
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: destinatarios,
          subject: asunto || `📋 Nuevo Cierre en Campo: ${datos.empresa} - ${datos.servicio}`,
          html
        })
      });

      if (!resendResponse.ok) {
        const errText = await resendResponse.text();
        return res.status(502).json({
          error: 'Error al enviar correo mediante proveedor SMTP/Resend',
          details: errText
        });
      }

      const data = await resendResponse.json();
      return res.status(200).json({
        ok: true,
        folio,
        emailId: data.id,
        mensaje: 'Cierre sincronizado y notificado por correo exitosamente.'
      });
    }

    // Respuesta 200 OK cuando se ejecuta sin clave externa configurada
    return res.status(200).json({
      ok: true,
      folio,
      asunto,
      mensaje: 'Cierre recibido y procesado correctamente (200 OK).'
    });
  } catch (error) {
    console.error('Error en /api/contratos/sincronizar:', error);
    return res.status(500).json({ error: 'Error interno del servidor al sincronizar cierre.' });
  }
}
