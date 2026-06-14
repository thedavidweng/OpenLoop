# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | Yes                |
| 0.1.x   | Best effort        |
| < 0.1   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in OpenLoop, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please [open a private security advisory](https://github.com/thedavidweng/OpenLoop/security/advisories/new) on GitHub with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 72 hours. We will work with you to understand and address the issue before any public disclosure.

## Scope

OpenLoop is a local-first desktop application. The attack surface is limited:

- **Local backend**: The ACE-Step backend listens on `127.0.0.1` only — not exposed to the network.
- **No cloud services**: No user data is sent to external servers (see [Privacy Policy](docs/privacy.md)).
- **No authentication**: There is no login system or user accounts.
- **Model downloads**: Model weights are downloaded from Hugging Face over HTTPS. SHA256 verification is planned.

## What to Look For

Relevant security concerns include:

- WebView injection or CSP bypass in the Tauri shell
- Path traversal in file operations (output directory, model storage)
- Command injection in backend process management
- Unsafe deserialization of user input
- Dependency vulnerabilities in Rust or npm packages

## Acknowledgments

We appreciate responsible disclosure and will credit reporters (with permission) in release notes.
