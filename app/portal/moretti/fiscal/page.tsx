import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Encabezado } from "@/components/portal/Encabezado";
import { Chip, SinDatos, fechaCorta } from "@/components/portal/Chips";
import FolioForm from "@/components/portal/FolioForm";
import { exigirRol } from "@/lib/portal";
import { comprobantesParaMoretti } from "@/lib/portal-datos";
import { diasParaVencer, urgenciaComprobante } from "@/lib/motor/fiscal";
import { conceptoExhibicion } from "@/lib/motor/recalculo";

/** Pendientes fiscales de Moretti (maqueta m-fisc): un renglón por cobro. */
export default async function FiscalMoretti() {
  await connection();
  const u = await exigirRol("MORETTI");
  const pendientes = await comprobantesParaMoretti();
  const hoy = new Date();
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Pendientes fiscales" descripcion="Cobro por cobro, con su fecha límite de ley: el día 5 del mes siguiente. El XML se sube junto al pago que le toca." />
      {pendientes.length === 0 ? <SinDatos>No tienes pendientes fiscales. ✓</SinDatos> : (
        <table className="tbl">
          <thead><tr><th>Unidad</th><th>Cobro</th><th className="r">Monto</th><th>Fecha límite</th><th>Complemento</th></tr></thead>
          <tbody>
            {pendientes.map((c) => {
              const un = c.pago.plan.comprador.unidad;
              const urg = urgenciaComprobante(c.fechaLimite, hoy);
              const d = diasParaVencer(c.fechaLimite, hoy);
              return (
                <tr key={c.id}>
                  <td>{un.torre} {un.numero}</td>
                  <td>{conceptoExhibicion(c.pago.exhibicion.numero, c.pago.exhibicion.tipo)}<br /><span className="text-[12.5px] text-muted">{fechaCorta(c.fechaCobro)}</span></td>
                  <td className="r"><Money valor={Number(c.monto)} conCentavos /></td>
                  <td>
                    {fechaCorta(c.fechaLimite)}<br />
                    <Chip texto={urg === "vencido" ? `Vencido hace ${-d} d` : d === 0 ? "Vence hoy" : `En ${d} d`} clase={urg === "vencido" ? "late" : urg === "por_vencer" ? "warn" : "wait"} />
                  </td>
                  <td><FolioForm id={c.id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bo-nota">Por ahora se revisa que el folio tenga forma de UUID; la verificación contra el SAT queda pendiente.</p>
    </div>
  );
}
