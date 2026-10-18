# Script the Gridiron — Fixes in this build

## Fixes

- **Playoff week regression:** postseason game launch now passes the canonical week for the matchup's round (Wild Card 19, Divisional 20, Conference Championship 21, Super Bowl 22), rather than trusting potentially stale season state.
- **Safe playoff save synchronization:** finishing a postseason game derives the minimum valid week/stage from the playoff round, finds the correct bracket matchup by team IDs even when round labels vary, and keeps the current week from moving backward. Completing the Super Bowl moves the season to week 23 / offseason.
- **No stale player target across possessions:** offensive target selections are validated against the current offense's eligible roster before play resolution. Invalid/stale targets are cleared, so a player who scored for the user's team cannot be reused by the opposing offense unless that player is actually on its roster.
- **Current franchise roster targeting:** player target lookup prefers the roster attached to the active team object, including franchise roster changes, instead of only relying on static default rosters.
- **Duplicate regular-season result protection:** repeated finish callbacks no longer add the same game's result to standings twice.
- **Super Bowl history protection:** duplicate finish callbacks won't add multiple Super Bowl history entries for the same season.
- **Small cleanup:** removed a duplicate `origin` property in the season celebration confetti options.

## Validation

- TypeScript/TSX syntax transpilation passed for all modified source files.
- A full TypeScript typecheck / Vite production build could not be completed in this environment because dependencies were not installed and npm registry access/cache was unavailable. Run `npm install` and then `npm run lint` and `npm run build` locally to complete those checks.

## Important note

The original project files are included; this patch does not include `node_modules` or alter any hosted Firebase configuration/secrets.
