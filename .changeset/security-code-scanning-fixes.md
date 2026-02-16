---
"@sbtools/sdk": patch
"@sbtools/plugin-migration-studio": patch
---

# Security: address CodeQL / github-advanced-security findings

- **plugin-migration-studio**: Whitelist HTTP method before route lookup to avoid unvalidated dynamic dispatch (CodeQL: unvalidated dynamic method call).
- **sdk**: Replace ReDoS-vulnerable block comment regex in sql-analyzer with linear-time pattern (CodeQL: polynomial regular expression on uncontrolled data).
