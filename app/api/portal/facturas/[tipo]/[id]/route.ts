/**
 * POST /api/portal/facturas/<complemento|comision>/<id> — Moretti sube el
 * XML, el PDF o el folio de una factura (D-53). Formulario multipart:
 * campos «xml», «pdf» (archivos) y «folio» (texto).
 */
import { NextRequest, NextResponse } from "next/server";
import { subirFactura } from "@/lib/motor/comprobantes";
import { ReglaError } from "@/lib/motor/errores";
import { firma, puedeCerrarComprobante } from "@/lib/permisos";
import { usuarioDePeticion } from "@/lib/portal";

const MAX_XML = 500_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  if (!puedeCerrarComprobante(u.rol)) return NextResponse.json({ error: "Las facturas las sube Moretti." }, { status: 403 });
  const { tipo, id } = await params;
  if (tipo !== "complemento" && tipo !== "comision") return NextResponse.json({ error: "No existe esa factura." }, { status: 404 });

  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
  const xml = fd.get("xml");
  const pdf = fd.get("pdf");
  const folio = fd.get("folio");
  if (xml instanceof File && xml.size > MAX_XML) return NextResponse.json({ error: "Ese XML es demasiado grande para ser un CFDI." }, { status: 400 });
  try {
    await subirFactura({
      tipo,
      id,
      usuario: firma(u.nombre, u.rol),
      folio: typeof folio === "string" && folio ? folio : undefined,
      ...(xml instanceof File && xml.size > 0 ? { xml: await xml.text(), xmlNombre: xml.name } : {}),
      ...(pdf instanceof File && pdf.size > 0 ? { pdf: new Uint8Array(await pdf.arrayBuffer()), pdfNombre: pdf.name } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
