"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";

/** Escribir una observación sobre la unidad, opcionalmente de una fase. */
export default function ObservacionForm({ unidadId, fases, api = "/api/portal/observaciones", mensaje = false }: { unidadId: string; fases?: { valor: string; nombre: string }[]; api?: string; mensaje?: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setCargando(true);
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidadId, fase: fd.get("fase") || null, texto: fd.get("texto") }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar.");
    avisar.exito(mensaje ? "Mensaje enviado: le avisamos al equipo." : "Observación guardada.");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="pt-obs-form">
      <textarea
        name="texto"
        rows={2}
        maxLength={2000}
        placeholder={mensaje ? "Escribe al equipo de esta unidad…" : "Ej. La pared de la cocina mide 3 cm menos que el plano."}
        aria-label={mensaje ? "Mensaje" : "Observación"}
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        {fases && (
          <select name="fase" aria-label="Fase" defaultValue="">
            <option value="">General</option>
            {fases.map((f) => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
          </select>
        )}
        <button className="btn btn-sm" disabled={cargando}>{cargando ? "Enviando…" : mensaje ? "Enviar" : "Agregar observación"}</button>
      </div>
    </form>
  );
}
