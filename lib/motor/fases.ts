/**
 * Fechas, cumplimiento y observaciones de las 6 fases de obra (D-52).
 * Cumplir una fase mueve la unidad por los estados de siempre con
 * avanzarEstadoOperativo / avanzarInstalacion: si falta un requisito (pagado,
 * acabados, acta), el motor lo dice y la fase no se marca.
 */

import type { Fase, Rol } from "@prisma/client";
import { prisma } from "../prisma";
import { FASE, FASES, PASOS_DE_FASE, estaCumplida, yaEsta } from "../fases";
import { avanzarEstadoOperativo, avanzarInstalacion } from "./obra";
import { ReglaError } from "./errores";

const fechaTexto = (f: Date) => f.toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

async function unidad(unidadId: string) {
  const u = await prisma.unidad.findUnique({ where: { id: unidadId }, include: { fases: true } });
  if (!u) throw new ReglaError("No se encontró la unidad.");
  return u;
}

/** Pone (o quita, con null) la fecha estimada de una fase. */
export async function ponerFechaFase(params: { unidadId: string; fase: Fase; fecha: Date | null; usuario: string }) {
  const u = await unidad(params.unidadId);
  const r = await prisma.faseUnidad.upsert({
    where: { unidadId_fase: { unidadId: u.id, fase: params.fase } },
    create: { unidadId: u.id, fase: params.fase, fechaEstimada: params.fecha },
    update: { fechaEstimada: params.fecha },
  });
  await prisma.evento.create({
    data: {
      entidadTipo: "unidad",
      entidadId: u.id,
      tipo: "fecha_fase",
      usuario: params.usuario,
      comentario: params.fecha
        ? `${FASE[params.fase].fecha}: ${fechaTexto(params.fecha)}.`
        : `${FASE[params.fase].fecha}: sin fecha.`,
    },
  });
  // Con fecha de instalación y la pieza ya en almacén, la instalación queda programada.
  if (params.fase === "INSTALACION" && params.fecha) await programarSiSePuede(u.id, params.usuario);
  return r;
}

async function programarSiSePuede(unidadId: string, usuario: string) {
  const u = await unidad(unidadId);
  const listo = u.estadoOperativo === "PRODUCIDO" || u.estadoOperativo === "EN_ALMACEN";
  if (!listo || u.estadoInstalacion !== "NO_PROGRAMADA") return;
  try {
    await avanzarInstalacion({ unidadId, hacia: "PROGRAMADA", usuario });
  } catch (err) {
    // La fecha ya quedó guardada; si hoy no se puede programar (p. ej. suspendida), se programa después.
    if (!(err instanceof ReglaError)) throw err;
  }
}

/** Marca la fase como cumplida. Pide que la anterior lo esté. */
export async function cumplirFase(params: { unidadId: string; fase: Fase; usuario: string }) {
  const u = await unidad(params.unidadId);
  const i = FASES.indexOf(params.fase);
  const marcada = (f: Fase) => !!u.fases.find((x) => x.fase === f)?.cumplidaEn;
  if (estaCumplida(params.fase, marcada(params.fase), u.estadoOperativo, u.estadoInstalacion)) {
    throw new ReglaError(`«${FASE[params.fase].nombre}» ya está cumplida.`);
  }
  if (i > 0) {
    const anterior = FASES[i - 1];
    if (!estaCumplida(anterior, marcada(anterior), u.estadoOperativo, u.estadoInstalacion)) {
      throw new ReglaError(`Primero tiene que cumplirse «${FASE[anterior].nombre}».`);
    }
  }

  // Los estados, uno por uno, saltando los que ya pasaron. El motor revisa cada requisito.
  let op = u.estadoOperativo;
  let ins = u.estadoInstalacion;
  for (const paso of PASOS_DE_FASE[params.fase]) {
    if (yaEsta(paso, op, ins)) continue;
    if (paso.tipo === "operativo") {
      await avanzarEstadoOperativo({ unidadId: u.id, hacia: paso.hacia, usuario: params.usuario });
      op = paso.hacia;
    } else {
      await avanzarInstalacion({ unidadId: u.id, hacia: paso.hacia, usuario: params.usuario });
      ins = paso.hacia;
    }
  }

  const ahora = new Date();
  await prisma.faseUnidad.upsert({
    where: { unidadId_fase: { unidadId: u.id, fase: params.fase } },
    create: { unidadId: u.id, fase: params.fase, cumplidaEn: ahora, cumplidaPor: params.usuario },
    update: { cumplidaEn: ahora, cumplidaPor: params.usuario },
  });
  // La pieza llegó y ya había fecha de instalación: queda programada.
  if (params.fase === "LLEGADA_PEDIDO" && u.fases.find((x) => x.fase === "INSTALACION")?.fechaEstimada) {
    await programarSiSePuede(u.id, params.usuario);
  }
}

/** Una observación sobre la unidad (opcionalmente, de una fase). No se edita ni se borra. */
export async function observar(params: { unidadId: string; fase?: Fase | null; texto: string; autor: string; rol: Rol }) {
  const texto = params.texto.trim();
  if (!texto) throw new ReglaError("Escribe la observación.");
  if (texto.length > 2000) throw new ReglaError("La observación es demasiado larga (máximo 2,000 caracteres).");
  await unidad(params.unidadId);
  return prisma.observacionUnidad.create({
    data: { unidadId: params.unidadId, fase: params.fase ?? null, texto, autor: params.autor, rol: params.rol },
  });
}
