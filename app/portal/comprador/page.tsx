import { connection } from "next/server";
import { Money, CintaExhibiciones, ChipEstadoPlan } from "@/components/ui";
import { Encabezado } from "@/components/portal/Encabezado";
import { ChipExhibicion, SinDatos, fechaCorta } from "@/components/portal/Chips";
import { compradorActual } from "@/components/portal/datos-comprador";
import { conceptoExhibicion } from "@/lib/motor/recalculo";

/** Mi plan de pagos (maqueta c-plan). */
export default async function MiPlan() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Encabezado rol={u.rol} titulo="Mi plan de pagos" /><SinDatos>Todavía no hay un plan ligado a tu cuenta.</SinDatos></>;
  const pagadas = plan.exhibiciones.filter((e) => e.estado === "PAGADA").length;
  const proxima = plan.exhibiciones.find((e) => e.estado === "PENDIENTE" || e.estado === "VENCIDA");
  return (
    <div className="flex flex-col gap-8">
      <Encabezado
        rol={u.rol}
        titulo="Mi plan de pagos"
        descripcion={`${c.unidad.proyecto.nombre} · ${c.unidad.torre} ${c.unidad.numero} · Paquete ${plan.paquete.nombre}`}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi"><p className="label">Pagado</p><p className="figure mt-1 text-[24px]">{pagadas} de {plan.exhibiciones.length}</p></div>
        <div className="kpi"><p className="label">Saldo</p><p className="figure mt-1 text-[24px]"><Money valor={Number(plan.saldo)} /></p></div>
        <div className="kpi">
          <p className="label">Próximo cargo</p>
          <p className="figure mt-1 text-[24px]">{proxima ? fechaCorta(proxima.fechaProgramada) : "—"}</p>
          {c.tarjetaDescripcion && <p className="mt-1 text-[13px] text-muted">a tu {c.tarjetaDescripcion}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3"><ChipEstadoPlan estado={plan.estado} /></div>
      <CintaExhibiciones exhibiciones={plan.exhibiciones} />
      <table className="tbl">
        <thead><tr><th>Pago</th><th>Fecha</th><th className="r">Monto</th><th>Estado</th></tr></thead>
        <tbody>
          {plan.exhibiciones.map((e) => (
            <tr key={e.id}>
              <td>{conceptoExhibicion(e.numero, e.tipo)}</td>
              <td>{fechaCorta(e.fechaProgramada)}</td>
              <td className="r"><Money valor={Number(e.monto)} conCentavos /></td>
              <td><ChipExhibicion estado={e.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bo-nota">Ves tu saldo y tus fechas sin llamarle a nadie. El cargo se hace solo a tu tarjeta en cada fecha.</p>
    </div>
  );
}
