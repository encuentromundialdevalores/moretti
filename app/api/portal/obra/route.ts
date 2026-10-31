/**
 * POST /api/portal/obra — Moretti y el verificador marcan su avance (D-50).
 * Qué paso puede marcar cada rol vive en lib/permisos.ts; los requisitos
 * (pagado, levantamiento, acta…) los sigue revisando lib/motor/obra.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { avanzarEstadoOperativo, avanzarInstalacion } from "@/lib/motor/obra";
import { ORDEN_INSTALACION, ORDEN_OPERATIVO } from "@/lib/motor/operacion";
import { ReglaError } from "@/lib/motor/errores";
import { firma, puedeMarcarInstalacion, puedeMarcarOperativo } from "@/lib/permisos";
import { usuarioDePeticion } from "@/lib/portal";

const Cuerpo = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("operativo"), unidadId: z.string().min(1).max(40), hacia: z.enum(ORDEN_OPERATIVO as [string, ...string[]]) }),
  z.object({ tipo: z.literal("instalacion"), unidadId: z.string().min(1).max(40), hacia: z.enum(ORDEN_INSTALACION as [string, ...string[]]) }),
]);

export async function POST(req: NextRequest) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const d = datos.data;
  const permitido =
    d.tipo === "operativo"
      ? puedeMarcarOperativo(u.rol, d.hacia as (typeof ORDEN_OPERATIVO)[number])
      : puedeMarcarInstalacion(u.rol, d.hacia as (typeof ORDEN_INSTALACION)[number]);
  if (!permitido) return NextResponse.json({ error: "Ese paso no le toca a tu perfil." }, { status: 403 });
  try {
    const usuario = firma(u.nombre, u.rol);
    const r =
      d.tipo === "operativo"
        ? await avanzarEstadoOperativo({ unidadId: d.unidadId, hacia: d.hacia as (typeof ORDEN_OPERATIVO)[number], usuario })
        : await avanzarInstalacion({ unidadId: d.unidadId, hacia: d.hacia as (typeof ORDEN_INSTALACION)[number], usuario });
    return NextResponse.json(r);
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
