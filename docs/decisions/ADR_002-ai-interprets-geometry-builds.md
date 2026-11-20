# ADR_002: La IA interpreta, la geometría construye, el profesional valida

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: análisis de planos, panel de validación, copiloto

## Contexto
Un modelo como Gemini lee bien un plano, pero puede inventar medidas. En ingeniería una medida inventada es un error grave. A la vez, un detector clásico mide bien pero no entiende el dibujo: no sabe qué es una cocina ni lee las cotas escritas.

## Decisión
El detector geométrico (umbral de Otsu, morfología, búsqueda de bandas) mide y produce la geometría que se guarda. Gemini lee el plano en paralelo con un esquema JSON obligatorio: habitaciones, cotas, escala y problemas de calidad. Si las dos lecturas no coinciden, sale una advertencia. Lo que el plano no dice se marca como supuesto, con su origen, y el profesional lo confirma o lo corrige. El copiloto solo propone cambios; nunca los aplica.

## Alternativas consideradas
- Solo Gemini: más rápido de programar, pero las medidas no serían confiables ni repetibles.
- Solo el detector: confiable, pero no entiende planos a mano ni fotos, y no explica nada.

## Consecuencias
- El mismo plano da siempre la misma geometría.
- Si Gemini no está configurado o se queda sin cupo, todo sigue funcionando con el detector.
- Cada elemento tiene un nivel de confianza, y el usuario ve cuáles revisar primero.
- Hay que mantener dos lecturas y compararlas.

## Cómo defenderla
- **¿Para qué Gemini si el detector ya mide?** Para entender lo que el detector no ve, como cotas escritas, habitaciones y calidad del plano, y para avisar cuando algo no cuadra. La medida final la pone la geometría o la persona.
- **Dónde se ve:** `GeminiAnalyzer` y `GeminiPlanReader.toOutput` en renderia-ai, y el panel de validación en `AnalysisDetailView`.
