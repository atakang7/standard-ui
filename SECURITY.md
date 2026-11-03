# Security policy

Security fixes are made on `main`.

## Report a vulnerability

Use GitHub private vulnerability reporting if it is enabled for this repository. Otherwise contact the maintainer privately through GitHub.

Include the affected route or file, steps to reproduce, expected impact, and redacted evidence.

Do not post credentials, upload contents, or unpatched vulnerabilities in public issues.

## Deployment boundary

The app has no login or API authentication. Docker Compose publishes port 3000 on `127.0.0.1`.
