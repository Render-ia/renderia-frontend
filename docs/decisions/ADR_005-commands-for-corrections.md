# ADR_005: Cada corrección es un comando que se puede deshacer

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: inspector de elementos, supuestos, copiloto

## Contexto
El profesional corrige lo que detectó la IA: cambia tipos, medidas, dibuja elementos faltantes, confirma supuestos y acepta propuestas del copiloto. Tiene que poder equivocarse y volver atrás.

## Decisión
Cada cambio es un objeto comando (patrón Command) con `execute` y `undo`: `EditElementCommand`, `AddElementCommand`, `RemoveElementCommand` y `UpdateSummaryCommand`. Los cambios de varios elementos van en un `CompositeCommand`, que si falla a la mitad deshace lo que alcanzó a hacer. Un historial maneja deshacer y rehacer.

## Alternativas consideradas
- Guardar copias completas del análisis antes de cada cambio: simple, pero pesado y sin una etiqueta clara de qué se deshace.
- No permitir deshacer: más fácil, pero el usuario tendría miedo de tocar.

## Consecuencias
- Aceptar una propuesta del copiloto es un solo paso que se deshace entero.
- Confirmar un supuesto actualiza todos los elementos relacionados de una vez.
- Cada comando tiene su prueba.

## Cómo defenderla
- **¿Dónde está el patrón Command?** En `src/analysis/commands`. La vista no cambia datos directamente: crea un comando y se lo pasa al historial.
- **¿Qué es el comando compuesto?** Un comando que agrupa otros, como una macro, y los aplica o revierte juntos.
