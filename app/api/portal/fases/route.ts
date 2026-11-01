/**
 * POST /api/portal/fases — poner la fecha estimada de una fase o marcarla
 * cumplida (D-52). Cada fase tiene su responsable (lib/fases.ts): las demás
 * se ven pero no se cambian.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Fase } from "@prisma/client";
import { cumplirFase, ponerFechaFase } from "@/lib/motor/fases";
import { ReglaError } from "@/lib/motor/errores";
import { FASE, puedeEditarFase } from "@/lib/fases";
import { firma } from "@/lib/permisos";
import { usuarioDePeticion } from "@/lib/portal";

const Cuerpo = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("fecha"), unidadId: z.string().min(1).max(40), fase: z.nativeEnum(Fase), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ accion: z.literal("cumplir"), unidadId: z.string().min(1).max(40), fase: z.nativeEnum(Fase) }),
]);

export async function POST(req: NextRequest) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const d = datos.data;
  if (!puedeEditarFase(u.rol, d.fase)) {
    const quien = FASE[d.fase].responsable === "MORETTI" ? "Moretti" : "el verificador";
    return NextResponse.json({ error: `Esta fase la maneja ${quien}: la puedes ver, pero no cambiar.` }, { status: 403 });
  }
  try {
    const usuario = firma(u.nombre, u.rol);
    if (d.accion === "fecha") {
      // Mediodía UTC: el día no se corre por la zona horaria.
      await ponerFechaFase({ unidadId: d.unidadId, fase: d.fase, fecha: d.fecha ? new Date(`${d.fecha}T12:00:00Z`) : null, usuario });
    } else {
      await cumplirFase({ unidadId: d.unidadId, fase: d.fase, usuario });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
