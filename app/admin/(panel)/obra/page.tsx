import Link from "next/link";
import { connection } from "next/server";
import { PageHead } from "@/components/ui";
import Calendario, { mesDe } from "@/components/portal/Calendario";
import DetalleUnidad from "@/components/portal/DetalleUnidad";
import { fechaCorta } from "@/components/portal/Chips";
import { unidadesConFases } from "@/lib/portal-datos";
import { FASE, FASES, vistaFases } from "@/lib/fases";
import "../../../portal/portal.css";

/**
 * Obra y calendario (Sprint 5): el calendario de Moretti y el verificador
 * unificado. Día uno abre cualquier unidad, mueve cualquier fecha, marca
 * fases y escribe en la conversación.
 */
export default async function ObraAdmin({ searchParams }: { searchParams: Promise<{ mes?: string; u?: string }> }) {
  await connection();
  const { mes: texto, u: abierta } = await searchParams;
  const mes = mesDe(texto);
  const base = "/admin/obra";
  const unidades = (await unidadesConFases()).map((x) => {
    const fases = vistaFases(x.fases, x.estadoOperativo, x.estadoInstalacion);
    return { x, fases, actual: fases.find((f) => f.actual) ?? null };
  });

  return (
    <div className="flex flex-col gap-10">
      <PageHead eyebrow="Obra" titulo="Obra y calendario" descripcion="Las fechas de Moretti y del verificador en un solo calendario. Tú puedes mover cualquiera: abre la unidad." />
      <Calendario mes={mes} base={base} />

      <section className="bo-seccion">
        <div className="bo-seccion-t"><h2>Unidades vendidas</h2><span>{unidades.length} · clic para abrir</span></div>
        <ul className="pt-lista">
          {unidades.map(({ x, fases, actual }) => (
            <li key={x.id}>
              <Link href={`${base}?mes=${mes.toISOString().slice(0, 7)}&u=${x.id}`} scroll={false} className="pt-fila pt-fila-link">
                <div className="pt-unidad"><b>{x.torre} {x.numero}</b><span>{x.proyecto.nombre} · {x.comprador?.planes[0]?.paquete.nombre ?? "—"}</span></div>
                <div className="pt-medio">
                  <ol className="pt-mini">{fases.map((f) => <li key={f.fase} data-estado={f.cumplida ? "hecha" : f.actual ? "ahora" : undefined} title={FASE[f.fase].nombre} />)}</ol>
                  <span>{actual ? `${FASE[actual.fase].nombre} · ${FASE[actual.fase].responsable === "MORETTI" ? "Moretti" : "Verificador"}` : "Entregada"}</span>
                </div>
                <div className="pt-accion pt-espera">{actual?.fechaEstimada ? fechaCorta(actual.fechaEstimada) : actual ? "Sin fecha" : ""}</div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="bo-nota">{FASES.length} fases por unidad: verde cumplida, ámbar la que toca.</p>
      </section>

      {abierta && <DetalleUnidad unidadId={abierta} rol="ADMIN" admin cerrar={`${base}?mes=${mes.toISOString().slice(0, 7)}`} />}
    </div>
  );
}
