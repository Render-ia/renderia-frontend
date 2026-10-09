# Contrato de la API — Render.IA

Endpoints que el frontend espera del backend (`renderia-backend`) cuando corre con
`VITE_DATA_SOURCE=api`. Todas las rutas cuelgan de `/api/v1`.

- Los nombres de los campos en JSON van en **camelCase** (lo que Spring Boot genera por defecto
  con Jackson), y corresponden 1 a 1 con las columnas de `schema.sql`
  (`floor_level` → `floorLevel`, `ai_model_id` → `aiModelId`, etc.).
- Fechas en ISO 8601 (`2026-10-09T14:00:00Z`).
- Las medidas de `structural_elements` van en **metros**.
- Errores: código HTTP adecuado y cuerpo `{ "message": "Texto para el usuario" }`. El frontend
  muestra ese `message` tal cual, así que debe ir en español.
- Autenticación: el login devuelve un `token`; el frontend lo manda en cada petición como
  `Authorization: Bearer <token>`. Sin token válido → `401`.

## Autenticación

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/register` | `{ fullName, email, password, roleId }` | `{ token, user }` |
| GET | `/auth/me` | — | `user` (o `401`) |

`user` siempre incluye su rol:

```json
{
  "id": 2,
  "roleId": 2,
  "fullName": "Laura Gómez",
  "email": "ingeniero@renderia.co",
  "isActive": true,
  "createdAt": "2026-10-01T14:00:00Z",
  "role": { "id": 2, "name": "Ingeniero", "description": "Crea proyectos y analiza planos estructurales" }
}
```

Reglas: el registro solo acepta los roles Ingeniero (2) y Estudiante (3). Correo repetido → `409`.
Cuenta desactivada → `403`.

## Usuarios y roles (solo Administrador)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/users` | — | `user[]` |
| PUT | `/users/{id}` | `{ roleId?, isActive? }` | `user` |
| GET | `/roles` | — | `role[]` |

Debe quedar siempre al menos un administrador activo (`400` si no).

## Catálogos

`{catalogo}` es `building-types`, `element-types` o `materials`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/{catalogo}` | — | `[{ id, name, description }]` |
| POST | `/{catalogo}` | `{ name, description }` | ítem creado |
| PUT | `/{catalogo}/{id}` | `{ name, description }` | ítem actualizado |
| DELETE | `/{catalogo}/{id}` | — | `204` (o `409` si está en uso) |
| GET | `/ai-models` | — | `[{ id, name, provider, modelIdentifier, isActive, isDefault }]` |
| PUT | `/ai-models/{id}` | `{ isActive?, isDefault? }` | modelo actualizado |

Solo un modelo puede ser `isDefault`; al marcar uno, los demás quedan en `false`.

## Proyectos

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/projects?userId={id}` | — | `project[]` (sin `userId`: todos, solo admin) |
| GET | `/projects/{id}` | — | `project` |
| POST | `/projects` | `{ name, description, location, buildingTypeId }` | `project` |
| PUT | `/projects/{id}` | igual que POST | `project` |
| DELETE | `/projects/{id}` | — | `204` |

El dueño (`userId`) se toma del token, no del cuerpo. Los estudiantes pueden tener máximo
3 proyectos (`403` al intentar el cuarto).

## Planos

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/floor-plans` | — | `floorPlan[]` |
| GET | `/floor-plans/{id}` | — | `floorPlan` |
| GET | `/projects/{id}/floor-plans` | — | `floorPlan[]` |
| POST | `/projects/{id}/floor-plans` | `multipart/form-data`: `file`, `floorLevel`, `scale` | `floorPlan` |
| DELETE | `/floor-plans/{id}` | — | `204` |

`fileUrl` debe ser una URL pública de la imagen (por ejemplo en un bucket). El frontend la
descarga en el navegador para analizarla, así que el servidor de archivos debe permitir CORS.

## Análisis de IA

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/analyses` | — | `analysis[]` |
| GET | `/analyses/{id}` | — | `analysis` |
| POST | `/analyses` | `{ floorPlanId, aiModelId }` | `analysis` en `PENDING` |
| PUT | `/analyses/{id}` | `{ status?, rawResponse?, errorMessage?, durationMs? }` | `analysis` |
| DELETE | `/analyses/{id}` | — | `204` |
| GET | `/analyses/{id}/elements` | — | `element[]` |
| POST | `/analyses/{id}/elements` | `elementInput[]` | `element[]` guardados |
| PUT | `/elements/{id}` | `{ elementTypeId?, materialId? }` | `element` |
| DELETE | `/elements/{id}` | — | `204` |

Estados válidos (`status`): `PENDING → PROCESSING → COMPLETED` o `FAILED`; de `FAILED` se puede
volver a `PENDING`. Cualquier otro salto → `400`.

```json
{
  "elementTypeId": 1,
  "materialId": 2,
  "startX": 0.64, "startY": 0.8, "endX": 2.3, "endY": 0.8,
  "width": null, "height": 2.5, "thickness": 0.15,
  "confidence": 0.7159
}
```

### Modelos que corren en el servidor

Para modelos con `provider` distinto de `mock` y `local-vision` (por ejemplo uno que llame a una
IA de visión), el frontend pide el análisis al backend:

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/ai/analyze` | `{ floorPlanId, aiModelId, scale }` | `{ elements: detected[], summary: {} }` |

`detected` usa nombres en vez de ids, y el frontend los traduce con los catálogos:

```json
{ "type": "Columna", "material": "Concreto reforzado", "startX": 0.8, "startY": 0.8,
  "endX": null, "endY": null, "width": 0.3, "height": 2.8, "thickness": 0.3, "confidence": 0.95 }
```

## Modelos 3D y actividad

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/models-3d` | — | `model3d[]` |
| GET | `/analyses/{id}/model-3d` | — | `model3d` (o `404`) |
| POST | `/models-3d` | `{ floorPlanId, aiAnalysisId, fileUrl, format, elementCount }` | `model3d` |
| GET | `/activity-logs?limit=8&userId={id}` | — | `activityLog[]`, más recientes primero |
| POST | `/activity-logs` | `{ action, details }` | `activityLog` (usuario tomado del token) |

## Prueba de conexión

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/hello` | `{ proyecto, descripcion, integrantes[], mensaje }` (ya existe) |
