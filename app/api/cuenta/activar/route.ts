import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activarCuenta } from "@/lib/cuentas";
import { ReglaError } from "@/lib/motor/errores";
import { anotarFalla, bloqueadoPor } from "@/lib/limite-intentos";
import { ipCliente } from "@/lib/ip";

const Cuerpo = z.object({ token: z.string().min(1).max(200), contrasena: z.string().max(200) });

/** La persona elige su contraseña con su liga de invitación (D-49). */
export async function POST(req: NextRequest) {
  const ip = ipCliente(req.headers);
  if (bloqueadoPor(ip) > 0) return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  try {
    await activarCuenta(datos.data.token, datos.data.contrasena);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReglaError) {
      if (err.message.startsWith("La liga")) anotarFalla(ip);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
