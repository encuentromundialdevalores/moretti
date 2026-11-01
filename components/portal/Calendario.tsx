import Link from "next/link";
import { fechasDeFases } from "@/lib/portal-datos";
import { FASE } from "@/lib/fases";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** «2026-11» → el primer día de ese mes (UTC). Cualquier otra cosa → este mes. */
export function mesDe(texto: string | undefined): Date {
  const m = texto?.match(/^(\d{4})-(\d{2})$/);
  const hoy = new Date();
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
}
const clave = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Calendario del mes con las fechas de las 6 fases de todas las unidades
 * vendidas: Moretti y el verificador ven lo mismo (Sprint 5). Cada fecha
 * abre el pop-up de su unidad, donde cada quien cambia sólo las suyas.
 */
export default async function Calendario({ mes, base }: { mes: Date; base: string }) {
  const siguiente = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1));
  const anterior = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() - 1, 1));
  const fechas = await fechasDeFases(mes, siguiente);
  const hoy = new Date().toISOString().slice(0, 10);

  // Lunes como primer día; huecos antes del 1.
  const huecos = (mes.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 0)).getUTCDate();
  const celdas: (number | null)[] = [...Array(huecos).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);

  return (
    <div className="pt-cal">
      <div className="pt-cal-cab">
        <Link href={`${base}?mes=${clave(anterior)}`} className="btn btn-sm btn-ghost" aria-label="Mes anterior">←</Link>
        <h2>{MESES[mes.getUTCMonth()]} {mes.getUTCFullYear()}</h2>
        <Link href={`${base}?mes=${clave(siguiente)}`} className="btn btn-sm btn-ghost" aria-label="Mes siguiente">→</Link>
        <span className="pt-cal-ley"><i className="m" /> Moretti <i className="v" /> Verificador</span>
      </div>
      <div className="pt-cal-rejilla">
        {DIAS.map((d) => <div key={d} className="pt-cal-dia-n">{d}</div>)}
        {celdas.map((n, i) => {
          if (!n) return <div key={i} className="pt-cal-celda vacia" />;
          const iso = `${clave(mes)}-${String(n).padStart(2, "0")}`;
          const delDia = fechas.filter((f) => f.fechaEstimada!.toISOString().slice(0, 10) === iso);
          return (
            <div key={i} className="pt-cal-celda" data-hoy={iso === hoy || undefined}>
              <span className="pt-cal-n">{n}</span>
              {delDia.map((f) => (
                <Link
                  key={`${f.unidad.id}-${f.fase}`}
                  href={`${base}?mes=${clave(mes)}&u=${f.unidad.id}`}
                  scroll={false}
                  className={`pt-cal-ev ${FASE[f.fase].responsable === "MORETTI" ? "m" : "v"}`}
                  data-hecha={f.cumplidaEn ? true : undefined}
                  title={`${f.unidad.torre} ${f.unidad.numero} · ${FASE[f.fase].nombre}${f.cumplidaEn ? " (cumplida)" : ""}`}
                >
                  <b>{f.unidad.torre} {f.unidad.numero}</b> {FASE[f.fase].nombre}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      {fechas.length === 0 && <p className="pt-det-vacio mt-3">No hay fechas este mes. Las fechas se ponen en el detalle de cada unidad.</p>}
    </div>
  );
}
