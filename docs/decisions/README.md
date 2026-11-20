# Decisiones de diseño

Cada archivo explica una decisión: qué problema había, qué se eligió, qué se descartó y dónde se ve en el código. Una decisión no se edita para cambiarla; se escribe una nueva que la reemplaza.

| N.º | Decisión | Estado |
|---|---|---|
| [ADR_001](ADR_001-four-services.md) | Cuatro piezas separadas: frontend, backend, servicio de IA y base de datos | Aceptada |
| [ADR_002](ADR_002-ai-interprets-geometry-builds.md) | La IA interpreta, la geometría determinista construye y el profesional valida | Aceptada |
| [ADR_003](ADR_003-roles-strategy.md) | Cinco roles fijos con una política por rol (Strategy) | Aceptada |
| [ADR_004](ADR_004-demo-accounts-without-passwords.md) | Cuentas de prueba sin contraseña conocida | Aceptada |
| [ADR_005](ADR_005-commands-for-corrections.md) | Cada corrección es un comando que se puede deshacer | Aceptada |
| [ADR_006](ADR_006-stateless-jwt-and-limits.md) | Sesión con JWT sin estado y límites de uso en el servidor | Aceptada |
| [ADR_007](ADR_007-deterministic-takeoff.md) | Cantidades y presupuesto calculados con fórmulas, no con IA | Aceptada |
