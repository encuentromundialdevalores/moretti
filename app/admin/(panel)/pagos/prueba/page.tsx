import Link from "next/link";
import { connection } from "next/server";
import { PageHead } from "@/components/ui";
import { cobroEnLinea, modoStripe, porQueApagado } from "@/lib/pasarela/modo";

export default async function PruebaPagosPage() {
  await connection();
  const modoReal = modoStripe() === "real";
  const tieneWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Stripe · ambiente de pruebas"
        titulo="Prueba desde un plan"
        descripcion="El anticipo se cobra desde el detalle de un plan con contrato firmado, a la cuenta conectada de su proyecto."
        accion={<span className={`chip ${modoReal ? "late" : "info"}`}>{modoReal ? "Modo real" : "Modo prueba"}</span>}
      />

      {modoReal ? (
        <p className="note blocked" role="status">
          Llaves reales con <code>STRIPE_MODO_REAL=1</code>: el motor cobra dinero real. Las tarjetas de
          prueba de abajo no funcionan en este modo.
        </p>
      ) : !cobroEnLinea() ? (
        <p className="note blocked" role="status">
          Configuración pendiente. {porQueApagado() ?? "Falta la llave publicable."} Mientras tanto, el
          motor no cobra con Stripe desde el navegador.
        </p>
      ) : (
        <p className="note" role="status">
          Llaves de prueba detectadas: el motor cobra con Stripe. No se crean cobros sueltos ni importes
          de demostración; cobra el anticipo desde el detalle de un plan con contrato firmado.
        </p>
      )}

      {!tieneWebhook && (
        <p className="note blocked" role="status">
          Falta la firma del webhook (<code>STRIPE_WEBHOOK_SECRET</code>). Sin ella, un cobro que pide
          autenticación nunca se aplica.
        </p>
      )}

      <div className="card flex flex-col gap-3 p-6 text-[14px] text-ink-2">
        <p className="label">Cómo probar</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>El proyecto necesita su cuenta conectada (<code>acct_…</code>) en Datos del proyecto.</li>
          <li>
            Para el webhook local: <code>stripe listen --forward-to localhost:3000/api/stripe/webhook
            --forward-connect-to localhost:3000/api/stripe/webhook</code>.
          </li>
          <li>Aparta desde el sitio, firma, autoriza los cargos y captura la tarjeta.</li>
          <li>
            Tarjetas: <code>4242 4242 4242 4242</code> pasa · <code>4000 0025 0000 3155</code> pide
            autenticación · <code>4000 0000 0000 9995</code> fondos insuficientes.
          </li>
          <li>Las mensualidades se cobran desde el estado de cuenta, a la tarjeta guardada.</li>
        </ol>
      </div>

      <Link href="/admin/pagos/dinero-real" className="text-[14px] font-semibold text-accent hover:underline">
        Casos de la prueba con dinero real →
      </Link>
    </div>
  );
}
