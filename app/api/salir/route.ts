import { NextResponse } from "next/server";
import { cookieOpciones, cookiePortalOpciones } from "@/lib/sesion";

/** Cierra cualquier sesión: la del portal y la del back office. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...cookiePortalOpciones(true), value: "" });
  res.cookies.set({ ...cookieOpciones(true), value: "" });
  return res;
}
