"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubirImagen from "@/components/SubirImagen";
import { avisar } from "@/components/admin/avisar";

export default function EditarPaquete({
  paquete,
}: {
  paquete: { id: string; nombre: string; descripcion: string | null; partidas: string[]; imagen: string | null; esArmable: boolean };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [renglones, setRenglones] = useState<string[]>(paquete.partidas.length ? paquete.partidas : [""]);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/paquetes/${paquete.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: f.get("nombre"),
        descripcion: f.get("descripcion"),
        partidas: renglones.map((p) => p.trim()).filter(Boolean),
        imagen: f.get("imagen") || null,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error ?? "No se pudo guardar el paquete.";
      avisar.error(msg);
      return setError(msg);
    }
    avisar.exito(`Paquete «${f.get("nombre")}» guardado.`);
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAbierto(true)}>
        Editar paquete
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 border-t border-line pt-4">
      <div className="field">
        <label htmlFor={`nombre-${paquete.id}`}>Nombre</label>
        <input id={`nombre-${paquete.id}`} name="nombre" defaultValue={paquete.nombre} placeholder="Ej. Confort" required />
      </div>
      <div className="field">
        <label htmlFor={`desc-${paquete.id}`}>Descripción corta</label>
        <textarea id={`desc-${paquete.id}`} name="descripcion" rows={2} maxLength={240} defaultValue={paquete.descripcion ?? ""} placeholder="Ej. Casa Lista más climatización en todos los espacios." />
        <p className="ayuda">Una o dos líneas. Aparece bajo el nombre en el sitio.</p>
      </div>
      <div className="field">
        <label htmlFor={`partidas-${paquete.id}`}>{paquete.esArmable ? "Lo que se puede elegir" : "Lo que agrega este paquete"}</label>
        <div id={`partidas-${paquete.id}`} className="flex flex-col gap-2">
          {renglones.map((t, i) => (
            <div key={i} className="pq-par" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <input aria-label={`Renglón ${i + 1}`} value={t} onChange={(e) => setRenglones(renglones.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Ej. Clima en sala y recámaras" />
              <button type="button" className="pq-quitar" aria-label="Quitar renglón" onClick={() => setRenglones(renglones.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="pq-agregar" onClick={() => setRenglones([...renglones, ""])}>+ Agregar renglón</button>
        </div>
        <p className="ayuda">
          Un renglón por cosa. {paquete.esArmable ? "" : "Sólo lo nuevo: lo de los paquetes anteriores se muestra solo. "}
          Es texto de la tarjeta; lo que se cotiza sale del catálogo de partidas.
        </p>
      </div>
      <SubirImagen name="imagen" inicial={paquete.imagen} etiqueta="Imagen del paquete" ayuda="Interior con el paquete instalado, en horizontal (4:3). JPG, PNG o WebP de hasta 8 MB." />
      {error && <p className="note blocked" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
