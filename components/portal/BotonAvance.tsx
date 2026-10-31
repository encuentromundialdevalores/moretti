"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";

/** Marca el siguiente paso de obra. Si falta un requisito, el aviso dice cuál. */
export default function BotonAvance({ unidadId, tipo, hacia, texto }: { unidadId: string; tipo: "operativo" | "instalacion"; hacia: string; texto: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  async function marcar() {
    setCargando(true);
    const res = await fetch("/api/portal/obra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidadId, tipo, hacia }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar.");
    avisar.exito(`Marcado: ${texto}.`);
    router.refresh();
  }
  return (
    <button type="button" className="btn btn-sm btn-ghost" disabled={cargando} onClick={marcar}>
      {cargando ? "Guardando…" : `Marcar «${texto}»`}
    </button>
  );
}
