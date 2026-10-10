# Render.IA — Frontend

Interfaz web de **Render.IA**, una plataforma que usa inteligencia artificial para convertir planos 2D en modelos estructurales 3D.

Proyecto final de **Patrones de Software**.

**Demo en línea:** https://renderia-frontend.vercel.app

- **Integrantes:** Juan David Moreno, Felipe Cerón
- **Backend:** [renderia-backend](https://github.com/Render-ia/renderia-backend) (Java 21 + Spring Boot)
- **Base de datos:** [renderia-database](https://github.com/Render-ia/renderia-database) (PostgreSQL en Neon)

## Qué hace

1. **Cuentas con roles.** Administrador, Ingeniero y Estudiante, cada uno con permisos distintos.
2. **Proyectos.** Cada proyecto agrupa los planos de una edificación (tipo, ubicación, descripción).
3. **Planos.** Se sube el plano de planta de cada piso (PNG, JPG, WEBP o SVG) con su escala.
4. **Análisis con IA.** Un modelo de visión lee el plano y detecta muros, columnas, vigas, losa, puertas y ventanas, con sus medidas en metros y un nivel de confianza. Los resultados se ven dibujados sobre el plano y se pueden corregir.
5. **Visor 3D.** El análisis se convierte en un modelo estructural 3D que se puede girar, filtrar por capas, colorear por tipo o material y exportar en **GLB**.
6. **Administración.** Usuarios, catálogos, modelos de IA y registro de actividad.

## La IA: detector de visión local

`src/analysis/analyzers/LocalVisionAnalyzer.ts` lee el plano en el navegador, sin servidor:

1. Convierte la imagen a blanco y negro con el **umbral de Otsu**.
2. Mide el **espesor típico de muro** con la longitud más común de los trazos.
3. Quita líneas delgadas (texto, cotas, arcos de puertas) con una **apertura morfológica**.
4. Busca **muros** como bandas de filas o columnas con trazos largos alineados.
5. Encuentra **columnas** erosionando la imagen: los muros desaparecen y solo quedan los cuadros más gruesos.
6. Deduce **puertas y ventanas** de los huecos entre tramos de un mismo muro, **vigas** entre columnas unidas por un muro, y la **losa** con el contorno del edificio.
7. Pasa de píxeles a metros con la escala del dibujo (escaneo a 150 ppp).

Con el plano de ejemplo (`public/samples/plano-casa.svg`) detecta los 18 tramos de muro, 11 columnas, 6 puertas, 5 ventanas y 15 vigas en menos de medio segundo.

## Patrones de software

| Patrón | Dónde | Para qué |
|---|---|---|
| **Singleton** | `AppConfig`, `ApiClient`, `Session`, `MockDatabase`, `CatalogService` | Una sola instancia compartida de la configuración, el cliente HTTP, la sesión y los datos |
| **Observer** | `EventBus`, `appEvents`, `ActivityLogger`, `AppShell` | Avisar cambios de ruta, sesión y estado de análisis sin acoplar componentes; el log de actividad escucha eventos |
| **Template Method** | `View`, `ElementMeshCreator.create()` | Pasos fijos (`render` → `afterRender`; construir → etiquetar) con detalles en las subclases |
| **Strategy** | `RolePolicy` (`AdminPolicy`, `EngineerPolicy`, `StudentPolicy`) y `PlanAnalyzer` (`LocalVisionAnalyzer`, `SampleResponseAnalyzer`, `BackendAnalyzer`) | Permisos según el rol y forma de analizar según el modelo de IA, intercambiables |
| **Abstract Factory** | `RepositoryFactory` → `MockRepositoryFactory` / `ApiRepositoryFactory` | Familias de repositorios (en el navegador o contra el backend) sin cambiar las vistas |
| **Factory Method** | `AnalyzerFactory`, `ElementMeshFactory` + creadores de mallas | Crear el analizador según `ai_models.provider` y la pieza 3D según el tipo de elemento |
| **Facade** | `AnalysisFacade` | Una sola llamada (`run`) esconde todo el proceso: registro, estados, IA, guardado y modelo 3D |
| **State** | `AnalysisState` (`PendingState`, `ProcessingState`, `CompletedState`, `FailedState`) | Ciclo de vida de un análisis y transiciones válidas |
| **Builder** | `StructuralSceneBuilder` | Armar la escena 3D paso a paso (fondo, elementos, terreno, luces) |
| **Repository** | `data/repositories.ts` | Separar el acceso a datos de la lógica de las pantallas |

## Tecnologías

- **TypeScript** con programación orientada a objetos, sin framework
- **Vite** como servidor de desarrollo y empaquetador
- **Three.js** para el visor 3D (se carga solo al abrir el visor)
- **Vercel** para el despliegue en la nube

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` y entra con una de las cuentas de prueba:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@renderia.co | Admin123* |
| Ingeniero | ingeniero@renderia.co | Ingeniero123* |
| Estudiante | estudiante@renderia.co | Estudiante123* |

### Fuente de datos

| `VITE_DATA_SOURCE` | Qué hace |
|---|---|
| `mock` (por defecto en `localhost`) | Todo se guarda en el navegador. Funciona sin backend. |
| `hybrid` (por defecto en producción) | Inicio de sesión, registro y catálogos van al backend real; proyectos, planos y análisis siguen en el navegador mientras se publican sus endpoints. |
| `api` | Todo va al backend en `VITE_API_URL`. Los endpoints esperados están en [`docs/API.md`](docs/API.md). |

Si `VITE_API_URL` está vacía, en producción se usa `https://renderia-backend.onrender.com/api/v1`.

En desarrollo, Vite redirige `/api` a `http://localhost:8080`, así que no hace falta configurar CORS para probar con el backend local.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve localmente la versión de producción |

## Despliegue en Vercel

1. En [vercel.com](https://vercel.com), **Add New → Project** e importar `Render-ia/renderia-frontend`.
2. Vercel detecta Vite solo (`vercel.json` ya trae la configuración).
3. Variables de entorno: `VITE_DATA_SOURCE=mock` para la demo, o `VITE_DATA_SOURCE=api` y `VITE_API_URL=https://<backend>/api/v1` cuando el backend esté publicado.
4. **Deploy.** Cada push a `main` se publica de nuevo automáticamente.

## Estructura

```
src/
├── analysis/          IA: estados, fachada, fábrica de analizadores
│   ├── analyzers/     Detector de visión local, respuesta de ejemplo, backend
│   └── vision/        Imagen binaria, muros, columnas, puertas y vigas
├── auth/              Sesión, servicio de autenticación y políticas por rol
├── core/              Configuración, eventos, cliente HTTP, enrutador, almacenamiento
├── data/              Contratos de repositorios y sus dos familias (mock y api)
├── models/            Tipos que reflejan las tablas de schema.sql
├── services/          Reglas de negocio: proyectos, planos, análisis, catálogos, actividad
├── ui/                Marco de la app, diálogos, avisos, superposición del plano
├── viewer/            Visor 3D: constructor de escena y creadores de mallas
├── views/             Pantallas (todas heredan de View)
└── styles/            Tokens de diseño y estilos por sección
```
