import { getStore } from '@netlify/blobs';

const STORE_NAME = 'rcm-codedev-cloud-sync';
const KEY_DATA = 'estado_global_rcm_v1';

/**
 * Compara dos versiones del mismo contrato (mismo folio) y devuelve la más completa / reciente
 */
function elegirContratoMasReciente(local, entrante) {
  if (!local) return { ...entrante, sincronizado: true };
  if (!entrante) return { ...local, sincronizado: true };

  const pagosLocal = Array.isArray(local.pagos) ? local.pagos.length : 0;
  const pagosEntrante = Array.isArray(entrante.pagos) ? entrante.pagos.length : 0;

  const fechaModLocal = new Date(local.ultimaModificacion || local.fecha || 0).getTime();
  const fechaModEntrante = new Date(entrante.ultimaModificacion || entrante.fecha || 0).getTime();

  const ganador =
    fechaModEntrante >= fechaModLocal || pagosEntrante > pagosLocal
      ? { ...local, ...entrante }
      : { ...entrante, ...local };

  // Conservar la lista de pagos más completa
  if (pagosEntrante > pagosLocal) {
    ganador.pagos = entrante.pagos;
    ganador.totalPagado = entrante.totalPagado;
    ganador.saldo = entrante.saldo;
    ganador.liquidado = entrante.liquidado;
    ganador.codigoLiberado = entrante.codigoLiberado;
  } else if (pagosLocal > pagosEntrante) {
    ganador.pagos = local.pagos;
    ganador.totalPagado = local.totalPagado;
    ganador.saldo = local.saldo;
    ganador.liquidado = local.liquidado;
    ganador.codigoLiberado = local.codigoLiberado;
  }

  ganador.sincronizado = true;
  return ganador;
}

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore(STORE_NAME);
    let estadoActual = await store.get(KEY_DATA, { type: 'json' });

    if (!estadoActual || typeof estadoActual !== 'object') {
      estadoActual = {
        contratosPorFolio: {},
        inversiones: {
          porcentajeReinversion: 15,
          partidas: [],
          updatedAt: null
        },
        updatedAt: new Date().toISOString()
      };
    }

    // GET: Descargar todos los contratos e inversiones de la nube al dispositivo (Celular o Laptop)
    if (req.method === 'GET') {
      const listaContratos = Object.values(estadoActual.contratosPorFolio || {}).sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha)
      );

      return new Response(
        JSON.stringify({
          ok: true,
          contratos: listaContratos,
          inversiones: estadoActual.inversiones || { porcentajeReinversion: 15, partidas: [] },
          updatedAt: estadoActual.updatedAt
        }),
        { status: 200, headers }
      );
    }

    // POST: Subir cambios del dispositivo y fusionarlos con la nube
    if (req.method === 'POST') {
      const body = await req.json();
      const contratosEntrantes = Array.isArray(body.contratos) ? body.contratos : [];
      const inversionesEntrantes = body.inversiones || null;

      const mapa = { ...(estadoActual.contratosPorFolio || {}) };

      for (const c of contratosEntrantes) {
        if (!c) continue;
        const claveFolio = c.folio || `RCM-ID-${c.id}-${c.fecha}`;
        mapa[claveFolio] = elegirContratoMasReciente(mapa[claveFolio], {
          ...c,
          folio: claveFolio
        });
      }

      // Fusionar inversiones si el cliente envió cambios de inversión
      let inversionesFinales = estadoActual.inversiones || {
        porcentajeReinversion: 15,
        partidas: [],
        updatedAt: null
      };

      if (inversionesEntrantes && typeof inversionesEntrantes === 'object') {
        const fechaEntrante = new Date(inversionesEntrantes.updatedAt || 0).getTime();
        const fechaActual = new Date(inversionesFinales.updatedAt || 0).getTime();

        if (fechaEntrante >= fechaActual) {
          inversionesFinales = {
            porcentajeReinversion:
              typeof inversionesEntrantes.porcentajeReinversion === 'number'
                ? inversionesEntrantes.porcentajeReinversion
                : inversionesFinales.porcentajeReinversion,
            partidas: Array.isArray(inversionesEntrantes.partidas)
              ? inversionesEntrantes.partidas
              : inversionesFinales.partidas,
            updatedAt: inversionesEntrantes.updatedAt || new Date().toISOString()
          };
        }
      }

      const nuevoEstado = {
        contratosPorFolio: mapa,
        inversiones: inversionesFinales,
        updatedAt: new Date().toISOString()
      };

      await store.setJSON(KEY_DATA, nuevoEstado);

      const listaFusionada = Object.values(mapa).sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha)
      );

      return new Response(
        JSON.stringify({
          ok: true,
          contratos: listaFusionada,
          inversiones: inversionesFinales,
          updatedAt: nuevoEstado.updatedAt
        }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
      headers
    });
  } catch (error) {
    console.error('Error en función de sincronización cloud:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Error interno en Netlify Blobs'
      }),
      { status: 500, headers }
    );
  }
};
