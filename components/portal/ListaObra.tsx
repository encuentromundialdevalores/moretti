import Link from "next/link";
import { Estado } from "@/components/admin/Bo";
import { Seccion, Vacio } from "./Kit";
import { fechaCorta } from "./Chips";
import { unidadesConFases } from "@/lib/portal-datos";
import { FASE, FASES, vistaFases } from "@/lib/fases";

type Responsable = "MORETTI" | "VERIFICADOR";

/**
 * Las unidades vendidas por fase de obra, para Moretti o el verificador:
 * primero las que le tocan, luego las que esperan al otro, y las terminadas
 * al final. Cada fila abre el pop-up de la unidad (?u=).
 */
export default async function ListaObra({ rol, base }: { rol: Responsable; base: string }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const filas = (await unidadesConFases()).map((x) => {
    const fases = vistaFases(x.fases, x.estadoOperativo, x.estadoInstalacion);
    const actual = fases.find((f) => f.actual) ?? null;
    return { x, fases, actual };
  });
  const teToca = filas.filter((f) => f.actual && FASE[f.actual.fase].responsable === rol);
  const esperan = filas.filter((f) => f.actual && FASE[f.actual.fase].responsable !== rol);
  const terminadas = filas.filter((f) => !f.actual);
  const otro = rol === "MORETTI" ? "al verificador" : "a Moretti";

  const fila = ({ x, fases, actual }: (typeof filas)[number]) => {
    const fecha = actual?.fechaEstimada ?? null;
    const atrasada = !!fecha && fecha.toISOString().slice(0, 10) < hoy;
    // Moretti no puede hacer el pedido sin que el comprador liquide (R5).
    const bloqueo = actual?.fase === "PEDIDO" && x.estadoFinanciero !== "LIQUIDADO"
      ? "Espera a que el comprador termine de pagar"
      : x.estadoFinanciero === "SUSPENDIDO" ? "En pausa: pagos atrasados" : null;
    return (
      <li key={x.id}>
        <Link href={`${base}?u=${x.id}`} scroll={false} className="pt-fila pt-fila-link">
          <div className="pt-unidad"><b>{x.torre} {x.numero}</b><span>{x.proyecto.nombre} · {x.comprador?.planes[0]?.paquete.nombre ?? "—"}</span></div>
          <div className="pt-medio">
            <ol className="pt-mini" aria-label={`${fases.filter((f) => f.cumplida).length} de ${FASES.length} fases`}>
              {fases.map((f) => <li key={f.fase} data-estado={f.cumplida ? "hecha" : f.actual ? "ahora" : undefined} title={FASE[f.fase].nombre} />)}
            </ol>
            <span>{actual ? FASE[actual.fase].nombre : "Entregada"}</span>
          </div>
          <div className="pt-accion pt-espera">
            {bloqueo ?? (actual ? (fecha ? <span className={atrasada ? "text-warm" : undefined}>{atrasada ? "Atrasada · " : ""}{fechaCorta(fecha)}</span> : "Sin fecha") : <span className="chip ok">Lista</span>)}
          </div>
        </Link>
      </li>
    );
  };

  if (filas.length === 0) return <Vacio>Todavía no hay unidades vendidas.</Vacio>;
  return (
    <>
      {teToca.length > 0
        ? <Estado tipo="aviso" titulo={teToca.length === 1 ? "1 unidad espera tu fase" : `${teToca.length} unidades esperan tu fase`}>Dale clic a una unidad para poner fechas, marcar cumplida o anotar observaciones.</Estado>
        : <Estado tipo="ok" titulo="No tienes fases pendientes">Lo demás espera {otro}.</Estado>}
      {teToca.length > 0 && <Seccion titulo="Te toca a ti" cuenta={teToca.length}><ul className="pt-lista">{teToca.map(fila)}</ul></Seccion>}
      {esperan.length > 0 && <Seccion titulo={`Esperando ${otro}`} cuenta={esperan.length} nota="Puedes ver sus fechas, pero no cambiarlas"><ul className="pt-lista">{esperan.map(fila)}</ul></Seccion>}
      {terminadas.length > 0 && (
        <details className="pt-mas">
          <summary>Ver {terminadas.length} terminadas</summary>
          <ul className="pt-lista">{terminadas.map(fila)}</ul>
        </details>
      )}
    </>
  );
}

