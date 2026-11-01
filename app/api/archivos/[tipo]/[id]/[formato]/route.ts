/**
 * GET /api/archivos/<complemento|comision>/<id>/<xml|pdf> — descarga una
 * factura (D-53). Pueden: día uno (sesión del back office), Moretti, y el
 * comprador sólo el complemento de su propio plan. La factura de comisión es
 * entre Moretti y día uno: el comprador nunca la ve.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usuarioDePeticion } from "@/lib/portal";
import { COOKIE_NAME, verificarToken } from "@/lib/sesion";

type Params = { params: Promise<{ tipo: string; id: string; formato: string }> };
const noHay = () => NextResponse.json({ error: "No existe ese archivo." }, { status: 404 });

export async function GET(req: NextRequest, { params }: Params) {
  const { tipo, id, formato } = await params;
  if (!["complemento", "comision"].includes(tipo) || !["xml", "pdf"].includes(formato)) return noHay();

  const esAdmin = !!(await verificarToken(req.cookies.get(COOKIE_NAME)?.value ?? ""));
  const u = esAdmin ? null : await usuarioDePeticion(req);
  if (!esAdmin && !u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });

  const sel = { xml: true, xmlNombre: true, pdf: true, pdfNombre: true, planId: true } as const;
  const f = tipo === "complemento"
    ? await prisma.comprobanteFiscal.findUnique({ where: { id }, select: sel })
    : await prisma.facturaComision.findUnique({ where: { id }, select: sel });
  if (!f) return noHay();

  if (!esAdmin) {
    const suyo = u!.rol === "MORETTI" || (
      tipo === "complemento" && u!.rol === "COMPRADOR" && !!u!.compradorId &&
      (await prisma.plan.count({ where: { id: f.planId, compradorId: u!.compradorId } })) > 0
    );
    if (!suyo) return noHay();
  }

  const contenido = formato === "xml" ? f.xml : f.pdf;
  if (!contenido) return noHay();
  const nombre = ((formato === "xml" ? f.xmlNombre : f.pdfNombre) ?? `factura.${formato}`).replace(/[^\w.\-]/g, "_");
  return new NextResponse(typeof contenido === "string" ? contenido : new Uint8Array(contenido), {
    headers: {
      "Content-Type": formato === "xml" ? "application/xml; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
