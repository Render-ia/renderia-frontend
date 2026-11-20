# Preguntas probables del jurado

Respuestas cortas para decirlas con nuestras palabras. El detalle de cada decisión está en [decisions/](decisions/README.md).

## Sobre el producto

**¿Qué hace Render.IA?**
Recibe el plano 2D de una casa, detecta muros, columnas, vigas, losa, puertas y ventanas con sus medidas y arma un modelo 3D. El profesional revisa la propuesta, la corrige y saca cantidades y un presupuesto.

**¿La IA reemplaza al ingeniero?**
No. La IA interpreta el plano, la geometría mide y el ingeniero valida. Cada elemento muestra su nivel de confianza, lo que no estaba en el plano aparece como supuesto, y nada queda como revisado hasta que una persona lo marca.

**¿Qué pasa si Gemini falla o no hay internet hacia Google?**
El análisis sigue con el detector geométrico propio y la app avisa que Gemini no estuvo. Nunca depende de un servicio externo para funcionar.

**¿Cumple la NSR-10?**
No certifica nada. El copiloto puede comentar contra criterios generales, pero lo dice como recomendación y no inventa artículos. La responsabilidad es del profesional.

## Sobre patrones

| Patrón | Dónde | En una frase |
|---|---|---|
| Strategy | Políticas por rol, analizadores de IA | Cada rol o cada modelo responde a su manera detrás de la misma interfaz |
| Factory | `AnalyzerFactory`, `RepositoryFactory` | Elige la clase concreta según la configuración |
| Command | Correcciones en el inspector | Cada cambio se puede deshacer y rehacer |
| Composite | `CompositeCommand` | Varios cambios se aplican o revierten juntos |
| Facade | `AnalysisService`, `CopilotService` | Una llamada esconde validar, buscar datos y llamar a la IA |
| Adapter | `GeminiClient` | La única clase que conoce el SDK de Google |
| Singleton | `Session`, `MockDatabase`, servicios de Spring | Una sola instancia compartida |
| Repository | `repository/*`, `src/data/*` | Separa el acceso a datos de la lógica |
| Template Method | `CatalogService` | Los tres catálogos siguen los mismos pasos |

## Sobre seguridad

**¿Dónde están las contraseñas?**
Solo como hash BCrypt en la base de datos. Las cuentas de prueba ni siquiera tienen una contraseña conocida: entran por `/auth/demo` y su contraseña cambia por una aleatoria en cada arranque.

**¿Qué impide que un estudiante vea proyectos de otro?**
El backend revisa en cada petición, con el rol del token y la base de datos, si el proyecto es suyo, si se lo compartieron o si su rol ve todo. Si no, responde 404 para no revelar que el proyecto existe.

**¿Y si alguien prueba contraseñas sin parar?**
Después de 5 intentos fallidos por correo, o 30 por IP, en 15 minutos, responde 429 y le dice cuánto esperar.

**¿Las claves están en GitHub?**
No. Viven en variables de entorno de Render: `JWT_SECRET`, `AI_API_KEY` y `GEMINI_API_KEY`. Sin `JWT_SECRET` el backend no arranca en producción.

## Cifras del proyecto (20 de noviembre de 2026)

| Pieza | Pruebas automáticas | CI |
|---|---|---|
| Frontend | 63 | GitHub Actions: tipos, pruebas y build |
| Backend | 78 | GitHub Actions: compila, prueba e imagen Docker; Render despliega solo si pasa |
| Servicio de IA | 28 | GitHub Actions |
| Base de datos | Carga del esquema, datos y migraciones (dos veces) | GitHub Actions con PostgreSQL |

Con el plano de ejemplo a escala 1:100, el detector encuentra 18 muros, 11 columnas, 6 puertas, 5 ventanas, 15 vigas y la losa, y una prueba lo comprueba.
