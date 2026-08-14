# Recommendations for an Institutional Canvas Deployment

This document guides a university pilot (e.g., UNAB). The final decision belongs to Canvas administration, security, infrastructure, data protection, and academic owners.

## 1. Root account or sub-account

Canvas allows installing tools at the account or course level. For a pilot:

- prefer a **sub-account** or a set of controlled courses;
- use the root account only if the tool is institutional, the placement is desired for everyone, and the scopes were approved;
- document who can enable/disable the tool and how it is reverted.

A sub-account reduces operational scope, but it does not replace the plugin's internal authorization or scope minimization.

## 2. Current placement

`config/lti_placement.json` contains a local `course_navigation` placement with `visibility: "public"`. Older documentation stated `visibility: "admins"`; that does not match the code.

Before the pilot, decide which roles should see the link and generate a production configuration. Menu visibility is not access control: the backend must always authorize the launch role and context.

## 3. Origin and proxy

Serve the plugin's frontend and backend under a single origin, for example:

```text
https://feedback.institution.example/
https://feedback.institution.example/api/...
```

This simplifies CORS and the plugin's internal session. It does not by itself eliminate the third-party cookies problem: Canvas and the plugin are still distinct sites when the tool is in an iframe. Validate `Secure`, `SameSite`, OIDC redirects, browser policies, and alternatives that do not rely on blocked storage.

## 4. LTI Advantage and scopes

Current scopes:

| Service | Scope | Expected use |
|---|---|---|
| AGS | `lineitem` | check/manage authorized line items |
| AGS | `result.readonly` | read results |
| AGS | `score` | publish scores when the flow requires it |
| NRPS | `contextmembership.readonly` | get context memberships/roles |

Validate whether all are necessary for the approved requirements. Publishing feedback via Canvas APIs and accessing submissions may require additional Canvas scopes on the corresponding token/API; do not broaden permissions for convenience.

## 5. Identity and authorization

- allowlist of institutional issuers and deployments;
- signature validation with Canvas JWKS and secure rotation/cache;
- single-use `state` and `nonce` with expiration;
- authorization by role, course, account, and membership;
- stable mapping between LTI subject and internal user;
- revocation when an enrollment/role changes;
- audit without tokens or sensitive data.

If there are multiple replicas, OIDC state, sessions, idempotency, and jobs cannot rely on a single process's memory.

## 6. Personal and academic data

Before enabling AI:

- define what student data leaves the institution;
- minimize names, submissions, grades, and context;
- establish legal basis, retention, residence, and provider contract;
- allow human review before sending;
- log provider/model/configuration without storing secrets;
- document correction, deletion, and incident response.

SIS/local mocks cannot be confused with real institutional integrations.

## 7. AI Providers

The factory supports Gemini, OpenAI, Claude, and custom. The institution must approve:

- provider and endpoints;
- allowed models;
- keys per environment and rotation;
- limits/quotas and rate limit handling;
- content and data policy;
- fallback when AI is disabled.

The absence of a key/AI must produce a readable and explicit mode, not an indefinitely loading screen.

## 8. Email and notifications

The current adapter `EmailService.local.js` writes to `local-emails.log`; it does not send institutional email. Production requires:

- approved SMTP/API provider;
- verified sender/domain;
- accessible templates;
- idempotent retries and dead-letter;
- preferences/consent;
- delivery, bounce, and complaint metrics;
- RF42/RF44 testing with staging accounts.

## 9. Operation

Define owners for:

- availability and on-call;
- PostgreSQL, backups, and restoration;
- certificates, keys, and rotation;
- Canvas/LTI updates;
- AI quotas and costs;
- teacher/student support;
- privacy/security incidents;
- application and migrations rollback.

## 10. Progressive pilot

1. local lab with synthetic data;
2. staging Canvas and real TLS domain;
3. closed course with administrators/QA;
4. volunteer teachers and test students;
5. sub-account pilot with monitoring and support;
6. quality, security, costs, and operation evaluation;
7. formal decision before expanding scope.

Do not promote the tool to root account just because the local setup works.

## 11. Approval evidence

- LTI configuration and scopes signed by owners;
- role/course matrix and negative tests;
- DPIA/privacy assessment if applicable;
- threat model and security scan;
- generate/review/send/notify E2E;
- load testing with authorized scenarios;
- backup recovery and rollback;
- operational manual and help desk;
- pilot success and exit criteria.
