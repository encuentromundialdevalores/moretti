import { connection } from "next/server";
import { PageHead } from "@/components/ui";
import { Estado } from "@/components/admin/Bo";
import { cobroEnLinea, modoStripe, porQueApagado, topeCentavos } from "@/lib/pasarela/modo";
import { metodoCaptura } from "@/lib/pasarela/stripe";
import PruebasDineroReal from "./PruebasDineroReal";

const pesos = (centavos: number) =>
  (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function captura() {
  try {
    return metodoCaptura();
  } catch {
    return "inválida";
  }
}

export default async function PruebaDineroRealPage() {
  // Lee el entorno en cada visita, no al compilar.
  await connection();
  const modo = modoStripe();
  const tope = topeCentavos();
  const ambiente = {
    modo,
    apagadoPorque: porQueApagado(),
    tope,
    cobroEnLinea: cobroEnLinea(),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    captura: captura(),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Stripe · prueba con dinero real"
        titulo="Casos con el cargo mínimo"
        descripcion="Cada caso cobra, devuelve o intenta lo menos que Stripe acepta en pesos ($10.00), sobre un proyecto aparte. Haz el paso 0 una vez; después sigue los casos en orden: cada uno dice qué hacer, qué tiene que pasar y dónde comprobarlo."
        accion={
          <span className={`chip ${modo === "real" ? "late" : modo === "prueba" ? "info" : "wait"}`}>
            {modo === "real" ? "Modo real" : modo === "prueba" ? "Ensayo · modo prueba" : "Stripe apagado"}
          </span>
        }
      />

      {modo === "real" && (
        <Estado tipo="aviso" titulo="Modo real: cada cargo es dinero de verdad.">
          Tope por cobro: {pesos(tope!)}. Captura del anticipo: {ambiente.captura}. Al terminar, haz el caso Z2.
        </Estado>
      )}
      {modo === "prueba" && (
        <Estado tipo="ok" titulo="Ensayo: llaves de prueba, nada de esto mueve dinero.">
          Sirve para recorrer la prueba completa antes del día. Usa las tarjetas de prueba (4242 4242 4242 4242).
        </Estado>
      )}
      {modo === "apagado" && (
        <Estado tipo="aviso" titulo="Stripe está apagado en este ambiente.">
          {ambiente.apagadoPorque} Revisa el paso 0.
        </Estado>
      )}
      {modo !== "apagado" && !ambiente.webhook && (
        <p className="note blocked" role="status">
          Falta <code>STRIPE_WEBHOOK_SECRET</code>. Sin el webhook, los cobros con 3-D Secure y los reembolsos hechos en
          Stripe nunca llegan a la base.
        </p>
      )}

      <PruebasDineroReal ambiente={ambiente} />
    </div>
  );
}
