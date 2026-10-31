"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";
import { uuidDeXml } from "@/lib/cfdi";

/**
 * Moretti cierra el pendiente: escribe el folio o suelta el XML y el sistema
 * le lee el UUID (maqueta m-fisc). La verificación contra el SAT no está:
 * se valida el formato del folio (lib/motor/comprobantes.ts).
 */
export default function FolioForm({ id }: { id: string }) {
  const router = useRouter();
  const [folio, setFolio] = useState("");
  const [cargando, setCargando] = useState(false);

  async function leerXml(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const uuid = uuidDeXml(await f.text());
    if (uuid) setFolio(uuid);
    else avisar.error("Ese archivo no trae el timbre fiscal (UUID). ¿Es el XML del CFDI?");
    e.target.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const res = await fetch(`/api/portal/comprobantes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folioFiscal: folio }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo cerrar el pendiente.");
    avisar.exito("Pendiente cerrado.");
    setFolio("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onSubmit} className="bo-form">
        <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio fiscal (UUID)" aria-label="Folio fiscal" className="font-mono" required />
        <button disabled={cargando || !folio}>{cargando ? "Guardando…" : "Cerrar"}</button>
      </form>
      <label className="cursor-pointer text-[12.5px] text-accent">
        o subir el XML
        <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={leerXml} />
      </label>
    </div>
  );
}
