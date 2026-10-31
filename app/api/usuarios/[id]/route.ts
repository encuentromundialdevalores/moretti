import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Rol } from "@prisma/client";
import { borrarUsuario, cambiarActivo, editarUsuario, generarInvitacion } from "@/lib/cuentas";
import { ReglaError } from "@/lib/motor/errores";
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

const Edicion = z.object({
  correo: z.string().trim().max(200),
  nombre: z.string().trim().max(120),
  rol: z.nativeEnum(Rol),
  compradorId: z.string().max(40).nullish(),
  desarrolladorId: z.string().max(40).nullish(),
});

/** Corregir los datos o el perfil de la cuenta. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = Edicion.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Faltan datos de la cuenta." }, { status: 400 });
  if (!(await prisma.usuario.findUnique({ where: { id } }))) return NextResponse.json({ error: "No existe esa cuenta." }, { status: 404 });
  try {
    await editarUsuario(id, datos.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/** Borrar la cuenta (la bitácora conserva quién hizo qué). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await prisma.usuario.findUnique({ where: { id } }))) return NextResponse.json({ error: "No existe esa cuenta." }, { status: 404 });
  await borrarUsuario(id);
  return NextResponse.json({ ok: true });
}
