# Historias de usuario

Cada función de Render.IA sale de una historia de usuario (HU). La tabla de rastreo al final dice en qué pantalla, endpoint y patrón vive cada una.

Formato: **Como** rol, **quiero** algo, **para** un fin. Debajo van los criterios de aceptación.

Roles: Administrador, Ingeniero, Revisor, Cliente y Estudiante.

## Cuentas y roles

### HU-01 Registrarme
Como persona nueva, quiero crear una cuenta con mi correo y una contraseña, para usar la plataforma.
- La contraseña tiene mínimo 8 caracteres y se guarda solo como hash BCrypt.
- No se puede registrar dos veces el mismo correo.
- Desde una misma IP se aceptan como máximo 10 registros por hora.

### HU-02 Iniciar sesión
Como usuario registrado, quiero entrar con mi correo y contraseña, para ver mis proyectos.
- Si el correo o la contraseña están mal, el mensaje no dice cuál de los dos falló.
- La sesión dura lo que dura el token JWT. Cuando vence, la app vuelve al login.

### HU-03 Probar la app con una cuenta de prueba
Como profesor o visitante, quiero entrar con una cuenta de prueba de cada rol desde el login, para revisar la app sin registrarme.
- El login muestra un botón "Entrar como …" por cada rol.
- Ninguna contraseña viaja al navegador: el botón pide la sesión al servidor (`/auth/demo`).
- El administrador de prueba ve todo, pero no puede cambiar nada.

### HU-04 Tener permisos según mi rol
Como usuario, quiero ver y hacer solo lo que mi rol permite, para que nadie toque lo que no le corresponde.
- El Ingeniero crea y edita sus proyectos.
- El Revisor y el Cliente solo ven los proyectos que les comparten.
- El Estudiante crea como máximo 3 proyectos.
- El Administrador ve y cambia todo.
- El servidor revisa cada permiso, aunque alguien manipule la pantalla.

## Proyectos y planos

### HU-05 Gestionar proyectos
Como ingeniero, quiero crear, editar, buscar y borrar proyectos con nombre, tipo de edificación, ubicación y descripción, para organizar mi trabajo.
- Cada campo tiene un límite de caracteres.
- Borrar un proyecto pide confirmación.

### HU-06 Compartir un proyecto
Como ingeniero, quiero compartir un proyecto por correo con un cliente o un revisor, para que lo vean sin poder cambiarlo.
- Solo se puede compartir con un usuario que ya existe.
- El dueño puede quitar el acceso.

### HU-07 Subir planos
Como ingeniero, quiero subir el plano de cada piso (PNG, JPG, WEBP, SVG o PDF) con su escala, para analizarlo.
- El archivo pesa como máximo 10 MB.
- La escala tiene la forma 1:N, con N entre 1 y 99999.
- La app avisa si el plano tiene mala calidad para analizarlo.

## Análisis con IA

### HU-08 Analizar un plano con IA
Como ingeniero, quiero escoger un modelo de IA y analizar un plano, para obtener sus elementos estructurales.
- Detecta muros, columnas, vigas, puertas, ventanas y losa, con sus medidas en metros y un nivel de confianza.
- Se puede escoger entre el detector local, que no usa internet, y Gemini.
- El análisis pasa por los estados pendiente, procesando, completado o fallido.

### HU-09 Corregir el resultado
Como ingeniero, quiero corregir o borrar elementos detectados y deshacer o rehacer los cambios, para dejar el análisis correcto.
- Se puede deshacer con Ctrl+Z y rehacer con Ctrl+Shift+Z.
- Las medidas fuera de rango (menos de 0,01 m o más de 50 m) se rechazan.

### HU-10 Preguntarle al copiloto
Como ingeniero, quiero hacerle preguntas sobre el plano a un copiloto de IA y aplicar sus propuestas, para revisar más rápido.
- Las propuestas se aplican como comandos que se pueden deshacer.
- Cada usuario tiene un número máximo de preguntas al día.

### HU-11 Firmar la revisión
Como revisor, quiero aprobar un análisis o dejarle observaciones, para que quede constancia de quién lo validó.
- La firma la escribe solo el servidor, con el nombre del revisor y la fecha.
- Si alguien intenta falsificar la firma desde el navegador, el servidor la descarta.

## Modelo 3D, cantidades y presupuesto

### HU-12 Ver el modelo 3D
Como ingeniero o cliente, quiero ver el análisis como un modelo 3D que pueda girar, filtrar por capas y colorear, para entender la estructura.
- El cliente ve una versión más sencilla, sin datos técnicos.
- El modelo se puede exportar en GLB y como imagen.

### HU-13 Calcular cantidades y presupuesto
Como ingeniero, quiero calcular las cantidades de material y el presupuesto a partir del análisis, para estimar el costo de la obra.
- Las cantidades salen de fórmulas, no de la IA.
- Se pueden ajustar los precios y el AIU.
- El presupuesto se puede descargar en CSV o imprimir como PDF.

## Administración

### HU-14 Administrar usuarios
Como administrador, quiero ver los usuarios, cambiarles el rol y activarlos o desactivarlos, para controlar quién usa la plataforma.

### HU-15 Administrar catálogos
Como administrador, quiero crear, editar y borrar tipos de edificación, tipos de elemento y materiales, para ajustar la app sin tocar el código.

### HU-16 Administrar modelos de IA
Como administrador, quiero activar o desactivar modelos de IA y escoger el modelo por defecto, para cambiar de modelo sin tocar el código.

### HU-17 Revisar la actividad
Como administrador, quiero ver el registro de actividad (quién hizo qué y cuándo), para auditar el uso.

## Rastreo de cada HU al código

| HU | Pantalla (frontend `src/views`) | Endpoint (backend `controller`) | Patrón principal |
|---|---|---|---|
| HU-01 | `auth/RegisterView` | `AuthController` POST `/auth/register` | Facade (`AuthService`) |
| HU-02 | `auth/LoginView` | `AuthController` POST `/auth/login` | Singleton (`Session`), Observer |
| HU-03 | `auth/LoginView` | `AuthController` POST `/auth/demo` | Strategy (`RolePolicy`) |
| HU-04 | todas, con `src/auth/policies.ts` | `security/policy/*` | Strategy |
| HU-05 | `projects/ProjectsView`, `projects/ProjectDetailView` | `ProjectController` | Repository, Abstract Factory |
| HU-06 | `projects/ProjectDetailView` | `ProjectMemberController` | Strategy |
| HU-07 | `projects/ProjectDetailView`, `projects/FloorPlansView` | `FloorPlanController` | Repository |
| HU-08 | `analysis/NewAnalysisView` | `AnalysisController`, `AiController` | Strategy, Factory Method, Facade, State |
| HU-09 | `analysis/AnalysisDetailView` | `AnalysisController` | Command, Composite |
| HU-10 | `analysis/CopilotPanel` | `CopilotController` | Facade, Adapter (servicio de IA) |
| HU-11 | `analysis/AnalysisDetailView` | `ReviewController` | Strategy |
| HU-12 | `viewer/ViewerView`, `viewer/ModelPickerView` | `Model3DController` | Builder, Factory Method |
| HU-13 | `engineering/QuantitiesView` | (cálculo en el navegador) | Template Method |
| HU-14 | `admin/UsersPanel` | `UserController`, `RoleController` | Template Method (`View`) |
| HU-15 | `admin/CatalogsPanel` | `BuildingTypeController`, `ElementTypeController`, `MaterialController` | Template Method (`CatalogService`) |
| HU-16 | `admin/AiModelsPanel` | `AiModelController` | Strategy, Factory Method |
| HU-17 | `admin/ActivityPanel` | `ActivityLogController` | Observer (`ActivityLogger`) |
