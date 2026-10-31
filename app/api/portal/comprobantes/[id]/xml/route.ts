import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usuarioDePeticion } from "@/lib/portal";

/**
 * Descarga el XML de un comprobante. El comprador sólo el de su plan (se
 * revisa contra su cuenta, no contra la URL); Moretti, cualquiera.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  const { id } = await params;
  const c = await prisma.comprobanteFiscal.findUnique({
    where: { id },
    select: { xml: true, xmlNombre: true, pago: { select: { plan: { select: { compradorId: true } } } } },
  });
  const suyo = u.rol === "MORETTI" || (u.rol === "COMPRADOR" && !!u.compradorId && c?.pago.plan.compradorId === u.compradorId);
  if (!c || !suyo) return NextResponse.json({ error: "No existe ese comprobante." }, { status: 404 });
  if (!c.xml) return NextResponse.json({ error: "Este comprobante no tiene XML." }, { status: 404 });
  const nombre = (c.xmlNombre ?? "comprobante.xml").replace(/[^\w.\-]/g, "_");
  return new NextResponse(c.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
