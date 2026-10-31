"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";
import Liga from "./Liga";

const ROLES = [
  ["COMPRADOR", "Comprador"],
  ["MORETTI", "Moretti · fabrica e instala"],
  ["VERIFICADOR", "Verificador · mide y recibe"],
  ["DESARROLLADOR", "Desarrollador · PISSA"],
  ["ADMIN", "día uno · back office"],
] as const;

export type Opcion = { id: string; texto?: string; nombre?: string };
export type DatosCuenta = { id: string; nombre: string; correo: string; rol: string; compradorId: string | null; desarrolladorId: string | null };

/** Alta de una cuenta, o edición si viene `cuenta` (entonces no genera liga). */
export default function NuevaCuenta({ compradores, desarrolladores, cuenta, alTerminar }: { compradores: Opcion[]; desarrolladores: Opcion[]; cuenta?: DatosCuenta; alTerminar?: () => void }) {
  const router = useRouter();
  const [rol, setRol] = useState<string>(cuenta?.rol ?? "COMPRADOR");
  const [liga, setLiga] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setCargando(true);
    const res = await fetch(cuenta ? `/api/usuarios/${cuenta.id}` : "/api/usuarios", {
      method: cuenta ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: fd.get("nombre"),
        correo: fd.get("correo"),
        rol,
        compradorId: rol === "COMPRADOR" ? fd.get("compradorId") : null,
        desarrolladorId: rol === "DESARROLLADOR" ? fd.get("desarrolladorId") : null,
      }),
    }).catch(() => null);
    setCargando(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo guardar la cuenta.");
    if (cuenta) {
      avisar.exito("Cambios guardados.");
      router.refresh();
      return alTerminar?.();
    }
    avisar.exito("Cuenta creada.");
    setLiga(data.liga);
    form.reset();
    router.refresh();
  }

  if (liga) return <Liga liga={liga} alCerrar={() => setLiga(null)} />;
  return (
    <form onSubmit={onSubmit} className={`grid gap-4 sm:grid-cols-2 ${cuenta ? "" : "card p-6"}`}>
      <div className="field"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" defaultValue={cuenta?.nombre} required /></div>
      <div className="field"><label htmlFor="correo">Correo</label><input id="correo" name="correo" type="email" defaultValue={cuenta?.correo} required /></div>
      <div className="field">
        <label htmlFor="rol">Perfil</label>
        <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
          {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      {rol === "COMPRADOR" && (
        <div className="field">
          <label htmlFor="compradorId">De quién es el plan</label>
          <select id="compradorId" name="compradorId" defaultValue={cuenta?.compradorId ?? undefined} required>
            {compradores.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
          <p className="ayuda">El comprador sólo ve este plan.</p>
        </div>
      )}
      {rol === "DESARROLLADOR" && (
        <div className="field">
          <label htmlFor="desarrolladorId">Desarrollador</label>
          <select id="desarrolladorId" name="desarrolladorId" defaultValue={cuenta?.desarrolladorId ?? undefined} required>
            {desarrolladores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <p className="ayuda">Ve sólo las unidades de sus proyectos.</p>
        </div>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <button className="btn" disabled={cargando}>{cargando ? "Guardando…" : cuenta ? "Guardar cambios" : "Crear cuenta y generar liga"}</button>
        {cuenta && <button type="button" className="btn btn-ghost" onClick={alTerminar}>Cancelar</button>}
      </div>
    </form>
  );
}
