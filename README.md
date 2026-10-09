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
cp .env.example .env   # y ajustar VITE_API_URL
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve localmente la versión de producción |
