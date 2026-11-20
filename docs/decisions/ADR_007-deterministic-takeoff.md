# ADR_007: Cantidades y presupuesto con fórmulas, no con IA

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: cantidades de obra, presupuesto, exportación CSV

## Contexto
Del modelo salen cantidades (m² de muro, m³ de concreto, kg de acero) y un presupuesto con AIU e IVA. Un número de presupuesto que cambia cada vez que se pide no sirve.

## Decisión
Las cantidades se calculan con fórmulas en `src/engineering/quantities.ts`: longitud por altura menos vanos, área por espesor y acero por cuantía. El presupuesto multiplica por precios de referencia que el usuario puede cambiar (`budget.ts`). Cada línea dice cómo se calculó. Se exporta a CSV con punto y coma y coma decimal, para Excel en español.

## Alternativas consideradas
- Pedirle el presupuesto a Gemini: no es repetible y no se puede explicar de dónde sale cada número.

## Consecuencias
- El mismo modelo da siempre el mismo presupuesto, y cada valor se puede revisar a mano.
- Los precios son de referencia. El usuario debe ajustarlos a su ciudad y su fecha.

## Preguntas frecuentes
- **¿Por qué no usar IA aquí también?** Porque un presupuesto tiene que poder auditarse línea por línea. La IA ayuda a leer el plano, pero no calcula cantidades.
- **Dónde se ve:** `computeTakeoff` y `computeBudget`, con sus pruebas unitarias.
