"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MarcoAcceso } from "@/components/portal/Acceso";

const MINIMO = 10;

function Formulario() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const contrasena = String(fd.get("contrasena") ?? "");
    if (contrasena !== fd.get("repetir")) return setError("Las dos contraseñas no coinciden.");
    setError(null);
    setCargando(true);
    const res = await fetch("/api/cuenta/activar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, contrasena }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setError(data.error ?? "No se pudo activar la cuenta.");
    setListo(true);
  }

  if (!token) return <p className="text-[14.5px]">Esta liga está incompleta. Pídele a día uno que te mande otra.</p>;
  if (listo)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14.5px]">Listo: tu cuenta ya tiene contraseña.</p>
        <Link href="/entrar" className="btn">Entrar</Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="contrasena">Contraseña nueva</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="new-password" minLength={MINIMO} required />
        <p className="ayuda">Al menos {MINIMO} caracteres. Una frase corta es más fácil de recordar.</p>
      </div>
      <div className="field">
        <label htmlFor="repetir">Repítela</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={MINIMO} required />
      </div>
      {error && <p role="alert" className="text-[14px] text-warm">{error}</p>}
      <button className="btn" disabled={cargando}>{cargando ? "Guardando…" : "Crear contraseña"}</button>
    </form>
  );
}

/** La liga de invitación: la persona elige su contraseña (D-49). */
export default function ActivarPage() {
  return (
    <MarcoAcceso titulo="Crea tu contraseña" descripcion="La liga sirve una sola vez y vence en 7 días.">
      <Suspense>
        <Formulario />
      </Suspense>
    </MarcoAcceso>
  );
}
