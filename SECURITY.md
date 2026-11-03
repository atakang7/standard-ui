# Security Policy

## Supported Versions

Security fixes land on `main` first.

## Reporting a Vulnerability

- Do not open a public issue for credential leaks, auth bypasses, SSRF, remote code execution, or anything that could expose user data or provider secrets.
- If GitHub private vulnerability reporting is available for this repository, use that first.
- Otherwise contact the maintainer privately through GitHub before sharing details publicly.

When reporting a vulnerability, include:

- a short description of the issue and impact
- exact steps to reproduce it
- affected routes, files, or provider configurations
- sanitized logs, payloads, or screenshots if they help

The goal is to acknowledge valid reports quickly, reproduce them, and fix them on `main` before public disclosure.
