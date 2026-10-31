import { connection } from "next/server";
import { ChipEstadoFinanciero } from "@/components/ui";
import { Encabezado } from "@/components/portal/Encabezado";
import { ChipInstalacion, ChipOperativo, SinDatos } from "@/components/portal/Chips";
import BotonAvance from "@/components/portal/BotonAvance";
import { exigirRol } from "@/lib/portal";
import { unidadesParaMoretti } from "@/lib/portal-datos";
import { ETIQUETA_INSTALACION, ETIQUETA_OPERATIVO, siguienteInstalacion, siguienteOperativo } from "@/lib/motor/operacion";
import { puedeMarcarInstalacion, puedeMarcarOperativo } from "@/lib/permisos";

/** Unidades por producir (maqueta m-unid). Sin datos financieros del canal. */
export default async function UnidadesMoretti() {
  await connection();
  const u = await exigirRol("MORETTI");
  const unidades = await unidadesParaMoretti();
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Unidades por producir" descripcion="Lo vendido, si va pagado y en qué etapa está. Marca tu avance aquí." />
      {unidades.length === 0 ? <SinDatos>Todavía no hay unidades vendidas.</SinDatos> : (
        <table className="tbl">
          <thead><tr><th>Unidad</th><th>Paquete</th><th>Plan de pagos</th><th>Etapa</th><th>Instalación</th><th>Siguiente paso</th></tr></thead>
          <tbody>
            {unidades.map((x) => {
              const op = siguienteOperativo(x.estadoOperativo);
              const ins = siguienteInstalacion(x.estadoInstalacion);
              return (
                <tr key={x.id}>
                  <td><b>{x.torre} {x.numero}</b><br /><span className="text-[12.5px] text-muted">{x.proyecto.nombre}</span></td>
                  <td>{x.comprador?.planes[0]?.paquete.nombre ?? "—"}</td>
                  <td><ChipEstadoFinanciero estado={x.estadoFinanciero} /></td>
                  <td><ChipOperativo estado={x.estadoOperativo} /></td>
                  <td><ChipInstalacion estado={x.estadoInstalacion} /></td>
                  <td><div className="flex flex-col items-start gap-2">
                    {op && puedeMarcarOperativo(u.rol, op) && <BotonAvance unidadId={x.id} tipo="operativo" hacia={op} texto={ETIQUETA_OPERATIVO[op]} />}
                    {ins && puedeMarcarInstalacion(u.rol, ins) && <BotonAvance unidadId={x.id} tipo="instalacion" hacia={ins} texto={ETIQUETA_INSTALACION[ins]} />}
                    {!(op && puedeMarcarOperativo(u.rol, op)) && !(ins && puedeMarcarInstalacion(u.rol, ins)) && <span className="text-[12.5px] text-muted">Le toca a otro</span>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bo-nota">Ninguna unidad entra a producción sin estar liquidada: el sistema no lo deja. No ves la comisión del canal.</p>
    </div>
  );
}
