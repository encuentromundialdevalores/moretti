import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { marcarComprobanteEmitido } from "@/lib/motor/comprobantes";
import { ReglaError } from "@/lib/motor/errores";
import { firma, puedeCerrarComprobante } from "@/lib/permisos";
import { usuarioDePeticion } from "@/lib/portal";

/** Un CFDI pesa pocos KB; 500 KB deja margen sin abrir la puerta a archivos enormes. */
const Cuerpo = z.object({
  folioFiscal: z.string().trim().min(1).max(60),
  xml: z.string().max(500_000).optional(),
  xmlNombre: z.string().trim().max(120).optional(),
});

/** Moretti cierra su pendiente fiscal con el folio del CFDI (maqueta m-fisc). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  if (!puedeCerrarComprobante(u.rol)) return NextResponse.json({ error: "Esto lo cierra Moretti." }, { status: 403 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Falta el folio fiscal." }, { status: 400 });
  try {
    const { id } = await params;
    await marcarComprobanteEmitido({ ...datos.data, id, usuario: firma(u.nombre, u.rol) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
