/** POST /api/obra/mensajes — lo mismo que /api/portal/mensajes, desde el back office (día uno puede todo). Protegida por el proxy. */
import { NextRequest } from "next/server";
import { manejarTexto } from "@/lib/api-obra";

export async function POST(req: NextRequest) {
  return manejarTexto({ nombre: "día uno", rol: "ADMIN" }, await req.json().catch(() => null), "mensaje");
}
