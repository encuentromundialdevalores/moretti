"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SubirImagen from "@/components/SubirImagen";
import { avisar } from "@/components/admin/avisar";

type Par = [string, string];
export type DatosPartida = { id: string; nombre: string; imagen: string | null; ficha: Par[]; acabados: Par[] };

/**
 * Un producto del paquete, editable en su lugar (Sprint 5): nombre, imagen,
 * los renglones de su ficha y hasta tres acabados con su color.
 */
export default function EditarPartida({ partida }: { partida: DatosPartida }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ficha, setFicha] = useState<Par[]>(partida.ficha);
  const [acabados, setAcabados] = useState<Par[]>(partida.acabados);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (lista: Par[], set: (l: Par[]) => void, i: number, j: 0 | 1, v: string) =>
    set(lista.map((p, k) => (k === i ? ((j === 0 ? [v, p[1]] : [p[0], v]) as Par) : p)));

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setGuardando(true);
    const res = await fetch(`/api/partidas/${partida.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: f.get("nombre"),
        imagen: f.get("imagen") || null,
        ficha: ficha.filter(([a]) => a.trim()),
        acabados: acabados.filter(([a]) => a.trim()),
      }),
    }).catch(() => null);
    setGuardando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar.");
    avisar.exito(`«${f.get("nombre")}» guardado.`);
    setAbierto(false);
    router.refresh();
  }

  return (
    <li className="pq-item" data-abierto={abierto || undefined}>
      <div className="pq-item-cab">
        <span className="pq-item-foto">{partida.imagen ? <Image src={partida.imagen} alt="" width={40} height={40} /> : null}</span>
        <div className="min-w-0">
          <b>{partida.nombre}</b>
          <span>{partida.ficha.length} datos · {partida.acabados.length ? `${partida.acabados.length} acabados` : "sin acabados"}</span>
        </div>
        {partida.acabados.length > 0 && <span className="pq-item-colores">{partida.acabados.map(([n, c]) => <i key={n} style={{ background: c }} title={n} />)}</span>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Editar"}</button>
      </div>

      {abierto && (
        <form onSubmit={guardar} className="pq-item-form">
          <div className="field">
            <label htmlFor={`pn-${partida.id}`}>Nombre</label>
            <input id={`pn-${partida.id}`} name="nombre" defaultValue={partida.nombre} required maxLength={120} />
          </div>
          <SubirImagen name="imagen" inicial={partida.imagen} etiqueta="Imagen del producto" />

          <fieldset className="pq-pares">
            <legend>Ficha <small>Lo que ve el comprador del producto. «— Moretti» = dato pendiente.</small></legend>
            {ficha.map(([a, b], i) => (
              <div key={i} className="pq-par">
                <input aria-label="Dato" value={a} onChange={(e) => cambiar(ficha, setFicha, i, 0, e.target.value)} placeholder="Ej. Cubierta" maxLength={80} />
                <input aria-label="Valor" value={b} onChange={(e) => cambiar(ficha, setFicha, i, 1, e.target.value)} placeholder="Ej. Cuarzo blanco 2 cm" maxLength={300} />
                <button type="button" className="pq-quitar" aria-label="Quitar renglón" onClick={() => setFicha(ficha.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
            {ficha.length < 20 && <button type="button" className="pq-agregar" onClick={() => setFicha([...ficha, ["", ""]])}>+ Agregar dato</button>}
          </fieldset>

          <fieldset className="pq-pares">
            <legend>Acabados <small>Hasta tres opciones, con su color.</small></legend>
            {acabados.map(([a, c], i) => (
              <div key={i} className="pq-par pq-par-color">
                <input type="color" aria-label="Color" value={c} onChange={(e) => cambiar(acabados, setAcabados, i, 1, e.target.value)} />
                <input aria-label="Acabado" value={a} onChange={(e) => cambiar(acabados, setAcabados, i, 0, e.target.value)} placeholder="Ej. Opción 1 · Roble claro" maxLength={80} />
                <button type="button" className="pq-quitar" aria-label="Quitar acabado" onClick={() => setAcabados(acabados.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
            {acabados.length < 3 && <button type="button" className="pq-agregar" onClick={() => setAcabados([...acabados, ["", "#c9a97c"]])}>+ Agregar acabado</button>}
          </fieldset>

          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={guardando}>{guardando ? "Guardando…" : "Guardar producto"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </li>
  );
}
