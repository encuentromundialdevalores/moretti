/**
 * Quién está viendo el portal. Se lee de la cookie Y de la base en cada
 * petición: si día uno desactiva una cuenta, deja de entrar en ese momento,
 * aunque su cookie siga vigente (D-49).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { Rol } from "@prisma/client";
import { prisma } from "./prisma";
import { COOKIE_PORTAL, leerTokenPortal } from "./sesion";

export type UsuarioPortal = NonNullable<Awaited<ReturnType<typeof cargar>>>;

async function cargar(token: string | undefined) {
  const s = await leerTokenPortal(token);
  if (!s) return null;
  const u = await prisma.usuario.findUnique({ where: { id: s.uid } });
  if (!u || !u.activo || u.rol !== s.rol || u.rol === "ADMIN") return null;
  return u;
}

/** Para páginas: el usuario con uno de estos roles, o al login. */
export async function exigirRol(...roles: Rol[]): Promise<UsuarioPortal> {
  const u = await cargar((await cookies()).get(COOKIE_PORTAL)?.value);
  if (!u) redirect("/entrar");
  if (!roles.includes(u.rol)) redirect("/portal");
  return u;
}

/** Para páginas que sólo reparten (/portal): el usuario o null. */
export async function usuarioActual() {
  return cargar((await cookies()).get(COOKIE_PORTAL)?.value);
}

/** Para rutas /api/portal/*: el usuario o null (la ruta contesta 401/403). */
export async function usuarioDePeticion(req: NextRequest) {
  return cargar(req.cookies.get(COOKIE_PORTAL)?.value);
}
