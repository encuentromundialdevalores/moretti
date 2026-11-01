"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";

type Props = {
  tipo: "complemento" | "comision";
  id: string;
  xml: boolean;
  pdf: boolean;
  subidoPor: string | null;
  /** Moretti sube; los demás sólo descargan. */
  puedeSubir: boolean;
};

const ICONO_SUBIR = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14" /></svg>;
const ICONO_BAJAR = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>;

/**
 * Los dos archivos de una factura (D-53): XML y PDF. Si ya están, se
 * descargan; si faltan y eres Moretti, se suben con un clic. Dice quién los subió.
 */
export default function Factura({ tipo, id, xml, pdf, subidoPor, puedeSubir }: Props) {
  const router = useRouter();
  const campoXml = useRef<HTMLInputElement>(null);
  const campoPdf = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState<"xml" | "pdf" | null>(null);

  async function subir(formato: "xml" | "pdf", e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.set(formato, f);
    setCargando(formato);
    const res = await fetch(`/api/portal/facturas/${tipo}/${id}`, { method: "POST", body: fd }).catch(() => null);
    setCargando(null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo subir el archivo.");
    avisar.exito(formato === "xml" ? "XML subido: la factura queda emitida." : "PDF subido.");
    router.refresh();
  }

  const boton = (formato: "xml" | "pdf", hay: boolean) =>
    hay ? (
      <a href={`/api/archivos/${tipo}/${id}/${formato}`} className="pt-arch hay">{ICONO_BAJAR}{formato.toUpperCase()}</a>
    ) : puedeSubir ? (
      <button type="button" className="pt-arch subir" disabled={!!cargando} onClick={() => (formato === "xml" ? campoXml : campoPdf).current?.click()}>
        {ICONO_SUBIR}{cargando === formato ? "Subiendo…" : `Subir ${formato.toUpperCase()}`}
      </button>
    ) : (
      <span className="pt-arch falta">{formato.toUpperCase()} pendiente</span>
    );

  return (
    <div className="pt-factura">
      <div className="flex flex-wrap gap-2">
        {boton("xml", xml)}
        {boton("pdf", pdf)}
      </div>
      {subidoPor && (xml || pdf) && <span className="pt-subido">Subido por {subidoPor}</span>}
      <input ref={campoXml} type="file" accept=".xml,text/xml,application/xml" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => subir("xml", e)} />
      <input ref={campoPdf} type="file" accept=".pdf,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => subir("pdf", e)} />
    </div>
  );
}
