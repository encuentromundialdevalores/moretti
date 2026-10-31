/**
 * Proxy de Next.js (antes «middleware») — protege el back office y su API.
 *
 * - /admin/* requiere sesión, salvo /admin/login. Sin sesión → al login.
 * - /api/* requiere sesión, salvo lo que usa el sitio público (apartar y
 *   ver imágenes), el login y el webhook de Stripe (firmado). Sin sesión → 401 en JSON.
 * - Toda petición que cambia algo (POST, PATCH, PUT, DELETE) a /api debe
 *   venir de este mismo sitio (encabezado Origin): freno a CSRF.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_PORTAL, leerTokenPortal, verificarToken } from "@/lib/sesion";
import { puedeVerRuta } from "@/lib/permisos";
import type { Rol } from "@prisma/client";

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/portal/:path*", "/portal"],
};

const API_PUBLICA: { metodo: string; ruta: RegExp }[] = [
  { metodo: "POST", ruta: /^\/api\/admin\/(login|logout)$/ },
  // El alta con contrato simulado y, con el token del apartado (lib/apartado.ts),
  // la tarjeta y el anticipo de ESE plan. Sin token, el anticipo de un plan
  // ajeno no se cobra (auditoría del 6 oct, H-2; reabierto e integrado el 11 oct).
  { metodo: "POST", ruta: /^\/api\/apartar(\/anticipo)?$/ },
  { metodo: "POST", ruta: /^\/api\/planes\/[^/]+\/tarjeta(\/confirmar)?$/ },
  // El navegador espera aquí a que el webhook aplique un cobro pendiente.
  { metodo: "GET", ruta: /^\/api\/exhibiciones\/[^/]+\/estado$/ },
  { metodo: "GET", ruta: /^\/api\/imagenes\/[^/]+$/ },
  // Lo llama Stripe, sin sesión ni Origin; la ruta verifica la firma del evento.
  { metodo: "POST", ruta: /^\/api\/stripe\/webhook$/ },
  // Lo llama el cron, sin sesión; la ruta exige CRON_SECRET.
  { metodo: "GET", ruta: /^\/api\/cobranza\/barrido$/ },
  { metodo: "POST", ruta: /^\/api\/cobranza\/barrido$/ },
  // Acceso con correo y contraseña, y la liga de invitación (D-49).
  { metodo: "POST", ruta: /^\/api\/(entrar|salir)$/ },
  { metodo: "POST", ruta: /^\/api\/cuenta\/activar$/ },
];

const CAMBIA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function mismoOrigen(req: NextRequest) {
  const origen = req.headers.get("origin");
  // Sin Origin (curl, servidor a servidor) no hay navegador que engañar;
  // la sesión sigue haciendo falta para lo privado.
  if (!origen) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api/");

  if (esApi && CAMBIA.has(req.method) && !mismoOrigen(req)) {
    return NextResponse.json({ error: "Petición rechazada: viene de otro sitio." }, { status: 403 });
  }

  // Portal de comprador, Moretti, verificador y PISSA: su propia cookie.
  // La página vuelve a revisar contra la base (cuenta activa, rol vigente).
  const esApiPortal = pathname.startsWith("/api/portal/");
  if (pathname === "/portal" || pathname.startsWith("/portal/") || esApiPortal) {
    const s = await leerTokenPortal(req.cookies.get(COOKIE_PORTAL)?.value);
    if (s && (esApiPortal || puedeVerRuta(s.rol as Rol, pathname))) return NextResponse.next();
    if (esApiPortal) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = s ? "/portal" : "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const publica = esApi
    ? API_PUBLICA.some((r) => r.metodo === req.method && r.ruta.test(pathname))
    : pathname === "/admin/login";
  if (publica) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && (await verificarToken(token))) return NextResponse.next();

  if (esApi) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a entrar al back office." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
