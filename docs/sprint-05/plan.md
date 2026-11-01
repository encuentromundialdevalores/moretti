# Sprint 5 · Cambios de la reunión con Ana Cris (31 oct)

Rama `sprint-5/ana-cris`. Cuatro fases, en este orden: cada una se puede
mostrar sola.

## Fase A · Obra: fases, fechas, calendario y detalle de unidad

**El proceso de obra tiene 6 fases.** Cada una tiene un responsable, una
fecha estimada y una marca de «cumplida». El verificador da el visto bueno
en cuatro: medición, revisión del pedido, llegada del pedido y revisión de
la instalación.

| # | Fase | Responsable (pone la fecha y la marca) | Al cumplirse, la unidad pasa a… |
|---|---|---|---|
| 1 | Medición | Verificador | Levantamiento hecho |
| 2 | Revisión y observaciones del pedido | Verificador | Acabados elegidos |
| 3 | Pedido a fábrica | Moretti | En producción (sólo si está liquidada, R5) |
| 4 | Llegada del pedido | Verificador | Producido → En almacén |
| 5 | Instalación (programada = fecha estimada) | Moretti | Programada → Instalada |
| 6 | Revisión de la instalación | Verificador | Entregada (con acta) |

- Las fechas que no son tuyas se ven, pero no se cambian. Día uno puede
  cambiar todas.
- Una fase sólo se marca cumplida si la anterior ya lo está. Las reglas del
  motor (pagado, acabados, acta) siguen mandando.
- **Detalle de unidad (pop-up):** al dar clic en una unidad. Muestra la
  unidad y el paquete, las fases con sus fechas, las observaciones y los
  documentos de ese cliente (contrato, acta y facturas).
- **Observaciones:** cualquiera de los tres perfiles las escribe, ligadas a
  una fase. Llevan nombre, perfil y fecha, y no se borran.
- **Calendario:** Moretti y el verificador ven el mismo calendario, con las
  fechas de los dos.

## Fase B · Facturación (complemento de pago PPD)

- Moretti emite un **complemento de pago** por cada pago (PPD). Sube el
  **XML y el PDF**.
- Los pendientes muestran **sólo los del mes**. Lo anterior y lo ya subido
  se ve en el detalle de la unidad.
- **Facturas de comisión:** de cada pago, el 15 % más IVA lo factura Moretti
  a día uno. Hay un pendiente por pago y se sube igual (XML + PDF).
- Cada archivo dice quién lo subió («Subido por Moretti»).
- La sección Fiscal del admin va mes por mes.
- Requiere almacenamiento permanente de archivos (Vercel Blob). Hoy los
  archivos se guardan en disco.

## Fase C · Back office

- Calendario unificado de Moretti y el verificador. Día uno mueve
  cualquier fecha.
- Proyectos, en una sola vista (sin las 4 pestañas):
  - Unidades: sólo el número, sin «7 de 7».
  - Columnas nuevas: paquete comprado, fechas y folio de Stripe.
  - Prototipo y precio en la misma vista.
- Paquetes: edición partida por partida en la misma vista donde sale el
  render.
- Pagos: columna y botón de unidad.
- Pagos a Moretti: por unidad y por mes.

## Fase D · Cuentas automáticas y mensajes

- Al cobrarse el anticipo se crea sola la cuenta del comprador, con su
  liga. Toca el flujo de cobro, así que se engancha **después** de que el
  cobro se confirma, sin cambiar el cobro.
- Mensajes internos con notificaciones: ver las opciones abajo.

### Mensajes internos: opciones

1. **Hilo por unidad (recomendado).** Cada unidad tiene su conversación,
   dentro del pop-up, junto a las observaciones. Participan día uno,
   Moretti y el verificador. Un punto rojo en el menú avisa lo que no has
   leído. Es lo más simple y todo queda ligado a la unidad.
2. **Bandeja de mensajes directos.** Persona a persona, como un chat. Sirve
   para temas que no son de una unidad.
3. **Avisos automáticos.** El sistema avisa solo, por ejemplo «Moretti
   cambió la fecha de instalación de BR 1401» o «Vence una factura». Se
   suma a la 1 o a la 2.
4. **Correo o WhatsApp.** Copia de cada aviso fuera del sistema. Necesita
   contratar un servicio de correo o la API de WhatsApp Business.

Propuesta: **1 + 3** dentro del sistema primero; la 4 cuando haya servicio
de correo.
