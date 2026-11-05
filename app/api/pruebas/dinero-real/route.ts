import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PasarelaError, ReglaError } from "@/lib/motor/planes";
import { barrerPrueba, leerEscenario, prepararEscenario, vencerSiguiente } from "./escenario";

/**
 * Apoyo de la página /admin/pagos/dinero-real. Sólo con sesión de back office
 * (proxy.ts) y sólo sobre el proyecto «Prueba real» (./escenario.ts).
 *
 * GET: el estado del escenario. POST: { accion } =
 * preparar · vencer · barrido · dos-barridos.
 */
export async function GET() {
  return NextResponse.json({ escenario: await leerEscenario() });
}

const Cuerpo = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("preparar"),
    cuentaConectada: z.string().trim().regex(/^acct_[A-Za-z0-9]+$/, "La cuenta de Moretti empieza con acct_."),
    comision: z.number().min(0).max(0.5, "La comisión va de 0 a 50 %."),
    correo: z.string().trim().max(120).optional(),
  }),
  z.object({ accion: z.literal("vencer"), planId: z.string().min(1).max(40) }),
  z.object({ accion: z.literal("barrido") }),
  z.object({ accion: z.literal("dos-barridos") }),
]);

export async function POST(req: NextRequest) {
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) {
    return NextResponse.json({ error: datos.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  const d = datos.data;
  try {
    switch (d.accion) {
      case "preparar":
        return NextResponse.json({ escenario: await prepararEscenario(d) });
      case "vencer":
        return NextResponse.json(await vencerSiguiente(d.planId));
      case "barrido":
        return NextResponse.json({ barridos: await barrerPrueba(1) });
      case "dos-barridos":
        return NextResponse.json({ barridos: await barrerPrueba(2) });
    }
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof PasarelaError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
