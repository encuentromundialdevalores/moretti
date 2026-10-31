import { connection } from "next/server";
import { Encabezado } from "@/components/portal/Encabezado";
import { Chip, ChipInstalacion, SinDatos, fechaCorta } from "@/components/portal/Chips";
import BotonAvance from "@/components/portal/BotonAvance";
import ActaForm from "@/components/portal/ActaForm";
import { exigirRol } from "@/lib/portal";
import { unidadesParaVerificador } from "@/lib/portal-datos";

/** Instalaciones por recibir (maqueta o-inst): partidas a revisar y el acta. */
export default async function Instalaciones() {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  const unidades = (await unidadesParaVerificador()).filter((x) => x.estadoInstalacion !== "NO_PROGRAMADA");
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Instalaciones por recibir" descripcion="Revisa la instalación y levanta el acta con el comprador. Sin acta no hay entrega; la garantía arranca el día que se recibe." />
      {unidades.length === 0 ? <SinDatos>No hay instalaciones programadas todavía.</SinDatos> : (
        <div className="flex flex-col gap-5">
          {unidades.map((x) => {
            const plan = x.comprador?.planes[0];
            return (
              <section key={x.id} className="card flex flex-col gap-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[18px] font-semibold">{x.torre} {x.numero} <span className="text-[13px] font-normal text-muted">· {x.proyecto.nombre} · {plan?.paquete.nombre}</span></h2>
                  <ChipInstalacion estado={x.estadoInstalacion} />
                </div>
                <table className="tbl">
                  <thead><tr><th>Partida a revisar</th><th className="r">Cantidad</th><th>Acabado</th></tr></thead>
                  <tbody>
                    {plan?.renglones.map((r, i) => <tr key={i}><td>{r.partida.nombre}</td><td className="r">{r.cantidad}</td><td>{r.acabado ?? "—"}</td></tr>)}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-start gap-4">
                  {x.actaEntrega ? <Chip texto={`Acta firmada por ${x.actaEntrega.quienFirmo} · ${fechaCorta(x.actaEntrega.fechaFirma)}`} clase="ok" /> : x.estadoInstalacion === "INSTALADA" ? <ActaForm unidadId={x.id} /> : <Chip texto="Acta pendiente" clase="wait" />}
                  {x.estadoInstalacion === "INSTALADA" && x.actaEntrega && <BotonAvance unidadId={x.id} tipo="instalacion" hacia="ENTREGADA" texto="Entregada" />}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="bo-nota">Ves las partidas para saber qué revisar, pero no pagos, ni precios, ni documentos del contrato.</p>
    </div>
  );
}
