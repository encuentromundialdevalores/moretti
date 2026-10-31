/**
 * POST /api/usuarios — día uno da de alta una cuenta y recibe su liga de
 * invitación (D-49). Protegida por el proxy: sólo con sesión del back office.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Rol } from "@prisma/client";
import { crearUsuario, generarInvitacion } from "@/lib/cuentas";
import { ReglaError } from "@/lib/motor/errores";

const Cuerpo = z.object({
  correo: z.string().trim().max(200),
  nombre: z.string().trim().max(120),
  rol: z.nativeEnum(Rol),
  compradorId: z.string().max(40).nullish(),
  desarrolladorId: z.string().max(40).nullish(),
});

export async function POST(req: NextRequest) {
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Faltan datos de la cuenta." }, { status: 400 });
  try {
    const u = await crearUsuario(datos.data);
    const token = await generarInvitacion(u.id);
    return NextResponse.json({ id: u.id, liga: `${req.nextUrl.origin}/cuenta/activar?token=${token}` });
  } catch (err) {
    if (err instanceof ReglaError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
