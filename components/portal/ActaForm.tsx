"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";

/** El verificador levanta el acta de entrega con el comprador. */
export default function ActaForm({ unidadId }: { unidadId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  if (!abierto) return <button type="button" className="btn btn-sm" onClick={() => setAbierto(true)}>Firmar acta con el comprador</button>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCargando(true);
    const res = await fetch("/api/portal/acta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidadId, quienFirmo: fd.get("quien"), fechaFirma: fd.get("fecha"), archivoNombre: fd.get("archivo") }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo registrar el acta.");
    avisar.exito("Acta registrada. Ya puedes marcar la unidad como entregada.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid w-full max-w-[360px] gap-2 text-[13px]">
      <input name="quien" placeholder="Quién firmó (comprador)" required />
      <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <input name="archivo" placeholder="Archivo del acta (acta-BR717.pdf)" required />
      <button className="btn btn-sm" disabled={cargando}>{cargando ? "Guardando…" : "Registrar acta"}</button>
    </form>
  );
}
