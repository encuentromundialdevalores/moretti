import { connection } from "next/server";
import { Estado } from "@/components/admin/Bo";
import { Avance, Fila, Lista, Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import BotonAvance from "@/components/portal/BotonAvance";
import { exigirRol } from "@/lib/portal";
import { unidadesParaMoretti } from "@/lib/portal-datos";
import { tareaMoretti } from "@/lib/portal-etapas";

/**
 * Unidades por producir (maqueta m-unid), ordenadas por lo que Moretti tiene
 * que hacer: primero lo que le toca, después lo que espera a otro (y a quién).
 * Sin montos ni comisión del canal.
 */
export default async function UnidadesMoretti() {
  await connection();
  const u = await exigirRol("MORETTI");
  const unidades = (await unidadesParaMoretti()).map((x) => ({ x, t: tareaMoretti(x.estadoOperativo, x.estadoInstalacion, x.estadoFinanciero) }));
  const teToca = unidades.filter((r) => r.t.tipo === "hacer");
  const esperan = unidades.filter((r) => r.t.tipo === "esperar");
  const listas = unidades.filter((r) => r.t.tipo === "lista");

  const fila = ({ x, t }: (typeof unidades)[number]) => (
    <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={`${x.proyecto.nombre} · ${x.comprador?.planes[0]?.paquete.nombre ?? "—"}`} medio={<Avance op={x.estadoOperativo} ins={x.estadoInstalacion} />}>
      {t.tipo === "hacer" && <BotonAvance unidadId={x.id} tipo={t.campo} hacia={t.hacia} texto={t.texto} />}
      {t.tipo === "esperar" && <span className="pt-espera">{t.porque}</span>}
      {t.tipo === "lista" && <span className="chip ok">Entregada</span>}
    </Fila>
  );

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tus unidades">Lo vendido y en qué paso va. Cuando termines un paso, márcalo aquí con un clic.</Saludo>

      {unidades.length === 0 ? <Vacio>Todavía no hay unidades vendidas.</Vacio> : (
        <>
          {teToca.length > 0
            ? <Estado tipo="aviso" titulo={teToca.length === 1 ? "Tienes 1 unidad lista para avanzar" : `Tienes ${teToca.length} unidades listas para avanzar`}>Están hasta arriba.</Estado>
            : <Estado tipo="ok" titulo="No tienes nada pendiente">Todo lo demás espera a otra persona; abajo dice a quién.</Estado>}

          {teToca.length > 0 && <Seccion titulo="Te toca a ti" cuenta={teToca.length}><Lista>{teToca.map(fila)}</Lista></Seccion>}
          {esperan.length > 0 && <Seccion titulo="Esperando a otros" cuenta={esperan.length} nota="No necesitas hacer nada todavía"><Lista>{esperan.map(fila)}</Lista></Seccion>}
          {listas.length > 0 && (
            <details className="pt-mas">
              <summary>Ver {listas.length} {listas.length === 1 ? "unidad entregada" : "unidades entregadas"}</summary>
              <Lista>{listas.map(fila)}</Lista>
            </details>
          )}
        </>
      )}

      <p className="bo-nota">Ninguna unidad entra a producción sin estar pagada por completo: el sistema no lo deja.</p>
    </div>
  );
}
