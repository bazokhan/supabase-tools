---
"@sbtools/core": patch
"@sbtools/ui-web": patch
---

Improve first-run dashboard usability and operations visibility.

- Allow operational routes (Migration Studio, Commands, Plugins, Services) to render even when atlas data is missing.
- Add dashboard plugin management APIs and UI for add/enable/disable/remove with install/load status visibility.
- Add command prerequisite and runtime-state metadata so runner buttons are status-aware and prevent duplicate singleton launches.
- Add Services page with Docker status plus reachable local UI endpoints (Supabase Studio, docs UIs, migration studio).
