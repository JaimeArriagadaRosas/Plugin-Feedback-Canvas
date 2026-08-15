# System Token vs OAuth Tokens

This document explains the dual-token architecture used by the Plugin Feedback Canvas in local development and production.

## 1. System Token (`CANVAS_ACCESS_TOKEN`)
- **Location**: Injected into the `.env` file via the `SystemTokenManager` during boot.
- **Role**: This is an **infrastructure-level token**. It acts on behalf of a dedicated system service account (`system@canvas.local`).
- **Purpose**: It is used exclusively by the plugin's backend server to perform background system operations such as:
  - Verifying the LTI 1.3 installation status on boot.
  - Interacting with Canvas APIs outside the context of a specific user.
  - Running maintenance scripts or orchestrator health checks.
- **Persistence**: Saved only in `.env`. It is *not* stored in the PostgreSQL database.

## 2. User OAuth Tokens
- **Location**: Stored securely in the PostgreSQL `canvas_user_tokens` table.
- **Role**: These are **user-level tokens**. They represent actual human users (teachers, students, admins).
- **Purpose**: They are used to perform Canvas API calls on behalf of the user who initiated the request.
- **Authorization Flow**: 
  - Every user (including the default `teacher@canvas.local`) must explicitly authorize the plugin the first time they use it.
  - When the user launches the LTI tool, if the server does not have an OAuth token stored for their LTI ID (`canvas_sub`), the server will redirect them to the Canvas OAuth2 consent screen.
  - Once authorized, the token is stored in the database.
- **Why is this necessary?**: This ensures that our local development environment mirrors production reality perfectly. In production, there is no "global fallback token". By forcing every local teacher and student to authorize individually, we guarantee that the LTI launch and OAuth2 flow code is rigorously tested during everyday development.

## Historical Note
In earlier versions, a "Teacher Token" was generated at boot and stored in `.env`. The backend incorrectly used this token as a global fallback for all API requests if a user didn't have their own token. This created a "bug masked as expected behavior" where the initial teacher never had to authorize via OAuth, hiding potential issues with the LTI launch flow. The architecture has since been corrected to the strict separation described above.
