# ADR_001: Cuatro piezas separadas

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: diagrama de contexto, diagrama de despliegue

## Contexto
Render.IA tiene que recibir un plano, analizarlo con IA, guardar los resultados y mostrarlos en 3D. Somos dos personas y cada una avanza en partes distintas. Además, el modelo de IA va a cambiar: empezamos con un detector propio y luego agregamos Gemini.

## Decisión
Separar el sistema en cuatro repositorios: frontend (TypeScript + Three.js en Vercel), backend (Java 21 + Spring Boot en Render), servicio de IA (Node 22 en Render) y base de datos (PostgreSQL en Neon). El frontend solo habla con el backend, y el backend es el único que llama al servicio de IA.

## Alternativas consideradas
- Un solo proyecto con todo adentro: más simple de desplegar, pero cambiar de modelo de IA obligaría a tocar el backend y no podríamos trabajar en paralelo sin pisarnos.
- Que el navegador llame directo al servicio de IA: expondría la clave del servicio y saltaría los permisos y límites del backend.

## Consecuencias
- Se puede cambiar el modelo de IA sin tocar frontend, backend ni base de datos (tabla `ai_models`).
- Cada pieza tiene su propio CI y se despliega sola.
- Hay que mantener el contrato entre piezas: está en `docs/API.md`.
- Hay más de un lugar donde configurar variables de entorno.

## Cómo defenderla
- **¿Por qué no un monolito?** Porque la IA es la parte que más cambia. Al aislarla, cambiar de modelo es agregar una clase y una fila en la tabla, sin tocar nada más.
- **Dónde se ve:** `AnalyzerFactory` en renderia-ai y `AiServiceClient` en renderia-backend.
