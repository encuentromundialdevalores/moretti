/**
 * El camino de una unidad dicho en cinco pasos que cualquiera entiende, y qué
 * le toca a cada perfil. Pura: las páginas del portal la usan para decir
 * «esto te toca a ti» o «esto espera a otro, y a quién». Las reglas que de
 * verdad deciden siguen en lib/motor/operacion.ts.
 */

import type { EstadoFinanciero } from "@prisma/client";
import type { EstadoInstalacion, EstadoOperativo } from "./motor/operacion";

export const ETAPAS = ["Medición", "Acabados", "Fabricación", "Instalación", "Entrega"] as const;

/** Cuántos de los cinco pasos ya están hechos (0 a 5). */
export function pasosHechos(op: EstadoOperativo, ins: EstadoInstalacion): number {
  if (ins === "ENTREGADA") return 5;
  if (ins === "INSTALADA") return 4;
  if (op === "PRODUCIDO" || op === "EN_ALMACEN") return 3;
  if (op === "ACABADOS_ELEGIDOS" || op === "EN_PRODUCCION") return 2;
  if (op === "LEVANTAMIENTO_HECHO") return 1;
  return 0;
}

/** Qué está pasando ahora, en una frase para el comprador. */
export function queSigueParaComprador(op: EstadoOperativo, ins: EstadoInstalacion): { titulo: string; texto: string } {
  switch (pasosHechos(op, ins)) {
    case 0: return { titulo: "Sigue la medición", texto: "Un verificador va a ir a tu departamento a tomar medidas al milímetro." };
    case 1: return { titulo: "Sigue confirmar acabados", texto: "Con las medidas listas, se confirman los acabados que elegiste." };
    case 2: return op === "EN_PRODUCCION"
      ? { titulo: "Tu equipamiento se está fabricando", texto: "Moretti lo fabrica a la medida de tu departamento." }
      : { titulo: "Sigue la fabricación", texto: "Moretti empieza a fabricar cuando tu plan queda liquidado." };
    case 3: return ins === "PROGRAMADA"
      ? { titulo: "Tu instalación ya tiene fecha", texto: "Moretti va a instalar en tu departamento." }
      : { titulo: "Ya está fabricado", texto: "Está en almacén esperando su fecha de instalación." };
    case 4: return { titulo: "Ya está instalado", texto: "Falta recibirlo: el verificador lo revisa contigo y firman el acta." };
    default: return { titulo: "Entregado", texto: "Tu departamento ya está equipado. Tu garantía corre desde el día de la entrega." };
  }
}

export type TareaMoretti =
  | { tipo: "hacer"; campo: "operativo" | "instalacion"; hacia: EstadoOperativo | EstadoInstalacion; texto: string }
  | { tipo: "esperar"; porque: string }
  | { tipo: "lista" };

/** Para Moretti: el botón que le toca o por qué no le toca nada todavía. */
export function tareaMoretti(op: EstadoOperativo, ins: EstadoInstalacion, fin: EstadoFinanciero): TareaMoretti {
  if (ins === "ENTREGADA") return { tipo: "lista" };
  if (fin === "SUSPENDIDO") return { tipo: "esperar", porque: "En pausa: el comprador va atrasado en sus pagos." };
  if (fin === "CANCELADO") return { tipo: "esperar", porque: "La venta se canceló." };
  switch (op) {
    case "PENDIENTE": return { tipo: "esperar", porque: "Falta que el verificador mida." };
    case "LEVANTAMIENTO_HECHO": return { tipo: "esperar", porque: "Falta confirmar los acabados." };
    case "ACABADOS_ELEGIDOS":
      return fin === "LIQUIDADO"
        ? { tipo: "hacer", campo: "operativo", hacia: "EN_PRODUCCION", texto: "Empezar a producir" }
        : { tipo: "esperar", porque: "Falta que el comprador termine de pagar." };
    case "EN_PRODUCCION": return { tipo: "hacer", campo: "operativo", hacia: "PRODUCIDO", texto: "Ya está producido" };
    case "PRODUCIDO": return { tipo: "hacer", campo: "operativo", hacia: "EN_ALMACEN", texto: "Ya está en almacén" };
  }
  // EN_ALMACEN: lo que sigue es la instalación.
  if (ins === "NO_PROGRAMADA") return { tipo: "esperar", porque: "día uno programa la fecha de instalación." };
  if (ins === "PROGRAMADA") return { tipo: "hacer", campo: "instalacion", hacia: "INSTALADA", texto: "Ya quedó instalado" };
  return { tipo: "esperar", porque: "Falta que el verificador lo reciba." };
}

/** Para PISSA: quién entra a la unidad, si alguien tiene que entrar. */
export function quienEntra(op: EstadoOperativo, ins: EstadoInstalacion): string | null {
  if (op === "PENDIENTE") return "El verificador, a medir";
  if (ins === "PROGRAMADA") return "Moretti, a instalar";
  if (ins === "INSTALADA") return "El verificador, a recibir con el comprador";
  return null;
}
