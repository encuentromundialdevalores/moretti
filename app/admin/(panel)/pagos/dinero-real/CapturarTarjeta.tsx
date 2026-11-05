"use client";

import { useRef, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { confirmarTarjeta, prepararTarjeta } from "@/lib/pasarela/cliente";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
let plataforma: Promise<Stripe | null> | null = null;
const stripePlataforma = () => (plataforma ??= loadStripe(PUBLIC_KEY));

/**
 * Guarda una tarjeta en el plan sin cobrar nada: lo que hace el comprador al
 * cambiar de tarjeta. Las mismas rutas que CobrarConStripe, sin el cobro.
 */
export default function CapturarTarjeta({
  planId,
  habilitado,
  onGuardada,
}: {
  planId: string;
  habilitado: boolean;
  onGuardada: (descripcion: string) => void;
}) {
  const [consentimiento, setConsentimiento] = useState(false);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function abrir() {
    setMensaje(null);
    setCargando(true);
    try {
      setSecreto(await prepararTarjeta(planId, consentimiento));
    } catch (err) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo preparar la captura." });
    } finally {
      setCargando(false);
    }
  }

  if (!habilitado) {
    return <p className="text-[13px] text-muted">Stripe no está encendido en este ambiente: no hay con qué capturar.</p>;
  }

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      {secreto ? (
        <Elements stripe={stripePlataforma()} options={{ clientSecret: secreto, locale: "es-419" }}>
          <Formulario
            onGuardada={async (setupIntentId) => {
              try {
                const descripcion = await confirmarTarjeta(planId, setupIntentId);
                setSecreto(null);
                setMensaje({ tipo: "ok", texto: `Tarjeta guardada: ${descripcion}.` });
                onGuardada(descripcion);
              } catch (err) {
                setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo verificar la tarjeta." });
              }
            }}
            onError={(texto) => setMensaje({ tipo: "error", texto })}
            onCancelar={() => setSecreto(null)}
          />
        </Elements>
      ) : (
        <>
          <label className="flex items-start gap-3 text-sm text-ink-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
            />
            Autorizo que en esta tarjeta se cobre cada mensualidad del plan en su fecha, sin que tenga que estar presente.
          </label>
          <button type="button" className="btn btn-sm self-start" onClick={abrir} disabled={!consentimiento || cargando}>
            {cargando ? "Preparando…" : "Capturar tarjeta"}
          </button>
        </>
      )}
      {mensaje && (
        <p className={`text-[13px] ${mensaje.tipo === "ok" ? "text-accent" : "text-warm"}`} role={mensaje.tipo === "ok" ? "status" : "alert"}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

function Formulario({
  onGuardada,
  onError,
  onCancelar,
}: {
  onGuardada: (setupIntentId: string) => Promise<void>;
  onError: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const r = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (r.error) return onError(r.error.message ?? "Stripe no pudo guardar la tarjeta.");
      if (r.setupIntent.status !== "succeeded") return onError("La tarjeta no quedó guardada. Revisa los datos o usa otra.");
      await onGuardada(r.setupIntent.id);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="w-full space-y-4">
      <div className="rounded-[var(--r-input)] border border-line-2 bg-surface p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-sm" disabled={!stripe || enviando}>
          {enviando ? "Guardando…" : "Guardar tarjeta"}
        </button>
        <button type="button" className="text-xs text-muted hover:text-ink" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
