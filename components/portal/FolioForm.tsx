"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";
import { uuidDeXml } from "@/lib/cfdi";

/**
 * Moretti cierra el pendiente subiendo el XML del CFDI (maqueta m-fisc): el
 * sistema le lee el folio, lo guarda y el comprador lo puede descargar. Si
 * no tiene el XML a la mano, puede escribir sólo el folio. La verificación
 * contra el SAT no está: se valida el formato del folio.
 */
export default function FolioForm({ id }: { id: string }) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(false);
  const [folio, setFolio] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(cuerpo: { folioFiscal: string; xml?: string; xmlNombre?: string }) {
    setCargando(true);
    const res = await fetch(`/api/portal/comprobantes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar la factura.");
    avisar.exito(cuerpo.xml ? "Factura subida. El comprador ya la puede descargar." : "Folio guardado.");
    setFolio("");
    router.refresh();
  }

  async function subirXml(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 500_000) return avisar.error("Ese archivo es demasiado grande para ser un CFDI.");
    const xml = await f.text();
    const uuid = uuidDeXml(xml);
    if (!uuid) return avisar.error("Ese archivo no trae el timbre fiscal (UUID). ¿Es el XML del CFDI?");
    await enviar({ folioFiscal: uuid, xml, xmlNombre: f.name });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input ref={archivo} type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={subirXml} tabIndex={-1} aria-hidden="true" />
      <button type="button" className="btn btn-sm" disabled={cargando} onClick={() => archivo.current?.click()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14" /></svg>
        {cargando ? "Subiendo…" : "Subir XML"}
      </button>
      {manual ? (
        <form onSubmit={(e) => { e.preventDefault(); enviar({ folioFiscal: folio }); }} className="bo-form w-[300px]">
          <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Folio fiscal (UUID)" aria-label="Folio fiscal" className="font-mono" required autoFocus />
          <button disabled={cargando || !folio}>Guardar</button>
        </form>
      ) : (
        <button type="button" className="text-[12.5px] text-muted hover:text-accent" onClick={() => setManual(true)}>o escribe sólo el folio</button>
      )}
    </div>
  );
}
