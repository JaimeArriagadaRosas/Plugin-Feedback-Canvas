# Política de seguridad

## Versiones cubiertas

Mientras el proyecto permanezca en validación preproductiva, solo se reciben correcciones de seguridad sobre la rama de desarrollo activa. No existe todavía una versión productiva con soporte o SLA publicado.

## Cómo reportar una vulnerabilidad

No publique credenciales, exploits funcionales ni datos personales en un issue público.

1. Use **Security > Report a vulnerability** en el repositorio de GitHub para abrir un aviso privado.
2. Incluya componente afectado, impacto, condiciones de explotación y una reproducción mínima sin secretos reales.
3. Si una credencial pudo exponerse, revóquela o rótela inmediatamente; eliminarla de un commit no invalida copias del historial.

El mantenedor confirmará la recepción y coordinará la divulgación según severidad y disponibilidad. Este proyecto no declara por ahora tiempos de respuesta garantizados.

## Alcance prioritario

- validación OIDC/JWT, `state`, `nonce` y deployments LTI;
- autorización por rol, curso y usuario;
- manejo y cifrado de tokens Canvas y claves de IA;
- inyección SQL, XSS, SSRF y carga de archivos;
- aislamiento del bypass local respecto de producción;
- exposición de Docker, PostgreSQL, Gotenberg o endpoints administrativos;
- secretos presentes en el árbol o historial Git.

## Escaneo de secretos

La política de Gitleaks y la línea de base histórica se explican en [GITLEAKS.md](GITLEAKS.md). Una coincidencia nueva no debe silenciarse mediante allowlists amplias.

## Datos de prueba

Las cuentas `@canvas.local`, la contraseña `password123` y los documentos de fixtures son exclusivamente sintéticos. No deben habilitarse en redes públicas ni reutilizarse en entornos institucionales.
