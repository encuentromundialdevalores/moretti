import { connection } from "next/server";
import { Encabezado } from "@/components/portal/Encabezado";
import { ChipInstalacion, ChipOperativo, SinDatos } from "@/components/portal/Chips";
import { exigirRol } from "@/lib/portal";
import { unidadesParaDesarrollador } from "@/lib/portal-datos";

/**
 * Accesos e instalaciones (maqueta p-inst): cuándo entra gente a su edificio.
 * El sistema todavía no guarda fechas de levantamiento ni de instalación
 * (sólo el estado), así que se muestra qué unidades tienen visita pendiente.
 */
export default async function AccesosPissa() {
  await connection();
  const u = await exigirRol("DESARROLLADOR");
  const todas = u.desarrolladorId ? await unidadesParaDesarrollador(u.desarrolladorId) : [];
  const conVisita = todas.filter((x) => x.estadoOperativo === "PENDIENTE" || x.estadoInstalacion === "PROGRAMADA" || x.estadoInstalacion === "INSTALADA");
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Accesos e instalaciones" descripcion="Lo único que necesitas coordinar: a qué unidades va a entrar gente." />
      {conVisita.length === 0 ? <SinDatos>No hay visitas pendientes en tus edificios.</SinDatos> : (
        <table className="tbl">
          <thead><tr><th>Unidad</th><th>Qué pasa</th><th>Medición</th><th>Instalación</th></tr></thead>
          <tbody>
            {conVisita.map((x) => (
              <tr key={x.id}>
                <td><b>{x.torre} {x.numero}</b><br /><span className="text-[12.5px] text-muted">{x.proyecto.nombre}</span></td>
                <td>{x.estadoOperativo === "PENDIENTE" ? "Entra el verificador a medir" : x.estadoInstalacion === "PROGRAMADA" ? "Entra Moretti a instalar" : "Entra el verificador a recibir"}</td>
                <td><ChipOperativo estado={x.estadoOperativo} /></td>
                <td><ChipInstalacion estado={x.estadoInstalacion} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="bo-nota">Las fechas exactas de cada visita llegan cuando el sistema guarde el calendario de obra (pendiente, ver docs/usuarios-y-roles.md).</p>
    </div>
  );
}
