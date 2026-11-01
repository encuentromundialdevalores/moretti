/** POST /api/portal/mensajes — un mensaje en la conversación de la unidad (D-54). */
import { NextRequest, NextResponse } from "next/server";
import { manejarTexto } from "@/lib/api-obra";
import { usuarioDePeticion } from "@/lib/portal";

export async function POST(req: NextRequest) {
  const u = await usuarioDePeticion(req);
  if (!u) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
  return manejarTexto({ nombre: u.nombre, rol: u.rol }, await req.json().catch(() => null), "mensaje");
}
