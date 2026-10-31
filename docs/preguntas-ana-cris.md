# Preguntas para Ana Cris

Lo que falta decidir para cerrar el prototipo. Al lado, lo que hace hoy el
sistema mientras no se decida. Anotar la respuesta y pasarla a
`decisiones.md`.

## Cuentas y accesos

| # | Pregunta | Hoy |
|---|---|---|
| 1 | ¿La cuenta del comprador para el portal se crea sola al pagar el anticipo, o la da día uno a mano? | A mano, en Back office › Usuarios. |
| 2 | ¿Quién le manda la liga de acceso a cada persona, y por dónde (correo o WhatsApp)? | Se copia y se manda a mano. |
| 3 | ¿Contratamos un servicio de correo (Resend, SendGrid) para mandar ligas y avisos solos? | No se manda ningún correo. |
| 4 | ¿Hace falta «olvidé mi contraseña» o basta con que día uno genere otra liga? | Día uno genera otra liga. |

## Perfiles

| # | Pregunta | Hoy |
|---|---|---|
| 5 | ¿Está bien el reparto de pasos? Moretti: producción, producido, almacén, instalada. Verificador: medición y entrega con acta. día uno: acabados y fecha de instalación. | Así funciona (D-48). |
| 6 | ¿PISSA necesita las fechas exactas de cada visita? | Sólo ve quién va a entrar, sin fecha: no se guarda el calendario de obra. |

## Pagos y facturas

| # | Pregunta | Hoy |
|---|---|---|
| 7 | ¿Cuándo activamos el cobro con dinero real? | Sólo modo prueba. |
| 8 | ¿El anticipo se cobra al momento o sólo se aparta en la tarjeta y se cobra después? | Se cobra al momento (`STRIPE_CAPTURE_METHOD`). |
| 9 | ¿Quién emite la factura (CFDI) de cada cobro: Moretti o día uno? (I-11) | Moretti sube el folio o el XML. |
| 10 | ¿Revisamos cada factura contra el SAT? | Sólo se revisa que el folio tenga forma correcta. |
| 11 | ¿El comprador puede cambiar su tarjeta desde su portal? | No: lo hace día uno. |
| 12 | El % de comisión: la tarifa de Stripe la paga día uno. ¿Lo tomó en cuenta? | — |

## Para ratificar

| # | Pregunta |
|---|---|
| 13 | Las decisiones D-22 a D-51 de `decisiones.md` (las marcadas «por ratificar»). |
| 14 | El aviso de D-46 (regreso a la tipografía Poppins). |
