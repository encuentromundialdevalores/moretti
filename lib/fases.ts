/**
 * Las 6 fases de obra (Sprint 5, D-52), puras: orden, responsable y a qué
 * estado de la unidad lleva cada una. El motor (lib/motor/fases.ts) las
 * aplica con las reglas de siempre (lib/motor/operacion.ts).
 */

import type { Fase, Rol } from "@prisma/client";
import { ORDEN_INSTALACION, ORDEN_OPERATIVO, type EstadoInstalacion, type EstadoOperativo } from "./motor/operacion";

export const FASES: readonly Fase[] = ["MEDICION", "REVISION_PEDIDO", "PEDIDO", "LLEGADA_PEDIDO", "INSTALACION", "REVISION_INSTALACION"];

export const FASE: Record<Fase, { nombre: string; fecha: string; responsable: "VERIFICADOR" | "MORETTI"; ayuda: string }> = {
  MEDICION: { nombre: "Medición", fecha: "Fecha de medición", responsable: "VERIFICADOR", ayuda: "Mide el departamento al milímetro." },
  REVISION_PEDIDO: { nombre: "Revisión del pedido", fecha: "Fecha de revisión del pedido", responsable: "VERIFICADOR", ayuda: "Revisa el pedido contra las medidas y da el visto bueno." },
  PEDIDO: { nombre: "Pedido a fábrica", fecha: "Fecha del pedido", responsable: "MORETTI", ayuda: "Hace el pedido. Sólo se puede con la unidad liquidada." },
  LLEGADA_PEDIDO: { nombre: "Llegada del pedido", fecha: "Fecha de llegada", responsable: "VERIFICADOR", ayuda: "Revisa que llegó completo y en buen estado." },
  INSTALACION: { nombre: "Instalación", fecha: "Fecha programada de instalación", responsable: "MORETTI", ayuda: "Instala en el departamento." },
  REVISION_INSTALACION: { nombre: "Revisión de la instalación", fecha: "Fecha de revisión", responsable: "VERIFICADOR", ayuda: "Revisa la instalación con el comprador y firman el acta." },
};

/** ¿Este perfil puede poner la fecha o marcar cumplida esta fase? */
export function puedeEditarFase(rol: Rol, fase: Fase): boolean {
  return rol === "ADMIN" || FASE[fase].responsable === rol;
}

/** Moretti, el verificador y día uno escriben observaciones. */
export function puedeObservar(rol: Rol): boolean {
  return rol === "ADMIN" || rol === "MORETTI" || rol === "VERIFICADOR";
}

type Paso = { tipo: "operativo"; hacia: EstadoOperativo } | { tipo: "instalacion"; hacia: EstadoInstalacion };

/** Los cambios de estado que hace cumplir cada fase, en orden. */
export const PASOS_DE_FASE: Record<Fase, Paso[]> = {
  MEDICION: [{ tipo: "operativo", hacia: "LEVANTAMIENTO_HECHO" }],
  REVISION_PEDIDO: [{ tipo: "operativo", hacia: "ACABADOS_ELEGIDOS" }],
  PEDIDO: [{ tipo: "operativo", hacia: "EN_PRODUCCION" }],
  LLEGADA_PEDIDO: [{ tipo: "operativo", hacia: "PRODUCIDO" }, { tipo: "operativo", hacia: "EN_ALMACEN" }],
  INSTALACION: [{ tipo: "instalacion", hacia: "PROGRAMADA" }, { tipo: "instalacion", hacia: "INSTALADA" }],
  REVISION_INSTALACION: [{ tipo: "instalacion", hacia: "ENTREGADA" }],
};

/** ¿La unidad ya llegó (o pasó) a este estado? */
export function yaEsta(p: Paso, op: EstadoOperativo, ins: EstadoInstalacion): boolean {
  return p.tipo === "operativo"
    ? ORDEN_OPERATIVO.indexOf(op) >= ORDEN_OPERATIVO.indexOf(p.hacia)
    : ORDEN_INSTALACION.indexOf(ins) >= ORDEN_INSTALACION.indexOf(p.hacia);
}

/** Una fase está cumplida si alguien la marcó o si la unidad ya pasó por ella (unidades de antes del Sprint 5). */
export function estaCumplida(fase: Fase, marcada: boolean, op: EstadoOperativo, ins: EstadoInstalacion): boolean {
  if (marcada) return true;
  const pasos = PASOS_DE_FASE[fase];
  return yaEsta(pasos[pasos.length - 1], op, ins);
}

export type VistaFase = {
  fase: Fase;
  fechaEstimada: Date | null;
  cumplida: boolean;
  cumplidaEn: Date | null;
  cumplidaPor: string | null;
  /** La primera fase sin cumplir: la que toca. */
  actual: boolean;
};

/** Las 6 fases de una unidad, con lo guardado y lo que se deduce de su estado. */
export function vistaFases(
  guardadas: { fase: Fase; fechaEstimada: Date | null; cumplidaEn: Date | null; cumplidaPor: string | null }[],
  op: EstadoOperativo,
  ins: EstadoInstalacion
): VistaFase[] {
  let tocaYa = false;
  return FASES.map((fase) => {
    const g = guardadas.find((x) => x.fase === fase);
    const cumplida = estaCumplida(fase, !!g?.cumplidaEn, op, ins);
    const actual = !cumplida && !tocaYa;
    if (actual) tocaYa = true;
    return { fase, fechaEstimada: g?.fechaEstimada ?? null, cumplida, cumplidaEn: g?.cumplidaEn ?? null, cumplidaPor: g?.cumplidaPor ?? null, actual };
  });
}
