# Arquitectura del Sistema (C4 Model)

Este documento describe la arquitectura técnica de **Plugin Feedback** utilizando un enfoque inspirado en el [Modelo C4](https://c4model.com/). 

## 1. Diagrama de Contexto (Nivel 1)

Muestra cómo interactúa el sistema principal con los usuarios y los sistemas externos (Canvas LMS y Gemini AI).

```mermaid
graph TD
    %% Usuarios
    Profesor([Profesor])
    Alumno([Alumno])

    %% Sistemas Externos
    Canvas[Canvas LMS Local\nPlataforma de Aprendizaje]
    Gemini[Gemini AI\nMotor de IA Generativa]

    %% Sistema Central
    Plugin(Plugin Feedback LTI\nAplicación LTI 1.3)

    %% Relaciones
    Profesor -->|Configura plantillas, evalúa y aprueba feedback| Canvas
    Alumno -->|Consulta sus notas y lee el feedback| Canvas
    Canvas <-->|Handshake LTI 1.3 y OAuth2| Plugin
    Plugin <-->|Envía contexto y solicita generación de texto| Gemini

    style Plugin fill:#1168bd,stroke:#0b4884,color:#ffffff
    style Canvas fill:#999999,stroke:#666666,color:#ffffff
    style Gemini fill:#999999,stroke:#666666,color:#ffffff
```

## 2. Diagrama de Contenedores (Nivel 2)

Hace un "zoom in" dentro del "Plugin Feedback LTI" para mostrar sus contenedores internos y cómo se distribuye el flujo de datos.

```mermaid
graph TD
    CanvasEx[Canvas LMS Local] -->|HTTPS :8443| Proxy[Proxy TLS Inverso\nRedirige tráfico HTTP a HTTPS seguro]
    Proxy -->|HTTP :8080| CanvasWeb[Contenedor Canvas Web]
    
    CanvasWeb -->|LTI Launch HTTPS :3000| Backend[Servidor Backend\nNode.js + Express]
    
    subgraph Plugin Feedback
        Backend <-->|SQL| DB[(Base de Datos\nPostgreSQL :5432)]
        Backend -->|Sirve UI LTI| Frontend[Frontend React\nVite SPA]
    end

    Backend <-->|API REST HTTPS| GeminiAI[Google Gemini AI]

    style Backend fill:#1168bd,stroke:#0b4884,color:#ffffff
    style Frontend fill:#1168bd,stroke:#0b4884,color:#ffffff
    style DB fill:#1168bd,stroke:#0b4884,color:#ffffff
    style Proxy fill:#438dd5,stroke:#0b4884,color:#ffffff
```

## 3. Diccionario Técnico LTI 1.3

El protocolo **LTI (Learning Tools Interoperability) 1.3** es el estándar de seguridad que usa el plugin para comunicarse con Canvas. 

**Componentes Clave:**
*   **LTI Advantage:** Permite integraciones más profundas (como escribir calificaciones directamente en el libro de notas).
*   **OIDC Login Initiation:** Cuando el usuario hace clic en el Plugin dentro de Canvas, Canvas envía un `POST` inicial al backend para verificar identidad.
*   **JWKS (JSON Web Key Set):** El servidor backend posee una ruta criptográfica (típicamente `/jwks`) que Canvas consulta para validar que los mensajes provengan genuinamente del plugin.

> [!WARNING]
> Cualquier cambio en las rutas principales del backend (por ejemplo, cambiar la ruta de autenticación OIDC o JWKS) requerirá una reconfiguración completa de la herramienta dentro del panel de administración de Canvas LMS.
