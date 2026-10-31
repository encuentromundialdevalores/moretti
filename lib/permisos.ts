/**
 * Qué ve y qué puede mover cada rol (maqueta de Ana Cris, sección «Tablero»; D-48).
 *
 * Pura: sin base de datos. Las páginas del portal y las rutas /api/portal/*
 * preguntan aquí antes de mostrar o de cambiar algo; las reglas del motor
 * (R1–R8, lib/motor/operacion.ts) siguen mandando encima de esto: que un rol
 * pueda pedir un cambio no salta un requisito que falte.
 */

import type { Rol } from "@prisma/client";
import type { EstadoInstalacion, EstadoOperativo } from "./motor/operacion";

export const ETIQUETA_ROL: Record<Rol, { nombre: string; quien: string }> = {
  ADMIN: { nombre: "día uno", quien: "Opera todo" },
  MORETTI: { nombre: "Moretti", quien: "Fabrica e instala" },
  VERIFICADOR: { nombre: "Verificador", quien: "Mide y recibe" },
  DESARROLLADOR: { nombre: "PISSA", quien: "Entrega el edificio" },
  COMPRADOR: { nombre: "Comprador", quien: "Ya compró" },
};

/** Lo que dice la maqueta que ve cada quien, para mostrarlo en su portal. */
export const LO_QUE_VE: Record<Rol, string> = {
  ADMIN: "La única vista que ve todo el tablero y todas las unidades.",
  MORETTI: "Qué se vendió, qué está pagado y qué toca fabricar. Marca su avance y cierra sus pendientes fiscales.",
  VERIFICADOR: "Qué hay que medir, qué hay que verificar y qué actas faltan por firmar. No fabrica ni instala: por eso puede calificar.",
  DESARROLLADOR: "Cuáles de sus unidades llevan paquete y cuándo entra gente a su edificio. Sin precios y sin datos del comprador.",
  COMPRADOR: "Su plan, su unidad y sus papeles. Sólo los suyos.",
};

export type Pantalla = { href: string; texto: string };

/** Las pantallas de cada rol en el portal. ADMIN usa el back office (/admin). */
export const PANTALLAS: Record<Exclude<Rol, "ADMIN">, Pantalla[]> = {
  COMPRADOR: [
    { href: "/portal/comprador", texto: "Mi plan de pagos" },
    { href: "/portal/comprador/departamento", texto: "Mi departamento" },
    { href: "/portal/comprador/documentos", texto: "Mis documentos" },
  ],
  MORETTI: [
    { href: "/portal/moretti", texto: "Unidades por producir" },
    { href: "/portal/moretti/fiscal", texto: "Pendientes fiscales" },
  ],
  VERIFICADOR: [
    { href: "/portal/verificador", texto: "Levantamientos" },
    { href: "/portal/verificador/instalaciones", texto: "Instalaciones por recibir" },
  ],
  DESARROLLADOR: [
    { href: "/portal/pissa", texto: "Unidades vendidas" },
    { href: "/portal/pissa/accesos", texto: "Accesos e instalaciones" },
  ],
};

/** A dónde entra cada rol después de iniciar sesión. */
export function inicioDe(rol: Rol): string {
  return rol === "ADMIN" ? "/admin" : PANTALLAS[rol][0].href;
}

/** Prefijo de rutas del portal que le pertenece a cada rol. */
const PREFIJO: Record<Exclude<Rol, "ADMIN">, string> = {
  COMPRADOR: "/portal/comprador",
  MORETTI: "/portal/moretti",
  VERIFICADOR: "/portal/verificador",
  DESARROLLADOR: "/portal/pissa",
};

/** ¿Este rol puede abrir esta ruta del portal? */
export function puedeVerRuta(rol: Rol, ruta: string): boolean {
  if (ruta === "/portal") return true;
  if (rol === "ADMIN") return false; // día uno trabaja en /admin
  const p = PREFIJO[rol];
  return ruta === p || ruta.startsWith(`${p}/`);
}

/**
 * Qué paso de obra puede marcar cada rol. Lo que no está aquí sólo lo marca
 * día uno desde el back office (elegir acabados, programar la instalación).
 * - Moretti fabrica e instala: producción, producido, almacén, instalada.
 * - El verificador mide y recibe: levantamiento y entrega (con acta).
 */
const OPERATIVO: Partial<Record<Rol, EstadoOperativo[]>> = {
  ADMIN: ["LEVANTAMIENTO_HECHO", "ACABADOS_ELEGIDOS", "EN_PRODUCCION", "PRODUCIDO", "EN_ALMACEN"],
  MORETTI: ["EN_PRODUCCION", "PRODUCIDO", "EN_ALMACEN"],
  VERIFICADOR: ["LEVANTAMIENTO_HECHO"],
};
const INSTALACION: Partial<Record<Rol, EstadoInstalacion[]>> = {
  ADMIN: ["PROGRAMADA", "INSTALADA", "ENTREGADA"],
  MORETTI: ["INSTALADA"],
  VERIFICADOR: ["ENTREGADA"],
};

export function puedeMarcarOperativo(rol: Rol, hacia: EstadoOperativo): boolean {
  return OPERATIVO[rol]?.includes(hacia) ?? false;
}

export function puedeMarcarInstalacion(rol: Rol, hacia: EstadoInstalacion): boolean {
  return INSTALACION[rol]?.includes(hacia) ?? false;
}

/** Sólo el verificador (y día uno) levanta el acta de entrega. */
export function puedeRegistrarActa(rol: Rol): boolean {
  return rol === "VERIFICADOR" || rol === "ADMIN";
}

/** Moretti cierra sus pendientes fiscales (I-11 por ratificar: quién emite). */
export function puedeCerrarComprobante(rol: Rol): boolean {
  return rol === "MORETTI" || rol === "ADMIN";
}

/** Cómo se firma un cambio en la bitácora: «Ana López (Moretti)». */
export function firma(nombre: string, rol: Rol): string {
  return `${nombre} (${ETIQUETA_ROL[rol].nombre})`;
}

/** «Cómo va» para PISSA: sin detalle de fabricación ni de pagos (maqueta p-unid). */
export function comoVaParaDesarrollador(operativo: EstadoOperativo, instalacion: EstadoInstalacion): string {
  if (instalacion === "ENTREGADA") return "Entregada";
  if (instalacion === "INSTALADA") return "Instalada";
  if (operativo === "EN_ALMACEN") return "Lista para instalar";
  if (operativo === "PENDIENTE") return "Por arrancar";
  return "En proceso";
}
