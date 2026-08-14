# Gitleaks and Secrets Policy

## 1. Objective

Gitleaks analyzes the current tree and the available history. `.gitleaks.toml` uses standard rules and limits exceptions to specific synthetic fixtures; allowlists of entire production directories are not permitted.

The existence of a scanner does not replace rotation, least privileges, or review of logs/artifacts.

## 2. Historical baseline

`.gitleaksignore` contains seven exact fingerprints of findings prior to `fix/linux-native-setup-hardening`. The baseline does not allow new secrets: a change of commit, line, rule, or file will fail again.

Two fingerprints correspond to old private keys present in public commits. They must be treated as exposed even if they no longer exist in the tree:

1. identify related credentials/certificates/Developer Keys;
2. revoke or rotate;
3. verify that no environment retains the values;
4. consider coordinated history rewriting only after rotating.

Rewriting history changes hashes and shared references. It is not executed from a documentation branch or without coordination of all clones/remotes.

## 3. Local check

Tree scan:

```bash
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.30.0 \
  dir /repo --config /repo/.gitleaks.toml --redact --no-banner
```

History scan (requires a clone with `.git`):

```bash
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.30.0 \
  git /repo --config /repo/.gitleaks.toml --redact --no-banner
```

A folder downloaded as a ZIP does not contain `.git` and cannot demonstrate that the history is clean.

## 4. False positives

Before ignoring:

- change fixtures to obviously synthetic values;
- confirm that the path never reaches runtime/image;
- prefer an individual documented fingerprint;
- explain the rule, file, and reason in the review.

Do not add `apps/`, `config/`, `.github/` or an entire key type to an allowlist.

## 5. Incident

If a real secret appears:

1. revoke/rotate it before editing history;
2. identify affected logs, forks, artifacts, and deployments;
3. remove it from the tree and replace the configuration mechanism;
4. open a private notice according to [SECURITY.md](SECURITY.md);
5. decide in a coordinated manner whether to rewrite history;
6. add a scanning regression test without including the compromised value.

Deleting the file or making another commit does not invalidate an exposed secret.

## 6. CI

The workflow runs Gitleaks with `fetch-depth: 0` and TruffleHog. A new finding blocks the pipeline and must be fixed; scanning is not downgraded to obtain a green state.
