import { connection } from "next/server";
import { Encabezado } from "@/components/portal/Encabezado";
import { Chip, ChipOperativo, SinDatos } from "@/components/portal/Chips";
import BotonAvance from "@/components/portal/BotonAvance";
import { exigirRol } from "@/lib/portal";
import { unidadesParaVerificador } from "@/lib/portal-datos";

/** Levantamientos (maqueta o-medir). Sin pagos, precios ni contrato. */
export default async function Levantamientos() {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  const unidades = await unidadesParaVerificador();
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Levantamientos" descripcion="Las unidades vendidas que hay que medir. Después del levantamiento se cierran los cambios de paquete y acabados." />
      {unidades.length === 0 ? <SinDatos>No hay unidades por medir.</SinDatos> : (
        <table className="tbl">
          <thead><tr><th>Unidad</th><th>Paquete</th><th>Etapa</th><th>Acta de medición</th><th></th></tr></thead>
          <tbody>
            {unidades.map((x) => {
              const medida = x.estadoOperativo !== "PENDIENTE";
              return (
                <tr key={x.id}>
                  <td><b>{x.torre} {x.numero}</b><br /><span className="text-[12.5px] text-muted">{x.proyecto.nombre}</span></td>
                  <td>{x.comprador?.planes[0]?.paquete.nombre ?? "—"}</td>
                  <td><ChipOperativo estado={x.estadoOperativo} /></td>
                  <td>{medida ? <Chip texto="Hecho" clase="ok" /> : <Chip texto="Pendiente" clase="wait" />}</td>
                  <td>{!medida && <BotonAvance unidadId={x.id} tipo="operativo" hacia="LEVANTAMIENTO_HECHO" texto="Levantamiento hecho" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bo-nota">Los planos no traen cotas de fabricante y una cocina se hace al milímetro. Por eso mide un tercero: nadie califica su propio trabajo.</p>
    </div>
  );
}
