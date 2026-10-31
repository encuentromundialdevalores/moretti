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

type Opcion = { id: string; texto?: string; nombre?: string };

export default function NuevaCuenta({ compradores, desarrolladores }: { compradores: Opcion[]; desarrolladores: Opcion[] }) {
  const router = useRouter();
  const [rol, setRol] = useState<string>("COMPRADOR");
  const [liga, setLiga] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setCargando(true);
    const res = await fetch("/api/usuarios", {
      method: "POST",
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
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo crear la cuenta.");
    avisar.exito("Cuenta creada.");
    setLiga(data.liga);
    form.reset();
    router.refresh();
  }

  if (liga) return <Liga liga={liga} alCerrar={() => setLiga(null)} />;
  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-6 sm:grid-cols-2">
      <div className="field"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" required /></div>
      <div className="field"><label htmlFor="correo">Correo</label><input id="correo" name="correo" type="email" required /></div>
      <div className="field">
        <label htmlFor="rol">Perfil</label>
        <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
          {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      {rol === "COMPRADOR" && (
        <div className="field">
          <label htmlFor="compradorId">De quién es el plan</label>
          <select id="compradorId" name="compradorId" required>
            {compradores.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
          <p className="ayuda">El comprador sólo ve este plan.</p>
        </div>
      )}
      {rol === "DESARROLLADOR" && (
        <div className="field">
          <label htmlFor="desarrolladorId">Desarrollador</label>
          <select id="desarrolladorId" name="desarrolladorId" required>
            {desarrolladores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <p className="ayuda">Ve sólo las unidades de sus proyectos.</p>
        </div>
      )}
      <div className="sm:col-span-2"><button className="btn" disabled={cargando}>{cargando ? "Creando…" : "Crear cuenta y generar liga"}</button></div>
    </form>
  );
}
