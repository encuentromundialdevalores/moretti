/**
 * Avisos automáticos (Sprint 5, D-54): el sistema le avisa a un perfil lo
 * que hizo otro («Moretti puso la fecha de instalación de BR 1401»). Cada
 * aviso va a un perfil completo; cada persona lleva la cuenta de hasta
 * dónde los vio (AvisoVisto: el id de su cuenta, o «admin» para el back office).
 */

import type { Prisma, Rol } from "@prisma/client";
import { prisma } from "./prisma";

type Cliente = Prisma.TransactionClient | typeof prisma;
type Equipo = "ADMIN" | "MORETTI" | "VERIFICADOR";
const EQUIPO: Equipo[] = ["ADMIN", "MORETTI", "VERIFICADOR"];

/** Dónde abre la unidad cada perfil. */
export function hrefUnidad(rol: Rol, unidadId: string): string {
  if (rol === "MORETTI") return `/portal/moretti?u=${unidadId}`;
  if (rol === "VERIFICADOR") return `/portal/verificador?u=${unidadId}`;
  return `/admin/obra?u=${unidadId}`;
}

/** Avisa a los perfiles indicados. */
export async function avisar(db: Cliente, para: Rol[], texto: string, unidadId?: string) {
  if (para.length === 0) return;
  await db.aviso.createMany({ data: para.map((paraRol) => ({ paraRol, texto, href: unidadId ? hrefUnidad(paraRol, unidadId) : null })) });
}

/** Avisa al resto del equipo de obra (día uno, Moretti, verificador), menos a quien lo hizo. */
export async function avisarAlEquipo(db: Cliente, quien: Rol, texto: string, unidadId?: string) {
  await avisar(db, EQUIPO.filter((r) => r !== quien), texto, unidadId);
}

export async function avisosDe(rol: Rol, limite = 50) {
  return prisma.aviso.findMany({ where: { paraRol: rol }, orderBy: { createdAt: "desc" }, take: limite });
}

export async function vistoEn(clave: string): Promise<Date> {
  return (await prisma.avisoVisto.findUnique({ where: { clave } }))?.vistoEn ?? new Date(0);
}

export async function contarNuevos(clave: string, rol: Rol): Promise<number> {
  return prisma.aviso.count({ where: { paraRol: rol, createdAt: { gt: await vistoEn(clave) } } });
}

export async function marcarVistos(clave: string) {
  const ahora = new Date();
  await prisma.avisoVisto.upsert({ where: { clave }, create: { clave, vistoEn: ahora }, update: { vistoEn: ahora } });
}
