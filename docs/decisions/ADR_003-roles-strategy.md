# ADR_003: Cinco roles con una política por rol

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: gestión de usuarios, proyectos compartidos

## Contexto
No todos usan la plataforma igual. El ingeniero trabaja sus proyectos, el revisor valida los de otros, el cliente solo mira y el estudiante practica con límites. Con `if (rol == ...)` repartidos por el código, agregar un rol obliga a buscar y cambiar muchos archivos.

## Decisión
Cinco roles fijos: Administrador, Ingeniero, Revisor, Cliente y Estudiante. Cada uno tiene una clase de política (patrón Strategy) que responde qué puede hacer: ver todos los proyectos, cambiarlos, revisar, compartir y cuántos proyectos crear. La política existe en el backend (`security/policy`) y en el frontend (`src/auth/policies.ts`). El backend es el que decide. El frontend solo esconde botones.

## Alternativas consideradas
- Permisos configurables por el administrador: más flexibles, pero más tablas y pantallas, y más difíciles de probar.
- Solo dos roles (admin y usuario): no cubre al cliente ni al revisor de la propuesta.

## Consecuencias
- Agregar un rol es una clase nueva y una línea en `RolePolicies`.
- Las reglas tienen pruebas unitarias por rol.
- Un proyecto se comparte por correo (tabla `project_members`) y el invitado solo lo puede ver.

## Preguntas frecuentes
- **¿Dónde está el patrón Strategy?** En `RolePolicy`: cada rol es una estrategia y los servicios preguntan `policy().canManageAnyProject()` en vez de comparar nombres.
- **¿Qué pasa si alguien manipula el frontend?** Nada. El backend vuelve a revisar cada permiso con el rol del token y con la base de datos.
