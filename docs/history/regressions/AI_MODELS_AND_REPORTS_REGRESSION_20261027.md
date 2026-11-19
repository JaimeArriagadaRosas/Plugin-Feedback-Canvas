# AI model discovery and reporting state regression — 2026-10-27

## Findings
- Gemini listModels is fetched dynamically from Google's v1beta models API, but generateContent alone does not establish text-only compatibility: image/TTS models can be included, and some older or experimental IDs should not be offered.
- Dashboard and export summaries excluded ENVIADO from approvals while the feedback history contained completed deliveries.
- Excel historical rows rendered missing teacher/student ratings as literal null followed by a star.

## Changes
- GeminiProvider now filters image/audio/live/video/embedding/robotics/computer-use families, known retired version patterns and experimental aliases. Compatible text generation models remain dynamically fetched. The filters are preventive heuristics, NOT an authoritative deprecation registry; Google's API and official retirement documentation remain authoritative for exact model lifecycle.
- Shared FeedbackStatusMetrics helper identifies both APROBADO and ENVIADO as approved for aggregate KPIs. The original lifecycle state is not changed.
- StatsService exposes approvedTotal and approvalPercentage. Admin panel reflects approved + sent and separately displays ENVIADO count.
- Excel and PDF approval-rate metrics count ENVIADO as approved, preserving detailed statuses and adding a sent counter. Null ratings export as N/A instead of literal null with a star.

## Evidence
Before changes, Spanish regression reproduced 2 failures out of 3 report cases and 2 failures out of 3 Gemini cases (including malformed metadata causing retry timeout).
After changes, 6/6 specific regression tests passed in each branch. Server and installer npm test: 341 passed, 21 skipped in each branch; ESLint passed; frontend build passed.
English regression test uses the corresponding English Excel worksheet and field names.
No real API keys were exposed or modified; no DB changes, reset, Docker deletion or migrations were performed.

## Pending acceptance
Manual admin LTI walkthrough, actual Gemini API response with an authenticated key, PDF visual inspection with approved + sent statuses, and a clean boot run. Fallback model lists and backend saving of manually supplied model IDs should be reviewed separately before assuming every deprecated model is blocked.
