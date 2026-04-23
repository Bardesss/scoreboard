# Dice Vault — Phase Index

Single source of truth for phase order, plan files, and status.

**Statuses:** `not written` → `ready to execute` → `in progress` → `done`

| Phase | Plan file | Status | Specs covered |
|---|---|---|---|
| **1a** | [phase-1a-infrastructure.md](2026-04-16-phase-1a-infrastructure.md) | done | main spec §17 |
| **1b** | [phase-1b-auth-landing.md](2026-04-16-phase-1b-auth-landing.md) | done | main spec §17 (next-intl, auth, landing, app shell) |
| **2** | [phase-2-core-features.md](2026-04-19-phase-2-core-features.md) | done | main spec §17, group features §2-4, credits spec §3 (credit pool split) |
| **2b** | [phase-2b-game-wizard.md](2026-04-20-game-wizard-phase-2b.md) | done | Improved game wizard — 5-step adaptive wizard with win types, scoring config, buy-in, colour + icon |
| **3** | [phase-3-social-connections.md](2026-04-19-phase-3-social-connections.md) | done | group features §5-8, main spec §17 (dashboard, stats) |
| **4** | [phase-4-admin-panel.md](2026-04-21-phase-4-admin-panel.md) | done | main spec §12, §14-17, group features §7 (email notifications) |
| **5** | phase-5-participants-winratio.md | done | Session participant selection, win ratio on league page + dashboard |
| **6A** | [phase-6a-tickets-cron.md](2026-04-22-phase-6a-tickets-cron.md) | done | Support tickets, cron, requiresMfa, low-credit warnings |
| **6B** | [phase-6b-analytics-taxexport.md](2026-04-22-phase-6b-analytics-taxexport.md) | done | Credit analytics, tax export scaffold, README final review |
| **7** | [phase-7a-integrations-mailgun.md](2026-04-22-phase-7a-integrations-mailgun.md) | done | Integration model, AES-256-GCM encryption, Mailgun DB migration, integrations admin UI |
| **8** | [dashboard-redesign.md](2026-04-22-dashboard-redesign.md) | done | 2×2 ranked-list panels + paginated games table |
| **9** | [log-form-win-types.md](2026-04-23-log-form-win-types.md) | ready to execute | Adaptive log form per winType + isWinner flag + schema + display + stats |
| **10** | [stats-panels-expansion.md](2026-04-23-stats-panels-expansion.md) | ready to execute | League stats + dashboard expansion + shared primitives + date filter + skeletons + charts + i18n sweep |
| **11a** | phase-11a-payments-mollie-stripe.md | not written (parked) | main spec §11 (Mollie, Stripe) — credit purchase flow, webhooks, ECB rates, VAT |
| **11b** | phase-11b-payments-bitcoin.md | not written (parked) | main spec §11 (Strike/Lightning) — Bitcoin credit purchase |

## Specs

| Spec | Path | Covers |
|---|---|---|
| Main design | [specs/2026-04-16-dice-vault-design.md](../specs/2026-04-16-dice-vault-design.md) | Full app architecture, all phases |
| Group & social features | [specs/2026-04-17-group-social-features-design.md](../specs/2026-04-17-group-social-features-design.md) | Leagues, connections, VaultConnection, notifications |
| Credits & free mode | [specs/2026-04-17-credits-free-mode-design.md](../specs/2026-04-17-credits-free-mode-design.md) | Credit pools, free mode toggle, free periods, analytics |
| Support tickets | [specs/2026-04-17-support-tickets-design.md](../specs/2026-04-17-support-tickets-design.md) | Ticket system, admin management, auto-close |
| Session participants & win ratio | [specs/2026-04-21-session-participants-winratio-design.md](../specs/2026-04-21-session-participants-winratio-design.md) | Phase 5 — participant selection, win ratio |
| Integrations | [specs/2026-04-22-integrations-design.md](../specs/2026-04-22-integrations-design.md) | Phase 7 — Integration model, encryption, Mailgun UI |
| Dashboard redesign | [specs/2026-04-22-dashboard-redesign.md](../specs/2026-04-22-dashboard-redesign.md) | 2×2 ranked-list panels, paginated games table, Redis cache |
| Stats panels expansion | [specs/2026-04-23-stats-panels-expansion-design.md](../specs/2026-04-23-stats-panels-expansion-design.md) | League stats + dashboard expansion + shared primitives + date filter + skeletons + animations + charts + i18n sweep |
| Log form — win types | [specs/2026-04-23-log-form-win-types-design.md](../specs/2026-04-23-log-form-win-types-design.md) | Adaptive log form per winType + isWinner flag + schema + display + stats |

## Archived plans

| File | Reason |
|---|---|
| [ARCHIVED-group-social-features.md](ARCHIVED-group-social-features.md) | Superseded by per-phase plans (2, 3, 4) |

## Rules

- Write each plan **just before executing it** — avoids stale plans
- One plan per phase — pull from all relevant specs
- Update status in this file as phases progress
- Never push mid-phase — single push at end of each phase (see main spec §17)
