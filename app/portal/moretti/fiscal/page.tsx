import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Estado } from "@/components/admin/Bo";
import { Fila, Lista, Saludo, Seccion } from "@/components/portal/Kit";
import { fechaCorta } from "@/components/portal/Chips";
import FolioForm from "@/components/portal/FolioForm";
import { exigirRol } from "@/lib/portal";
import { comprobantesParaMoretti } from "@/lib/portal-datos";
import { diasParaVencer, urgenciaComprobante } from "@/lib/motor/fiscal";
import { conceptoExhibicion } from "@/lib/motor/recalculo";

/** Facturas por subir (maqueta m-fisc): la fecha más próxima arriba y un renglón por cobro. */
export default async function FiscalMoretti() {
  await connection();
  const u = await exigirRol("MORETTI");
  const pendientes = await comprobantesParaMoretti();
  const hoy = new Date();
  const proxima = pendientes[0];
  const dias = proxima ? diasParaVencer(proxima.fechaLimite, hoy) : 0;
  const urg = proxima ? urgenciaComprobante(proxima.fechaLimite, hoy) : "a_tiempo";
  const vencidas = pendientes.filter((c) => urgenciaComprobante(c.fechaLimite, hoy) === "vencido").length;

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Facturas por subir">Cada cobro necesita su factura a más tardar el día 5 del mes siguiente. Pega el folio o sube el XML.</Saludo>

      {!proxima ? (
        <Estado tipo="ok" titulo="Estás al día">No tienes facturas pendientes.</Estado>
      ) : (
        <div className="bo-card bo-limite">
          <div className={`bo-limite-dias ${urg === "vencido" ? "late" : urg === "por_vencer" ? "warn" : ""}`}>
            <b>{Math.abs(dias)}</b><span>{urg === "vencido" ? "días tarde" : dias === 1 ? "día" : "días"}</span>
          </div>
          <div>
            <h3>{pendientes.length} {pendientes.length === 1 ? "factura pendiente" : "facturas pendientes"}</h3>
            <p>{vencidas > 0 ? `${vencidas} ya pasaron su fecha. ` : ""}La más próxima vence el {fechaCorta(proxima.fechaLimite)}.</p>
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <Seccion titulo="Pendientes" cuenta={pendientes.length} nota="La más urgente primero">
          <Lista>
            {pendientes.map((c) => {
              const un = c.pago.plan.comprador.unidad;
              const d = diasParaVencer(c.fechaLimite, hoy);
              const ur = urgenciaComprobante(c.fechaLimite, hoy);
              return (
                <Fila
                  key={c.id}
                  unidad={`${un.torre} ${un.numero}`}
                  detalle={`${conceptoExhibicion(c.pago.exhibicion.numero, c.pago.exhibicion.tipo)} · ${fechaCorta(c.fechaCobro)}`}
                  medio={
                    <span className="flex flex-wrap items-center gap-3">
                      <b className="text-[16px] text-ink"><Money valor={Number(c.monto)} conCentavos /></b>
                      <span className={`chip ${ur === "vencido" ? "late" : ur === "por_vencer" ? "warn" : "wait"}`}>
                        {ur === "vencido" ? `Venció hace ${-d} d` : d === 0 ? "Vence hoy" : `Vence en ${d} d`}
                      </span>
                    </span>
                  }
                >
                  <FolioForm id={c.id} />
                </Fila>
              );
            })}
          </Lista>
        </Seccion>
      )}

      <p className="bo-nota">Por ahora se revisa que el folio tenga forma correcta; la verificación contra el SAT queda pendiente.</p>
    </div>
  );
}
