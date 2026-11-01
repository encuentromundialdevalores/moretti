/** POST /api/portal/observaciones — Moretti o el verificador anotan algo sobre una unidad (D-52). */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Fase } from "@prisma/client";
import { observar } from "@/lib/motor/fases";
import { ReglaError } from "@/lib/motor/errores";
import { puedeObservar } from "@/lib/fases";
import { usuarioDePeticion } from "@/lib/portal";

const Cuerpo = z.object({ unidadId: z.string().min(1).max(40), fase: z.nativeEnum(Fase).nullish(), texto: z.string().max(2000) });

export async function POST(req: NextRequest) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  if (!puedeObservar(u.rol)) return NextResponse.json({ error: "Tu perfil no escribe observaciones." }, { status: 403 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Escribe la observación." }, { status: 400 });
  try {
    await observar({ ...datos.data, autor: u.nombre, rol: u.rol });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
