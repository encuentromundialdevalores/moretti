import { connection } from "next/server";
import { Estado } from "@/components/admin/Bo";
import { Fila, Lista, Saludo, Seccion } from "@/components/portal/Kit";
import { fechaCorta } from "@/components/portal/Chips";
import BotonAvance from "@/components/portal/BotonAvance";
import ActaForm from "@/components/portal/ActaForm";
import { exigirRol } from "@/lib/portal";
import { unidadesParaVerificador } from "@/lib/portal-datos";

/**
 * Por recibir (maqueta o-inst): lo instalado, con la lista de piezas a revisar
 * y el acta. Primero el acta, luego «entregada».
 */
export default async function Instalaciones() {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  const unidades = await unidadesParaVerificador();
  const porRecibir = unidades.filter((x) => x.estadoInstalacion === "INSTALADA");
  const programadas = unidades.filter((x) => x.estadoInstalacion === "PROGRAMADA");
  const entregadas = unidades.filter((x) => x.estadoInstalacion === "ENTREGADA");

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Por recibir">Revisa pieza por pieza con el comprador y firmen el acta. Sin acta no hay entrega, y la garantía corre desde ese día.</Saludo>

      {porRecibir.length > 0
        ? <Estado tipo="aviso" titulo={porRecibir.length === 1 ? "Tienes 1 instalación por recibir" : `Tienes ${porRecibir.length} instalaciones por recibir`} />
        : <Estado tipo="ok" titulo="No hay instalaciones por recibir">Cuando Moretti termine una, aparece aquí.</Estado>}

      {porRecibir.map((x) => {
        const plan = x.comprador?.planes[0];
        return (
          <article key={x.id} className="pt-tarjeta">
            <div className="pt-tarjeta-cab">
              <h3>{x.torre} {x.numero}</h3>
              <span>{x.proyecto.nombre} · Paquete {plan?.paquete.nombre}</span>
            </div>
            <div>
              <p className="bo-k mb-3">Qué revisar</p>
              <ul className="pt-check">
                {plan?.renglones.map((r, i) => <li key={i}><span>{r.partida.nombre}{r.cantidad > 1 && ` ×${r.cantidad}`} <small>{r.acabado ?? ""}</small></span></li>)}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
              <span className="text-[13px] font-semibold text-muted">1. Acta</span>
              {x.actaEntrega ? <span className="chip ok">Firmada por {x.actaEntrega.quienFirmo} · {fechaCorta(x.actaEntrega.fechaFirma)}</span> : <ActaForm unidadId={x.id} />}
              <span className="text-[13px] font-semibold text-muted">2. Entrega</span>
              {x.actaEntrega ? <BotonAvance unidadId={x.id} tipo="instalacion" hacia="ENTREGADA" texto="Marcar entregada" /> : <span className="text-[13px] text-muted">Primero el acta</span>}
            </div>
          </article>
        );
      })}

      {programadas.length > 0 && (
        <Seccion titulo="Moretti está instalando" cuenta={programadas.length} nota="Te toca cuando terminen">
          <Lista>{programadas.map((x) => <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={x.proyecto.nombre} medio={`Paquete ${x.comprador?.planes[0]?.paquete.nombre ?? "—"}`}><span className="chip info">Instalación programada</span></Fila>)}</Lista>
        </Seccion>
      )}

      {entregadas.length > 0 && (
        <details className="pt-mas">
          <summary>Ver {entregadas.length} ya entregadas</summary>
          <Lista>{entregadas.map((x) => <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={x.proyecto.nombre} medio={x.actaEntrega ? `Acta: ${x.actaEntrega.quienFirmo} · ${fechaCorta(x.actaEntrega.fechaFirma)}` : ""}><span className="chip ok">Entregada</span></Fila>)}</Lista>
        </details>
      )}
    </div>
  );
}
