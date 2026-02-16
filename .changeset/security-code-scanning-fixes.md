---
"@sbtools/sdk": patch
"@sbtools/plugin-migration-studio": patch
---

# Security: address CodeQL / github-advanced-security findings

- **plugin-migration-studio**: Validate handler is a function before invoking (CodeQL: unvalidated dynamic method call).
- **sdk**: Replace ReDoS-vulnerable block comment regex in sql-analyzer with linear-time pattern (CodeQL: polynomial regular expression on uncontrolled data).
