# Render.IA — Frontend

Interfaz web de **Render.IA**, una plataforma que usa inteligencia artificial para convertir planos 2D en modelos estructurales 3D.

Proyecto final de **Patrones de Software**.

- **Integrantes:** Juan David Moreno, Felipe Cerón
- **Backend:** [renderia-backend](https://github.com/Render-ia/renderia-backend) (Java 21 + Spring Boot)
- **Base de datos:** [renderia-database](https://github.com/Render-ia/renderia-database) (PostgreSQL en Neon)

## Tecnologías

- **TypeScript** con programación orientada a objetos
- **Vite** como servidor de desarrollo y empaquetador
- **Vercel** para el despliegue en la nube

## Cómo ejecutarlo

```bash
npm install
cp .env.example .env   # opcional: solo para apuntar a otro backend
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve localmente la versión de producción |

## Estructura

```
src/
├── core/
│   ├── config/AppConfig.ts   Configuración de la app (Singleton)
│   ├── events/               EventBus tipado (Observer) y eventos globales
│   ├── http/                 ApiClient (Singleton) y ApiError
│   └── router/Router.ts      Enrutador por hash (#/ruta)
├── services/                 Comunicación con el backend por recurso
├── views/                    Pantallas; todas heredan de View (Template Method)
├── ui/                       Marco de la app, navegación y logo
├── utils/                    Funciones de apoyo
└── styles/                   Tokens de diseño y estilos por sección
```

## Patrones de software en el frontend

| Patrón | Dónde | Para qué |
|---|---|---|
| Singleton | `AppConfig`, `ApiClient` | Una sola configuración y un solo cliente HTTP para toda la app |
| Observer | `EventBus`, `appEvents` | Avisar cambios de ruta y estado del servidor sin acoplar componentes |
| Template Method | `View` | Todas las pantallas siguen los mismos pasos: `render` y luego `afterRender` |
