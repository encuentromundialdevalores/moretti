import type { EstadoExhibicion } from "@prisma/client";
import { ETIQUETA_INSTALACION, ETIQUETA_OPERATIVO, type EstadoInstalacion, type EstadoOperativo } from "@/lib/motor/operacion";

const EXH: Record<EstadoExhibicion, [string, string]> = {
  PENDIENTE: ["Programado", "wait"],
  PAGADA: ["Pagado", "ok"],
  VENCIDA: ["Vencido", "late"],
  REEMPLAZADA: ["Reemplazado", "wait"],
  CANCELADA: ["Cancelado", "wait"],
};
export function ChipExhibicion({ estado }: { estado: EstadoExhibicion }) {
  const [t, c] = EXH[estado];
  return <span className={`chip ${c}`}>{t}</span>;
}

export function ChipOperativo({ estado }: { estado: EstadoOperativo }) {
  const c = estado === "EN_ALMACEN" || estado === "PRODUCIDO" ? "ok" : estado === "PENDIENTE" ? "wait" : "info";
  return <span className={`chip ${c}`}>{ETIQUETA_OPERATIVO[estado]}</span>;
}

export function ChipInstalacion({ estado }: { estado: EstadoInstalacion }) {
  const c = estado === "ENTREGADA" || estado === "INSTALADA" ? "ok" : estado === "PROGRAMADA" ? "info" : "wait";
  return <span className={`chip ${c}`}>{ETIQUETA_INSTALACION[estado]}</span>;
}

export function Chip({ texto, clase }: { texto: string; clase: "ok" | "late" | "warn" | "wait" | "info" }) {
  return <span className={`chip ${clase}`}>{texto}</span>;
}

export const fechaCorta = (f: Date) =>
  f.toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function SinDatos({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-[15px] text-ink-2">{children}</div>;
}
