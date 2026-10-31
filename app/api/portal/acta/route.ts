import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registrarActaEntrega } from "@/lib/motor/obra";
import { ReglaError } from "@/lib/motor/errores";
import { firma, puedeRegistrarActa } from "@/lib/permisos";
import { usuarioDePeticion } from "@/lib/portal";

const Cuerpo = z.object({
  unidadId: z.string().min(1).max(40),
  quienFirmo: z.string().trim().min(1).max(120),
  fechaFirma: z.coerce.date(),
  archivoNombre: z.string().trim().min(1).max(160),
});

/** El verificador levanta el acta de entrega con el comprador (D-50). */
export async function POST(req: NextRequest) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  if (!puedeRegistrarActa(u.rol)) return NextResponse.json({ error: "El acta la levanta el verificador." }, { status: 403 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Faltan datos del acta." }, { status: 400 });
  try {
    await registrarActaEntrega({ ...datos.data, usuario: firma(u.nombre, u.rol) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
