/**
 * Lo que comparten las rutas de obra del portal (/api/portal/*) y del back
 * office (/api/obra/*): fechas y cumplimiento de fases, observaciones y
 * mensajes (D-52, D-54). Cada ruta sólo dice quién es el que pide.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { Fase, type Rol } from "@prisma/client";
import { cumplirFase, enviarMensaje, observar, ponerFechaFase } from "./motor/fases";
import { ReglaError } from "./motor/errores";
import { FASE, puedeEditarFase, puedeObservar } from "./fases";
import { firma } from "./permisos";

export type Quien = { nombre: string; rol: Rol };

const id = z.string().min(1).max(40);
const CuerpoFase = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("fecha"), unidadId: id, fase: z.nativeEnum(Fase), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ accion: z.literal("cumplir"), unidadId: id, fase: z.nativeEnum(Fase) }),
]);
const CuerpoTexto = z.object({ unidadId: id, fase: z.nativeEnum(Fase).nullish(), texto: z.string().max(2000) });

async function responder(fn: () => Promise<unknown>) {
  try {
    await fn();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function manejarFase(q: Quien, cuerpo: unknown) {
  const datos = CuerpoFase.safeParse(cuerpo);
  if (!datos.success) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const d = datos.data;
  if (!puedeEditarFase(q.rol, d.fase)) {
    const quien = FASE[d.fase].responsable === "MORETTI" ? "Moretti" : "el verificador";
    return NextResponse.json({ error: `Esta fase la maneja ${quien}: la puedes ver, pero no cambiar.` }, { status: 403 });
  }
  const usuario = firma(q.nombre, q.rol);
  return responder(() =>
    d.accion === "fecha"
      // Mediodía UTC: el día no se corre por la zona horaria.
      ? ponerFechaFase({ unidadId: d.unidadId, fase: d.fase, fecha: d.fecha ? new Date(`${d.fecha}T12:00:00Z`) : null, usuario, rol: q.rol })
      : cumplirFase({ unidadId: d.unidadId, fase: d.fase, usuario, rol: q.rol })
  );
}

export async function manejarTexto(q: Quien, cuerpo: unknown, tipo: "observacion" | "mensaje") {
  if (!puedeObservar(q.rol)) return NextResponse.json({ error: "Tu perfil no escribe aquí." }, { status: 403 });
  const datos = CuerpoTexto.safeParse(cuerpo);
  if (!datos.success) return NextResponse.json({ error: "Escribe el texto." }, { status: 400 });
  const d = datos.data;
  return responder(() =>
    tipo === "observacion"
      ? observar({ unidadId: d.unidadId, fase: d.fase, texto: d.texto, autor: q.nombre, rol: q.rol })
      : enviarMensaje({ unidadId: d.unidadId, texto: d.texto, autor: q.nombre, rol: q.rol })
  );
}
