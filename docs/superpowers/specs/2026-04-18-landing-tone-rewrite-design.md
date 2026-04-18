# Landing Page Tone Rewrite — Design Spec
**Date:** 2026-04-18

## Problem

The landing page copy reads like a fintech/SaaS product — "store your scores safely", "permanent archive", "simple, transparent, fair", "no hidden costs". Dice Vault is a playful board game scoreboard with gamification. The tone must match.

## Goal

Rewrite all landing page copy sitewide to be warm, witty, and game-night-native — without sacrificing clarity or information density.

## Tone Guidelines

- **Voice:** Game Night Narrator — lively, a little cheeky, clear. Like a cool friend who keeps score.
- **Audience:** Both casual friend groups and competitive hobby gamers.
- **Vault:** Used naturally as a casual shorthand for "your scoreboard" — not a security product. Let the game night context do the work.
- **Avoid:** Fintech/SaaS language (transparent, archive, safely, no hidden costs), generic CTAs (get started, everything you need).

## Approved Copy Changes

### Hero
| | Before | After |
|---|---|---|
| Badge | "Free to use" | "Free to play" |
| Headline | "Store your scores safely." | "Remember who actually won." |
| Sub | "Log every game night, track player statistics, and build a permanent archive for your group. Your vault, your data." | "Log every game night, track stats, and settle debates once and for all. Your group's scoreboard, all in one vault." |
| CTA secondary | "Explore features" | "See how it works" |

### Features
| | Before | After |
|---|---|---|
| Overline | "Features" | "What's in the vault" |
| Headline | "Everything you need" | "All the tools, none of the spreadsheets" |
| Score logging desc | "Log scores per player and session. Simple, fast, and always available." | "Log every session in seconds. Who played, who won, and by how much." |
| Statistics desc | "See who wins most often, achieves the highest scores, and plays the most sessions." | "Win rates, high scores, most sessions played. The numbers don't lie." |
| Permanent archive title | "Permanent archive" | "Game history" |
| Permanent archive desc | "Your game history is always preserved. No data lost, no more arguments about who won." | "Every session, forever. Finally settle that argument about who's been on a losing streak." |

### How It Works
| | Before | After |
|---|---|---|
| Headline | "Your vault, your rules." | "Up and running before the first dice roll." |
| Sub | "Four building blocks. Five minutes to set up. A lifetime of game history." | "Four simple pieces. Five minutes to set up. A whole season of bragging rights." |
| Vault step title | "Your private vault" | "Your Vault" |
| Vault step desc | "Every account is a vault — your personal scoreboard that only you manage..." | "Your personal scoreboard. You manage the players, the games, and the history. Nobody else touches it." |
| Players step title | "Players in your group" | "Your crew" |
| Players step desc | "Add everyone in your group as a player..." | "Add everyone who shows up. Link them to their own Dice Vault account and they'll see their stats automatically — no sharing logins, no fuss." |
| Leagues step desc | unchanged title | "Turn any game into a season. Track standings, wins, and history across sessions. Great for long-running rivalries." |

### Group Features
| | Before | After |
|---|---|---|
| Overline | "Group features" | "Built for groups" |
| Headline | "Play together, win together." | "More fun with your crew." |
| Sub | "Dice Vault is built for regular game groups. Connect players, run leagues, and keep everyone sharp." | "Dice Vault works best when everyone's in on it. Connect your players, run a league, keep the rivalry alive." |
| Leagues desc | "Create a league for your favourite game. Rankings, statistics, and history — all tracked per season." | "Crown a champion. Run a season for any game — standings, stats, and history tracked automatically." |
| Connected players desc | "Invite other Dice Vault users as players in your vault. They see their own scores and statistics instantly in their own account." | "Link your friends' accounts and they'll see their own stats the moment you log a session. No login sharing needed." |
| Shared results desc | "Send a public link to any session result. No account needed to view — just share the link." | "Brag a little. Share any session result as a public link — no account needed to view it." |
| Notifications desc | "Get notified when someone submits a session, sends a connection request, or invites you to a league." | "Stay in the loop. Get notified when sessions are logged, invites arrive, or the leaderboard shifts." |
| CTA | "Start with your group" | "Get your group started" |

### Credits
| | Before | After |
|---|---|---|
| Headline | "Simple, transparent, fair." | "Pay for what you use. Nothing else." |
| Sub | "No hidden costs. Every action costs a fixed number of credits — you always see what you spend." | "Every action costs a fixed number of credits. No surprises, no subscriptions." |
| Free badge | "Every month, free" | "Every month, on us" |
| Free desc | "You receive 75 free credits every month automatically. Enough for an active game group." | "75 free credits land in your vault every month. Enough for a busy game group." |
| Example title | "What can you do with 75 credits?" | "What fits in 75 credits?" |
| Example note | "Credits never expire. Unused credits carry over." | "Credits never expire. They stack up — so go ahead and take a week off." |

### Packs
| | Before | After |
|---|---|---|
| Overline | "Extra credits" | "Need more fuel?" |
| Headline | "Need more? Buy once." | "Top up when you're ready." |
| Sub | "No subscription. Credits never expire. Pay only when you need more." | "No subscription. Credits never expire. Buy once, play on." |
| CTA | "Sign up and buy credits" | "Start free, top up later" |

### Reviews
| | Before | After |
|---|---|---|
| Overline | "What others say" | "From the leaderboard" |
| Headline | "Loved by players" | "Players who stopped using spreadsheets" |
| Review 1 | "Finally an app that takes board game score tracking seriously. The league feature is great — our group now plays with a real ranking." | "Finally we know who actually wins at Catan. The league feature turned our game nights into a proper season." |
| Review 2 | "No more arguments about who won. Everything is recorded, and my friends see their own scores immediately." | "No more 'I think I won last time.' It's all there. My friends see their own scores the second I log a session." |
| Review 3 | "Simple, fast, and does exactly what you'd expect. Our group uses it every week and the statistics are great." | "Takes 30 seconds to log and we've been using it every week for months. The stats are weirdly addictive." |

### Final CTA
| | Before | After |
|---|---|---|
| Headline | "Ready to get started?" | "Your next game night starts here." |
| Body | "Create a free account and start tracking your scores today. No credit card required." | "Free to join. No credit card needed. Just bring the dice." |
| Button | "Create a free account" | "Create your free vault" |

### Footer
| | Before | After |
|---|---|---|
| Tagline | "Your game history, safely stored." | "Every game night, remembered." |

## Scope

- Update `messages/en/landing.json`
- Update `messages/nl/landing.json` (same tone shift, Dutch equivalent)
- No structural changes to `page.tsx`
