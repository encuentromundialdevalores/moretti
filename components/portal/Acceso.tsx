/** Marco compartido de /entrar y /cuenta/activar: una tarjeta centrada. */
export function MarcoAcceso({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4 py-12">
      <div className="card w-full max-w-[420px] p-8">
        <p className="font-display text-[24px] font-bold tracking-[-0.02em]">día uno</p>
        <h1 className="mt-6 text-[22px] font-semibold">{titulo}</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">{descripcion}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
