"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";

type Props = {
  unidadId: string;
  fase: string;
  nombre: string;
  etiquetaFecha: string;
  responsable: string;
  ayuda: string;
  fecha: string | null;
  cumplida: boolean;
  cumplidaTexto: string | null;
  actual: boolean;
  atrasada: boolean;
  editable: boolean;
  /** Dónde se guarda: el portal o el back office. */
  api?: string;
};

/** Una fase de obra: su fecha estimada y su botón de «cumplida», sólo para su responsable. */
export default function FaseFila(p: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const api = p.api ?? "/api/portal/fases";

  async function enviar(cuerpo: object, exito: string) {
    setCargando(true);
    const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unidadId: p.unidadId, fase: p.fase, ...cuerpo }) }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar.");
    avisar.exito(exito);
    router.refresh();
  }

  return (
    <li className="pt-fase" data-estado={p.cumplida ? "hecha" : p.actual ? "ahora" : undefined}>
      <span className="pt-fase-marca" aria-hidden="true">{p.cumplida ? "✓" : ""}</span>
      <div className="pt-fase-cuerpo">
        <p className="pt-fase-nombre">
          {p.nombre} <span className="pt-fase-quien">{p.responsable}</span>
          {p.atrasada && <span className="chip late ml-2">Atrasada</span>}
        </p>
        <p className="pt-fase-ayuda">{p.cumplida ? p.cumplidaTexto : p.ayuda}</p>
      </div>
      <div className="pt-fase-fecha">
        <label className="sr-only" htmlFor={`f-${p.fase}`}>{p.etiquetaFecha}</label>
        {p.editable && !p.cumplida ? (
          <input
            id={`f-${p.fase}`}
            type="date"
            defaultValue={p.fecha ?? ""}
            disabled={cargando}
            onChange={(e) => enviar({ accion: "fecha", fecha: e.target.value || null }, e.target.value ? "Fecha guardada." : "Fecha quitada.")}
          />
        ) : (
          <span className="pt-fase-dia">{p.fecha ? new Date(`${p.fecha}T12:00:00Z`).toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "short" }) : "Sin fecha"}</span>
        )}
        {p.editable && p.actual && (
          <button type="button" className="btn btn-sm" disabled={cargando} onClick={() => enviar({ accion: "cumplir" }, `${p.nombre}: cumplida.`)}>
            {cargando ? "Guardando…" : "Marcar cumplida"}
          </button>
        )}
        {!p.editable && !p.cumplida && <span className="pt-fase-solo">Sólo lectura</span>}
      </div>
    </li>
  );
}
