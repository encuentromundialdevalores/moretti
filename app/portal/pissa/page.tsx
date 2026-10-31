import { connection } from "next/server";
import { Encabezado } from "@/components/portal/Encabezado";
import { Chip, SinDatos } from "@/components/portal/Chips";
import { exigirRol } from "@/lib/portal";
import { unidadesParaDesarrollador } from "@/lib/portal-datos";
import { comoVaParaDesarrollador } from "@/lib/permisos";

/** Unidades vendidas (maqueta p-unid). Sólo las de su desarrollador, sin precios ni comprador. */
export default async function UnidadesPissa() {
  await connection();
  const u = await exigirRol("DESARROLLADOR");
  const unidades = u.desarrolladorId ? await unidadesParaDesarrollador(u.desarrolladorId) : [];
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Unidades vendidas" descripcion="Cuáles de tus unidades llevan paquete y cómo van. Te sirve saber que tus clientes van a recibir su depa terminado, no cuánto pagaron." />
      {unidades.length === 0 ? <SinDatos>Todavía no hay unidades con paquete.</SinDatos> : (
        <table className="tbl">
          <thead><tr><th>Desarrollo</th><th>Torre</th><th>Unidad</th><th>Paquete</th><th>Cómo va</th></tr></thead>
          <tbody>
            {unidades.map((x) => {
              const v = comoVaParaDesarrollador(x.estadoOperativo, x.estadoInstalacion);
              return (
                <tr key={x.id}>
                  <td>{x.proyecto.nombre}</td><td>{x.torre}</td><td>{x.numero}</td>
                  <td>{x.comprador?.planes[0]?.paquete.nombre ?? "—"}</td>
                  <td><Chip texto={v} clase={v === "Por arrancar" ? "wait" : v === "En proceso" ? "info" : "ok"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bo-nota">PISSA no cobra, no factura el equipamiento, no instala y no responde por la garantía. Sigue entregando en obra blanca, como hoy.</p>
    </div>
  );
}
