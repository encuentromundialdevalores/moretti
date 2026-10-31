import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Estado } from "@/components/admin/Bo";
import { Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import { fechaCorta } from "@/components/portal/Chips";
import { compradorActual } from "@/components/portal/datos-comprador";
import { conceptoExhibicion } from "@/lib/motor/recalculo";

/** Mi plan de pagos (maqueta c-plan): el siguiente cargo en grande y la lista completa. */
export default async function MiPlan() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Saludo nombre={u.nombre} titulo="Tu plan de pagos" /><Vacio>Todavía no hay un plan ligado a tu cuenta. Escríbele a día uno.</Vacio></>;

  const total = plan.exhibiciones.length;
  const pagadas = plan.exhibiciones.filter((e) => e.estado === "PAGADA").length;
  const vencidas = plan.exhibiciones.filter((e) => e.estado === "VENCIDA");
  const proxima = plan.exhibiciones.find((e) => e.estado === "PENDIENTE" || e.estado === "VENCIDA");
  const pct = total ? Math.round((pagadas / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tu plan de pagos">
        {c.unidad.proyecto.nombre} · {c.unidad.torre} {c.unidad.numero} · Paquete {plan.paquete.nombre}
      </Saludo>

      {plan.estado === "LIQUIDADO" ? (
        <Estado tipo="ok" titulo="¡Terminaste de pagar!">Tu equipamiento ya puede pasar a fabricación.</Estado>
      ) : vencidas.length > 0 ? (
        <Estado tipo="aviso" titulo={vencidas.length === 1 ? "Tienes un pago sin cubrir" : `Tienes ${vencidas.length} pagos sin cubrir`}>
          Revisa que tu tarjeta tenga fondos o escríbele a día uno. Mientras tanto tu obra se pone en pausa.
        </Estado>
      ) : (
        <Estado tipo="ok" titulo="Vas al corriente">No tienes que hacer nada: cada pago se cobra solo a tu tarjeta en su fecha.</Estado>
      )}

      <div className="pt-pago">
        <div className="principal">
          <p className="bo-k">{proxima ? "Tu siguiente pago" : "Pagos"}</p>
          {proxima ? (
            <>
              <p className="monto"><Money valor={Number(proxima.monto)} conCentavos /></p>
              <p className="cuando">
                {fechaCorta(proxima.fechaProgramada)}{c.tarjetaDescripcion && <> · a tu {c.tarjetaDescripcion}</>}
              </p>
            </>
          ) : (
            <p className="monto">Completo</p>
          )}
        </div>
        <div>
          <p className="bo-k">Llevas pagado</p>
          <p className="mt-2 text-[26px] font-semibold">{pagadas} de {total} pagos</p>
          <div className="pt-progreso" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          <p className="mt-3 text-[14px] text-ink-2">Te falta <b className="text-ink"><Money valor={Number(plan.saldo)} /></b></p>
        </div>
      </div>

      <Seccion titulo="Todos tus pagos" nota="Del primero al último">
        <ul className="pt-pagos">
          {plan.exhibiciones.map((e) => {
            const pagado = e.estado === "PAGADA";
            const vencido = e.estado === "VENCIDA";
            return (
              <li key={e.id} data-pagado={pagado || undefined}>
                <span className={`pt-punto ${pagado ? "ok" : vencido ? "late" : ""}`} aria-hidden="true" />
                <span>{conceptoExhibicion(e.numero, e.tipo)}<small>{fechaCorta(e.fechaProgramada)}</small></span>
                <span className={`chip ${pagado ? "ok" : vencido ? "late" : "wait"}`}>{pagado ? "Pagado" : vencido ? "Sin cubrir" : "Programado"}</span>
                <span className="monto"><Money valor={Number(e.monto)} conCentavos /></span>
              </li>
            );
          })}
        </ul>
      </Seccion>
    </div>
  );
}
