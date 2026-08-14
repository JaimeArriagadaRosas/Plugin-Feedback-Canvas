# Security Policy

## Covered versions

While the project remains in pre-production validation, security fixes are only received on the active development branch. There is no production version with support or a published SLA yet.

## How to report a vulnerability

Do not publish credentials, functional exploits, or personal data in a public issue.

1. Use **Security > Report a vulnerability** in the GitHub repository to open a private advisory.
2. Include affected component, impact, exploitation conditions, and a minimal reproduction without real secrets.
3. If a credential could have been exposed, revoke or rotate it immediately; removing it from a commit does not invalidate history copies.

The maintainer will acknowledge receipt and coordinate disclosure based on severity and availability. This project does not currently declare guaranteed response times.

## Priority scope

- OIDC/JWT validation, `state`, `nonce`, and LTI deployments;
- authorization by role, course, and user;
- handling and encryption of Canvas tokens and AI keys;
- SQL injection, XSS, SSRF, and file uploads;
- isolation of local bypass from production;
- exposure of Docker, PostgreSQL, Gotenberg, or administrative endpoints;
- secrets present in the Git tree or history.

## Secret scanning

The Gitleaks policy and historical baseline are explained in [GITLEAKS.md](GITLEAKS.md). A new match must not be silenced through broad allowlists.

## Test data

The `@canvas.local` accounts, the `password123` password, and the fixture documents are exclusively synthetic. They must not be enabled on public networks or reused in institutional environments.
