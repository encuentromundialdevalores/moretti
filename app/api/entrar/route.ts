/**
 * POST /api/entrar — correo y contraseña para cualquier rol (D-49).
 *
 * Un ADMIN (día uno) recibe la misma cookie del back office que el login con
 * contraseña única, así que todo /admin funciona igual. Los demás reciben la
 * cookie del portal. Mismo freno de intentos por IP que /api/admin/login.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autenticar } from "@/lib/cuentas";
import { inicioDe } from "@/lib/permisos";
import { cookieOpciones, cookiePortalOpciones, crearToken, crearTokenPortal } from "@/lib/sesion";
import { anotarFalla, bloqueadoPor, limpiar } from "@/lib/limite-intentos";
import { ipCliente } from "@/lib/ip";

const Cuerpo = z.object({ correo: z.string().max(200), contrasena: z.string().max(200) });

export async function POST(req: NextRequest) {
  const ip = ipCliente(req.headers);
  const espera = bloqueadoPor(ip);
  if (espera > 0) {
    const min = Math.ceil(espera / 60000);
    return NextResponse.json(
      { ok: false, error: `Demasiados intentos. Vuelve a intentar en ${min} ${min === 1 ? "minuto" : "minutos"}.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(espera / 1000)) } }
    );
  }
  const datos = Cuerpo.safeParse(await req.json().catch(() => null));
  const u = datos.success ? await autenticar(datos.data.correo, datos.data.contrasena) : null;
  if (!u) {
    anotarFalla(ip);
    return NextResponse.json({ ok: false, error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  limpiar(ip);
  const res = NextResponse.json({ ok: true, destino: inicioDe(u.rol) });
  if (u.rol === "ADMIN") res.cookies.set({ ...cookieOpciones(), value: await crearToken() });
  else res.cookies.set({ ...cookiePortalOpciones(), value: await crearTokenPortal({ uid: u.id, rol: u.rol }) });
  return res;
}
