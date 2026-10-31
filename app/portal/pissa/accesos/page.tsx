import { connection } from "next/server";
import { Estado } from "@/components/admin/Bo";
import { Fila, Lista, Saludo, Seccion } from "@/components/portal/Kit";
import { exigirRol } from "@/lib/portal";
import { unidadesParaDesarrollador } from "@/lib/portal-datos";
import { quienEntra } from "@/lib/portal-etapas";

/**
 * Accesos (maqueta p-inst): a qué unidades va a entrar gente y quién.
 * Todavía no se guardan fechas de visita (sólo la etapa): ver docs/usuarios-y-roles.md.
 */
export default async function AccesosPissa() {
  await connection();
  const u = await exigirRol("DESARROLLADOR");
  const todas = u.desarrolladorId ? await unidadesParaDesarrollador(u.desarrolladorId) : [];
  const visitas = todas.flatMap((x) => {
    const quien = quienEntra(x.estadoOperativo, x.estadoInstalacion);
    return quien ? [{ x, quien }] : [];
  });
  const grupos = [...new Set(visitas.map((v) => v.quien))];

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Quién va a entrar">Lo único que necesitas coordinar: a qué departamentos va a entrar gente a trabajar.</Saludo>

      {visitas.length === 0
        ? <Estado tipo="ok" titulo="No hay visitas pendientes">Nadie necesita entrar a tus edificios por ahora.</Estado>
        : <Estado tipo="aviso" titulo={visitas.length === 1 ? "1 departamento va a recibir visita" : `${visitas.length} departamentos van a recibir visita`}>Las fechas exactas llegarán cuando se guarde el calendario de obra.</Estado>}

      {grupos.map((g) => {
        const deG = visitas.filter((v) => v.quien === g);
        return (
          <Seccion key={g} titulo={g} cuenta={deG.length}>
            <Lista>{deG.map(({ x }) => <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={x.proyecto.nombre} />)}</Lista>
          </Seccion>
        );
      })}
    </div>
  );
}
