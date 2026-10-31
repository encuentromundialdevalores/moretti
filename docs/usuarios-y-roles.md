# Usuarios y perfiles (Sprint 4 · D-48 a D-51)

Basado en la sección «Tablero» de la maqueta de Ana Cris
(`5b - Maqueta del sitio (para Moretti y PISSA).html`): cada perfil ve sólo lo suyo.

## Qué ve y qué hace cada perfil

| Perfil | Entra en | Pantallas | Puede marcar | No ve |
|---|---|---|---|---|
| **Comprador** | `/portal/comprador` | Mi plan de pagos · Mi departamento · Mis documentos | Nada (sólo consulta) | Otros compradores, la operación |
| **Moretti** (fabrica e instala) | `/portal/moretti` | Unidades por producir · Pendientes fiscales | En producción, Producido, En almacén, Instalada; cerrar comprobante con folio o XML | La comisión del canal, montos del plan, datos del comprador |
| **Verificador** (mide y recibe) | `/portal/verificador` | Levantamientos · Instalaciones por recibir | Levantamiento hecho; acta de entrega; Entregada | Pagos, precios, contrato |
| **PISSA** (entrega el edificio) | `/portal/pissa` | Unidades vendidas · Accesos e instalaciones | Nada (sólo consulta) | Precios, datos del comprador, unidades de otros desarrolladores |
| **día uno** (opera todo) | `/admin` | Todo el back office + **Usuarios** | Todo | — |

Las reglas del motor siguen mandando: que Moretti pueda pedir «En producción»
no salta R5 (tiene que estar liquidado), y el error dice qué falta.

Los permisos viven en un solo lugar: `lib/permisos.ts`. Las consultas de cada
perfil en `lib/portal-datos.ts` piden campo por campo (`select`) para que un
precio o la comisión no lleguen a la página ni por accidente (hay una prueba
que lo revisa: `lib/cuentas.int.test.ts`).

## Cómo se crean las cuentas

1. día uno entra a **Back office → Usuarios** (`/admin/usuarios`).
2. Llena nombre, correo y perfil. Si es **comprador**, elige de quién es el
   plan; si es **PISSA**, elige el desarrollador.
3. El sistema muestra una **liga de invitación** (sirve una vez, vence en 7
   días). Se copia y se manda por correo o WhatsApp. No se vuelve a mostrar.
4. La persona abre la liga, elige su contraseña (mínimo 10 caracteres) y
   entra en **`/entrar`** con su correo.
5. Si la liga venció o se perdió: **Nueva liga** (la anterior deja de servir).
   Para quitar el acceso: **Desactivar** (deja de entrar en ese momento,
   aunque tenga la sesión abierta).

Siguiente paso natural: que la liga salga sola por correo al crear la cuenta
(y al comprador, en cuanto paga el anticipo). Hoy se copia a mano porque el
sistema todavía no manda correos.

## Cuentas de prueba

```
npm run db:usuarios-prueba
```

| Perfil | Correo |
|---|---|
| Comprador | comprador@prueba.diauno.mx (ligado al plan activo con más pagos) |
| Moretti | moretti@prueba.diauno.mx |
| Verificador | verificador@prueba.diauno.mx |
| PISSA | pissa@prueba.diauno.mx |
| día uno | admin@prueba.diauno.mx |

Contraseña de todas: `prueba-dia-uno-2026`. Sólo para pruebas: el script se
niega a correr con `NODE_ENV=production`.

## Seguridad

- Contraseñas con scrypt (`lib/contrasena.ts`, el mismo del back office).
- La liga de invitación sólo se guarda como SHA-256.
- Dos cookies distintas: `dno_admin_v1` (back office) y `dno_portal_v1`
  (portal). Un token del portal no abre `/admin` ni `/api/*` del back office,
  y uno del back office no abre el portal (`lib/sesion-portal.test.ts`).
- El proxy revisa el rol para cada ruta `/portal/*`; la página vuelve a
  revisar contra la base (cuenta activa, rol vigente).
- `/api/entrar` comparte el freno de 5 intentos por IP del login actual.
- La contraseña única del back office (`ADMIN_PASSWORD_HASH`) sigue sirviendo
  en `/admin/login`: no se rompe nada de lo que ya funcionaba.

## Qué no se tocó

Nada de Stripe ni de la cobranza de Charly (`lib/pasarela/*`,
`lib/motor/cobranza.ts`, `barrido`, `avisos-tarjeta`, webhook, apartar). El
único cambio en el motor es aditivo: `registrarActaEntrega` acepta quién la
registró para la bitácora.

## Pendiente / por decidir con Ana Cris

- **Fechas de obra:** el sistema guarda el estado de medición e instalación,
  no la fecha. Por eso «Accesos e instalaciones» de PISSA y el calendario de
  la maqueta no traen fechas todavía.
- **Verificación del XML contra el SAT:** hoy se lee el UUID del timbre y se
  valida su forma.
- **Mensajes** (correo / WhatsApp) de la maqueta: no hay envío de correos aún.
- **Quién emite el CFDI** (I-11): por ahora lo cierra Moretti desde su portal
  o día uno desde Fiscal.
- **Comprador:** cambiar su tarjeta desde su portal (toca Stripe: se dejó fuera
  a propósito para no mover lo de Charly).
- **Varias personas por perfil** (dos de Moretti, por ejemplo) ya funciona: es
  una cuenta por persona con el mismo perfil.
