/**
 * Cuentas de prueba, una por perfil (D-51). Se puede correr varias veces:
 * si la cuenta existe, sólo le vuelve a poner la contraseña de prueba.
 *
 *   npm run db:usuarios-prueba
 *
 * SÓLO para el ambiente de pruebas: la contraseña es pública (está aquí).
 */
import { EstadoPlan, type Rol } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashContrasena } from "../lib/contrasena";

const CONTRASENA = "prueba-dia-uno-2026";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("No se crean cuentas de prueba en producción.");

  // El comprador de prueba: el que tenga un plan activo con más pagos.
  const planes = await prisma.plan.findMany({
    where: { estado: { in: [EstadoPlan.ACTIVO, EstadoPlan.LIQUIDADO] } },
    select: { compradorId: true, _count: { select: { pagos: true } } },
  });
  const comprador = planes.sort((a, b) => b._count.pagos - a._count.pagos)[0];
  const pissa = await prisma.desarrollador.findFirst({ where: { nombre: { contains: "PISSA", mode: "insensitive" } } });
  if (!comprador) throw new Error("No hay ningún plan activo: aparta una unidad primero (o corre el seed).");
  if (!pissa) throw new Error("No existe el desarrollador PISSA (corre npm run db:seed).");

  const cuentas: { correo: string; nombre: string; rol: Rol; compradorId?: string; desarrolladorId?: string }[] = [
    { correo: "comprador@prueba.diauno.mx", nombre: "Comprador de prueba", rol: "COMPRADOR", compradorId: comprador.compradorId },
    { correo: "moretti@prueba.diauno.mx", nombre: "Moretti de prueba", rol: "MORETTI" },
    { correo: "verificador@prueba.diauno.mx", nombre: "Verificador de prueba", rol: "VERIFICADOR" },
    { correo: "pissa@prueba.diauno.mx", nombre: "PISSA de prueba", rol: "DESARROLLADOR", desarrolladorId: pissa.id },
    { correo: "admin@prueba.diauno.mx", nombre: "día uno de prueba", rol: "ADMIN" },
  ];

  const hash = await hashContrasena(CONTRASENA);
  for (const c of cuentas) {
    const datos = { nombre: c.nombre, rol: c.rol, compradorId: c.compradorId ?? null, desarrolladorId: c.desarrolladorId ?? null, contrasenaHash: hash, activo: true };
    await prisma.usuario.upsert({ where: { correo: c.correo }, create: { correo: c.correo, ...datos }, update: datos });
    console.log(`  ${c.rol.padEnd(14)} ${c.correo}`);
  }
  console.log(`\nContraseña de todas: ${CONTRASENA}\nEntrar en: /entrar`);
}

main().finally(() => prisma.$disconnect());
