# ADR_004: Cuentas de prueba sin contraseña conocida

- Estado: Aceptada
- Fecha: 2026-11-20
- Relacionado con: login, seguridad

## Contexto
Quien revise el proyecto tiene que poder entrar con cada rol sin pedirnos datos. Antes las contraseñas de prueba estaban escritas en el README, y eran las mismas que en producción.

## Decisión
Hay una cuenta de prueba por rol. En el login, el botón "Usar" llama a `POST /auth/demo` con el nombre del rol, y el backend abre la sesión. Cada vez que el backend arranca, les pone una contraseña aleatoria de 256 bits, guarda solo el hash BCrypt y la descarta. El administrador de prueba ve todo el panel, pero no puede cambiar usuarios, catálogos, modelos de IA ni proyectos ajenos (autoridad `DEMO_ACCOUNT`).

## Alternativas consideradas
- Publicar contraseñas de prueba: cualquiera las ve en el código o con "inspeccionar".
- Guardarlas en el frontend: igual quedan en el JavaScript que descarga el navegador.

## Consecuencias
- No hay ninguna contraseña en el código, en la página ni en la red.
- Las contraseñas que se publicaron antes dejaron de servir.
- Cualquiera puede entrar con un rol de prueba, así que esas cuentas no pueden dañar datos reales.

## Preguntas frecuentes
- **¿Cómo entra el botón sin contraseña?** El servidor sabe qué cuenta corresponde a cada rol y genera el token él mismo. El navegador nunca recibe una contraseña.
- **Dónde se ve:** `DemoAccounts`, `DemoAccountsInitializer` y `AuthService.demoLogin` en el backend, y `LoginView` en el frontend.
