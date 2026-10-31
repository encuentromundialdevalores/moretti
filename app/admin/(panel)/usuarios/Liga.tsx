"use client";

/** La liga de invitación se muestra UNA vez: después sólo se puede generar otra. */
export default function Liga({ liga, alCerrar }: { liga: string; alCerrar: () => void }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <p className="text-[14px]"><b>Liga de invitación</b> (vence en 7 días, sirve una vez). Cópiala ahora: no se vuelve a mostrar.</p>
      <input readOnly value={liga} className="font-mono text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex gap-3">
        <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(liga)}>Copiar</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={alCerrar}>Listo</button>
      </div>
    </div>
  );
}
