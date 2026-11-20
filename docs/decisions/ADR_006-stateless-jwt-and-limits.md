# ADR_006: Sesión con JWT sin estado y límites en el servidor

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: seguridad, despliegue en Render

## Contexto
El backend corre en Render y puede reiniciarse en cualquier momento. Además, la IA cuesta: cada pregunta al copiloto y cada render gastan cupo de Gemini.

## Decisión
La sesión es un JWT firmado con HS256, y la clave sale de `JWT_SECRET`. Si esa clave falta en producción, el servidor no arranca. Antes de aceptar un token se revisa que el usuario siga activo y con el mismo rol. Hay límites de intentos en el login (por correo y por IP), en el registro, y límites diarios por usuario para el copiloto y los renders. Las imágenes de planos solo se entregan con un enlace firmado que vence.

## Alternativas consideradas
- Sesiones guardadas en el servidor: se pierden en cada reinicio de Render si no se agrega otra base de datos.
- Límites solo en el frontend: cualquiera los salta llamando a la API directamente.

## Consecuencias
- Si el administrador desactiva una cuenta, sus sesiones dejan de servir de inmediato.
- Los límites diarios viven en memoria y se reinician con el servidor. Para dos personas y un curso eso es suficiente.

## Preguntas frecuentes
- **¿Qué pasa si roban un token?** Vence en 12 horas, y basta con desactivar la cuenta para que deje de servir.
- **Dónde se ve:** `SecurityConfig`, `JwtKeyConfig`, `AuthRateLimiter` y `DailyQuota` en el backend.
