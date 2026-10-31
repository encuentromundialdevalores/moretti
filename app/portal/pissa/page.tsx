import { connection } from "next/server";
import { Avance, Fila, Lista, Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import { exigirRol } from "@/lib/portal";
import { unidadesParaDesarrollador } from "@/lib/portal-datos";
import { comoVaParaDesarrollador } from "@/lib/permisos";

/** Unidades vendidas (maqueta p-unid): cuántas, cómo van y por desarrollo. Sin precios ni comprador. */
export default async function UnidadesPissa() {
  await connection();
  const u = await exigirRol("DESARROLLADOR");
  const unidades = u.desarrolladorId ? await unidadesParaDesarrollador(u.desarrolladorId) : [];
  const como = unidades.map((x) => comoVaParaDesarrollador(x.estadoOperativo, x.estadoInstalacion));
  const entregadas = como.filter((c) => c === "Entregada").length;
  const proyectos = [...new Set(unidades.map((x) => x.proyecto.nombre))];

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tus unidades con paquete">Tus clientes van a recibir su departamento equipado. Aquí ves cómo va cada uno; tú sigues entregando en obra blanca.</Saludo>

      {unidades.length === 0 ? <Vacio>Todavía no hay unidades con paquete.</Vacio> : (
        <>
          <div className="pt-numeros">
            <div className="pt-numero" data-destacado><p className="bo-k">Con paquete</p><b>{unidades.length}</b></div>
            <div className="pt-numero"><p className="bo-k">En camino</p><b>{unidades.length - entregadas}</b></div>
            <div className="pt-numero"><p className="bo-k">Entregadas</p><b>{entregadas}</b></div>
          </div>

          {proyectos.map((p) => {
            const deP = unidades.filter((x) => x.proyecto.nombre === p);
            return (
              <Seccion key={p} titulo={p} cuenta={deP.length}>
                <Lista>
                  {deP.map((x) => (
                    <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={`Paquete ${x.comprador?.planes[0]?.paquete.nombre ?? "—"}`} medio={<Avance op={x.estadoOperativo} ins={x.estadoInstalacion} />}>
                      <span className={`chip ${comoVaParaDesarrollador(x.estadoOperativo, x.estadoInstalacion) === "Entregada" ? "ok" : "info"}`}>{comoVaParaDesarrollador(x.estadoOperativo, x.estadoInstalacion)}</span>
                    </Fila>
                  ))}
                </Lista>
              </Seccion>
            );
          })}
        </>
      )}

      <p className="bo-nota">PISSA no cobra, no factura, no instala y no responde por la garantía del equipamiento.</p>
    </div>
  );
}
