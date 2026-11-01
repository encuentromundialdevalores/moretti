/**
 * PATCH /api/partidas/<id> — día uno edita un producto del catálogo, uno
 * por uno (Sprint 5): nombre, imagen, su ficha (etiqueta · valor) y hasta
 * tres acabados (nombre · color). Protegida por el proxy (back office).
 * Los planes ya vendidos no cambian: guardan su acabado como texto.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Cuerpo = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
  imagen: z.string().trim().max(500).nullable(),
  ficha: z.array(z.tuple([z.string().trim().min(1).max(80), z.string().trim().max(300)])).max(20),
  acabados: z.array(z.tuple([z.string().trim().min(1).max(80), z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color va como #RRGGBB.")])).max(3),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: datos.error.issues[0]?.message ?? "Revisa los campos." }, { status: 400 });
  if (!(await prisma.partida.findUnique({ where: { id } }))) return NextResponse.json({ error: "No existe ese producto." }, { status: 404 });
  const d = datos.data;
  if (d.imagen && !/^\/(?!\/)/.test(d.imagen)) {
    return NextResponse.json({ error: "Sube la imagen con el botón: no se aceptan ligas de otros sitios." }, { status: 400 });
  }
  await prisma.partida.update({
    where: { id },
    data: { nombre: d.nombre, imagen: d.imagen || null, ficha: d.ficha, acabados: d.acabados.length ? d.acabados : undefined },
  });
  return NextResponse.json({ ok: true });
}
