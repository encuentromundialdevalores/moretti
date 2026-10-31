import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cambiarActivo, generarInvitacion } from "@/lib/cuentas";
import { prisma } from "@/lib/prisma";

const Cuerpo = z.object({ accion: z.enum(["invitar", "desactivar", "activar"]) });

/** Nueva liga de invitación, o desactivar / reactivar la cuenta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  if (!(await prisma.usuario.findUnique({ where: { id } }))) return NextResponse.json({ error: "No existe esa cuenta." }, { status: 404 });
  if (datos.data.accion === "invitar") {
    const token = await generarInvitacion(id);
    return NextResponse.json({ liga: `${req.nextUrl.origin}/cuenta/activar?token=${token}` });
  }
  await cambiarActivo(id, datos.data.accion === "activar");
  return NextResponse.json({ ok: true });
}
