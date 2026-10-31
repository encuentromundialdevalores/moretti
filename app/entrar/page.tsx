"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MarcoAcceso } from "@/components/portal/Acceso";

/** Acceso con correo para todos los perfiles (D-49). */
export default function EntrarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: fd.get("correo"), contrasena: fd.get("contrasena") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return setError(data.error ?? "No se pudo entrar.");
      // Si llegó aquí desde una página del back office (sesión vencida), vuelve a ella.
      // Sólo rutas internas de /admin: «//otro-sitio.com» no es un destino.
      const pedido = new URLSearchParams(window.location.search).get("next") ?? "";
      const vuelta = data.destino === "/admin" && /^\/admin(\/[\w\-/[\]]*)?$/.test(pedido) ? pedido : data.destino;
      router.push(vuelta);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Entrar" descripcion="Compradores, Moretti, verificador, PISSA y día uno: cada quien ve sólo lo suyo.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="correo">Correo</label>
          <input id="correo" name="correo" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="contrasena">Contraseña</label>
          <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
        </div>
        {error && <p role="alert" className="text-[14px] text-warm">{error}</p>}
        <button className="btn" disabled={cargando}>{cargando ? "Entrando…" : "Entrar"}</button>
        <p className="text-[12.5px] text-muted">¿No tienes contraseña? día uno te manda una liga para crearla.</p>
      </form>
    </MarcoAcceso>
  );
}
