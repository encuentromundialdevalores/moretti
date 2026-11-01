/** POST /api/obra/fases — lo mismo que /api/portal/fases, desde el back office (día uno puede todo). Protegida por el proxy. */
import { NextRequest } from "next/server";
import { manejarFase } from "@/lib/api-obra";

export async function POST(req: NextRequest) {
  return manejarFase({ nombre: "día uno", rol: "ADMIN" }, await req.json().catch(() => null));
}
