# Doge Hunt Task Log

This document records all development tasks and progress for the Doge Hunt project.

## Current Task

| Date | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 2026-08-30 | Improve mobile Waiting Room readiness hint legibility | Ready for mobile Preview | Codex | Increased only the mobile Waiting Room's shared host/player preparation-state hint from 16 to 18px and raised its minimum line height from 28 to 32px. This covers `Press Ready and wait for host to start game`, Host-ready/waiting text, solo guidance, and the start countdown, while desktop remains 14px and the rest of the modal is unchanged. TypeScript and targeted diff checks pass. |
| 2026-08-30 | Shorten authoritative match-start countdown | Ready for desktop/mobile Preview | Codex | Changed the server-owned waiting-room match-start countdown from 5 seconds to 3 seconds. Desktop and mobile continue to render `startCountdownSeconds` from the same authoritative room snapshot; Ready, Cancel, solo/party checks, and match start behavior are unchanged. TypeScript and targeted diff checks pass. Preview one party start and confirm the shared UI shows 3, 2, 1 before entering the match. |
| 2026-08-30 | Align real-player BONK acquisition with proven NPC envelope | Ready for two-client Preview | Codex | Two-client Preview showed both platforms could BONK NPCs, mobile reached real players only at very close range, and desktop could not reliably acquire real players even nearby. Audit found real-player BONK had an extra mandatory camera-ray acquisition gate while NPCs used the body-forward attack envelope. Ray selection remains the precise first choice; after a ray miss, the client now selects the nearest active remote player inside the exact same platform-specific body-forward envelope used for NPC candidates and submits that explicit player ID plus body-forward aim to the authoritative server. The server still validates that exact player against its observed Transform and never substitutes another target. NPC behavior and all server envelope values are unchanged: desktop player/NPC `3.95m / 2.70m`; mobile player/NPC `2.77m / 1.89m` via the existing `0.70` scale. Swing logs identify `source=ray` or `source=attack-envelope`. TypeScript, SDK build, and targeted diff checks pass. Preview desktop -> mobile, mobile -> desktop, and desktop -> desktop at ordinary NPC-comparable distances; verify one accepted and one out-of-range rejection per platform. |
| 2026-08-30 | Restore desktop real-player BONK target acquisition | Ready for two-client Preview | Codex | Replaced the target ray's first-hit-only query with an all-hit query. It now sorts hits by distance, selects the nearest active remote-player pointer hitbox, ignores unrelated pointer-only NPC/UI colliders, and still rejects a player target behind a closer physical scene collider. Added one swing-time `[Client][RayBonk] target-acquire` log showing selected player, physical obstruction, or no player hit. NPC candidate selection, desktop/mobile hit envelopes, server validation, and outcome synchronization are unchanged. `npx tsc --noEmit`, SDK build, and targeted diff check pass. Preview desktop -> mobile-player BONK first, then desktop -> desktop and mobile -> desktop; confirm the request prints an aimed player and the server result is accepted only in range. |
| 2026-08-30 | Raise in-game background music level | Ready for desktop/mobile Preview | Codex | Increased global game BGM from 0.38 to 0.70 while preserving BONK feedback at 1.0. `npx tsc --noEmit` and targeted diff check pass. Confirm music is clearly audible but BONK remains distinct on both clients. |
| 2026-08-30 | Clarify Ready and countdown-cancel actions | Ready for desktop/mobile Preview | Codex | The explicit waiting-room preparation action is now `I'M READY`. During the server-owned five-second start countdown, `LEAVE` becomes `CANCEL`; clicking it leaves the waiting room and returns the client to the lobby, cancelling the shared countdown through the existing server leave path. `npx tsc --noEmit` and targeted diff check pass. Preview a ready action, then start a countdown and cancel it on desktop and mobile. |
| 2026-08-30 | Repair Creator Hub authoritative-server launcher workaround | Ready for Creator Hub Preview restart | Codex | Preview normal scene server was listening on port 8000 but had no Hammurabi child. Existing project-local patch markers were present, but Creator Hub runs sdk-commands through `resources/node-bin/node.exe`, where `isElectronEnvironment()` is false, so the previous fallback retained Creator Hub's virtual npx path and `npm exec @dcl/hammurabi-server@next --realm=http://localhost:8000` exited 0 without a server. The guarded postinstall patch now detects Creator Hub node-bin, selects a regular Node executable, and pairs it with that Node installation's real `npx-cli.js` rather than the virtual app.asar path. Applied to current sdk-commands. An isolated invocation through the actual Creator Hub Node started Hammurabi, loaded Doge Hunt server entry/lobby/heartbeat/leaderboard, connected to the Preview LiveKit room, then auto-stopped after 10 seconds. Script syntax, idempotent re-run, `npx tsc --noEmit`, and targeted diff check pass. Existing Preview has the old launcher in memory: stop and start Preview once, then confirm `[Server] Doge Hunt authoritative server entry loaded.` in server logs. |
| 2026-08-30 | Improve room start clarity, BONK reliability, music, and elimination feedback | Ready for desktop/mobile Preview | Codex | Every waiting-room player now joins unready; each must explicitly READY before a party start. The host sees `PLAY SOLO` when alone and `START MATCH` only after at least two players are ready, followed by a server-owned five-second countdown that cancels if a player leaves. The existing compact mobile room/results composition is retained. Desktop/mobile BONK envelopes are now 3.95m forward and 2.70m lateral before the established mobile 0.70 scale (mobile effective 2.77m/1.89m), synchronized in client NPC selection and authoritative server validation; client/server audit logs retain aimed target, platform, range, radius, and rejection. Music is primed from join/ready/start user actions before the asynchronous server start, with `[Audio]` lifecycle logs. Immediate and final elimination feedback now names the BONKing player. `npx tsc --noEmit`, SDK build, and targeted diff check pass. Preview with two clients: Ready/solo/countdown/cancel, BGM, in-range/out-of-range BONK on both platforms, and both immediate/final death attribution. |
| 2026-08-26 | Align local Doge orientation and BONK presentation timing | Ready for desktop/mobile Preview | Codex | The local Doge now copies the DCL player rotation every frame, removing the former 240-degree-per-second visual yaw lag while preserving the existing direct position follow. Preview showed that reducing the BONK lifecycle to 0.46 seconds cut off the Explorer-visible GLB action, so the local movement lock and remote-proxy presentation are restored to the proven 1.02-second lifecycle. The 2.25x clip speed, 0.18-second server-request impact frame, and every server-authoritative targeting, hit, score, and elimination rule remain unchanged. TypeScript, SDK build, and targeted diff check pass. Preview fast turns, complete BONK visual playback, and a second client observing the action. |
| 2026-08-26 | Make BONK target selection ray-driven across desktop and mobile | Ready for two-client desktop/mobile Preview | Codex | Replaced ambiguous nearest-player selection with a pointer-only invisible hitbox per active remote player proxy. Desktop uses its cursor/camera ray; mobile falls back to the camera-centre ray when touch has no pointer direction. A swing freezes `aimedPlayerPublicDogeId` and aim yaw, while NPC candidate selection remains on the original body-forward path. If an aimed player is present, the authoritative server validates only that exact active player against its observed Transform and the existing platform range/radius; it now rejects instead of substituting another nearby player. Hitboxes have no physics collision and are disabled for hidden/eliminated proxies. Existing action broadcast, accepted-result elimination, score, rank, and spectator synchronization paths are unchanged. TypeScript, SDK build, and targeted diff check passed. Preview: desktop/desktop, mobile/desktop, and mobile/mobile adjacent-player aim; capture `[Client][RayBonk]` and `[Server][RayBonk]` for one accepted and rejected target. |
| 2026-08-24 | Prevent NPCs from grounding on high environment colliders | Ready for desktop/mobile Preview | Codex | Diagnosed flying NPCs as the downward NPC ground ray accepting any `CL_PHYSICS` hit from `MoonLobby1`, including high decorative colliders such as `Starlight_Collider` and `1_Collider`. Grounding now accepts only hits in the arena floor band (`-1m` to `1.25m`) and otherwise resets to baseline `y=0`, including missing ray results. This preserves authoritative XZ pathing, animation, and BONK validation while preventing high decorative geometry from becoming ground. TypeScript and `git diff --check` passed. Preview a full NPC round on desktop/mobile, especially the arena edge and neon structure areas. |
| 2026-08-23 | Retry Creator Hub package validation file locks | Ready for Creator Hub Preview | Codex | Creator Hub log proved Preview was blocked by Windows `UNKNOWN/-4094` reads of `package.json` and its fallback `npm install` then failed opening `package-lock.json`; scene bundling and type checking had already succeeded. Extended the existing project-local postinstall patch so `sdk-commands` retries only Windows `UNKNOWN`/`EBUSY`/`EPERM` errors in the start-validation path for up to 4.5 seconds. Non-lock validation errors still surface normally. Confirmed the patch is present in `project-validations.js`; TypeScript and SDK build pass. Restart Preview once to load the patched command module. |
| 2026-08-23 | Add BONK runtime version diagnostics | Ready for mobile Preview | Codex | Client BONK-send logs include `platform`. Every server-confirmed BONK response now echoes the server's applied platform/range/radius, and the mobile client prints it for both accepted and rejected results. This removes the need for access to the authoritative-server terminal: expected result at the current `0.70` scale is `serverPlatform=mobile serverRange=2.52 serverRadius=1.72`; `serverEnvelope=unavailable` means the connected server is still an older build. |
| 2026-08-23 | Add admin NPC freeze toggle | Ready for desktop/mobile Preview | Codex | Added an admin-only `FREEZE NPCs` / `RESUME NPCs` toggle. The authoritative server records the freeze timestamp, keeps the round timer running, and broadcasts frozen NPC transforms plus idle actions; clients stop extrapolating the NPC timeline while frozen, so all participants see the same stationary NPCs. BONK validation uses that same frozen server pose, allowing hit-range testing. Unauthorized, missing-match, and ended-match requests are rejected with structured logs. TypeScript and targeted `git diff --check` passed. Verify freeze, cross-client stationary state, BONK while frozen, resume continuity, and that non-admins never see the button. |
| 2026-08-23 | Tune mobile BONK hit envelope | Ready for mobile Preview | Codex | Mobile BONK requests identify `platform=mobile`; the authoritative server now applies a `0.70` scale to NPC and real-player range/radius validation, while desktop remains unchanged. Mobile local NPC candidate selection uses the same `0.70` scale. Effective mobile envelope: 2.52m forward range and 1.72m lateral radius. After a genuine Preview server restart, mobile `bonkResult` must print `serverPlatform=mobile serverRange=2.52 serverRadius=1.72`; `serverEnvelope=unavailable` means the active server is old. TypeScript and targeted `git diff --check` passed. |
| 2026-08-23 | Suppress mobile Round Over HUD flash | Ready for mobile Preview | Codex | Mobile now removes the top game-timer layer as soon as the authoritative round-over state arrives, preventing the transient blue `ROUND OVER` banner before the results overlay takes over. Desktop HUD and shared results content are unchanged. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Label Waiting Room ranks and result Bonks | Ready for desktop/mobile Preview | Codex | Waiting Room rows now show global `#1`, `#2`, etc., continuing across pages. Results show `N Bonks` on mobile and desktop; mobile reallocates the row to rank 7%, name 34%, Bonks 23%, reticle gutter 7%, status 29%, so the new label does not crowd adjacent text. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Apply short-screen budgeting to Waiting Room | Ready for desktop/mobile Preview | Codex | Waiting Room now reuses the mobile canvas-height 4/3/2 row budget and keeps the mobile pager visible even for a single page, preserving disabled left/right arrows and `Page 1/1`. Desktop still shows the pager only when multiple pages exist. Removed the unused Decoy result summary. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Harden result layout for short screens | Ready for desktop/mobile Preview | Codex | Result panels are now content-driven rather than fixed-height; Return to Lobby participates in normal vertical flow, so it cannot cover the list. The shared normal/spectator mobile layout reads `UiCanvasInformation`: normal height shows 4 rows, short height 3, and very short height 2 while hiding award/Decoy summary. Empty placeholder rows were removed, fallback details follow the same row budget, and player names are single-line clipped. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Keep real avatars hidden on results screen | Ready for desktop/mobile Preview | Codex | Removed avatar visibility release from `showGameOverUI()` so the active-match avatar modifier remains through the results screen. Real Decentraland avatars should only return after `RETURN TO LOBBY` runs `cleanupGame()` / `cleanupPlayerDisguise()`. TypeScript, SDK build, targeted diff checks, and release-call scan passed. |
| 2026-08-23 | Align desktop gameplay hint with Rock control | Ready for desktop Preview | Codex | Matched the hint card's lower edge to the desktop Rock action group's lower edge using the same `es(18)` HUD bottom offset. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Add desktop gameplay hint card | Ready for desktop Preview | Codex | Added a bottom-right desktop-only black translucent hint panel with `Click and Bonk Doges.` and `Use "Rock" skill to hide.` Mobile HUD remains unchanged. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Let any admin clear NPCs during an active match | Ready for admin Preview | Codex | Replaced Kill All's per-NPC ordinary BONK requests with one `debugEliminateAllRequest` server command. The server accepts it solely from the shared admin allowlist during an active matching `matchId`; it no longer requires a host role, room-player record, active-player status, local NPC entity, player Transform, or BONK pose. It clears only the decoy segment of the authoritative public-Doge array, never real player Doges, and does not award BONK score to the operator. In a solo match it preserves the existing all-NPC-clear result rule for the actual active player. The response is returned directly to the requesting admin for diagnostics. TypeScript, SDK bundle/typecheck, and targeted diff checks passed. Preview as an admin host, active non-host, eliminated spectator, and external spectator; confirm a non-admin receives `unauthorized`. |
| 2026-08-23 | Restore synchronized NPC Bonk and Jump actions | Ready for desktop/mobile Preview | Codex | Removed the authoritative branch's forced-Walk behavior. Each NPC now follows a deterministic three-second action cycle derived from its public Doge ID and server elapsed time, with desynchronized Bonk, Jump, Idle, Run, and Walk choices. Bonk/Idle pause authoritative travel, Jump/Walk move at normal speed, and Run accelerates; route position, animation, server hit validation, and all clients therefore use the same action timing instead of independent local randomness. Bonk and Jump are selected frequently enough to remain visible across a normal NPC group without making every NPC switch together. TypeScript, SDK bundle/typecheck, and targeted diff checks passed. Verify mixed actions, smooth transitions, two-client agreement, and moving-NPC hits on desktop/mobile Preview. |
| 2026-08-23 | Remove final reveal and winner lines from results | Ready for desktop/mobile Preview | Codex | Removed the shared `FINAL REVEAL` and `Winner` labels from both normal and spectator result layouts on desktop and mobile. TypeScript, SDK build, targeted diff check, and source scan passed. |
| 2026-08-23 | Simplify desktop and mobile results content | Ready for desktop/mobile Preview | Codex | Removed `You Win`/`You Lose` and the `Reason` line from the results overlay. Winner text now contains only the winner name, with no `as Doge 1`; fallback reveal lines also omit player and decoy Doge labels while retaining statuses and decoy count. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Disable player Doge visual collisions | Ready for two-client Preview | Codex | Made local player Doge, remote player Doge proxies, and remote Rock proxies presentation-only by forcing their GLB visible/invisible collision masks to `CL_NONE` at creation and after model swaps. This targets player-to-player sticking/dragging caused by visual shells overlapping. Authoritative BONK validation, NPC pointer hitboxes, and arena colliders are unchanged. TypeScript, SDK build, and targeted diff checks passed. |
| 2026-08-23 | Point mobile models to cache-busting v2 assets | Ready for mobile Preview | Codex | Updated all mobile-only GLB paths to the newly renamed `MoonLobby1Mobile2.glb`, `MuscledogeMobile2.glb`, and `roblox_doge_hat_Mobile2.glb` assets so mobile Preview does not reuse cached old model URLs. Desktop model paths remain unchanged. TypeScript, SDK build, and targeted diff checks passed. |
| 2026-08-23 | Align spectator text and outline layer | Ready for desktop/mobile Preview | Codex | Grouped the blue `SPECTATOR MODE` label and all outline layers inside one fixed 34px label layer, so the outline follows the text when the return button is positioned below it. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Place spectator return action beside watcher indicator | Ready for desktop/mobile Preview | Codex | Moved `RETURN TO LOBBY` into the same bottom-center watcher container as the blue `SPECTATOR MODE` text. The status remains above the button, and the previous hidden/duplicated HUD-panel action was removed. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Add spectator return action and remove result Doge labels | Ready for desktop/mobile Preview | Codex | Added `RETURN TO LOBBY` beside the spectator status in the HUD; it calls the normal lobby cleanup path and falls back to a server leave request. Removed the unused `Doge 1`/doge-label field from mobile and desktop result rows. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Align NPC presentation and authoritative BONK validation | Ready for mobile Preview retest | Codex | Fixed two regressions introduced by the first NPC spatial-validation pass. Normal BONKs now use the impact-frame client yaw even when mobile avatar rotation differs from the server-observed yaw; the server still owns the attacker origin (client origin accepted only within 2.25m), target position, forward range/radius, elimination, and score. Large yaw divergence is logged for audit instead of replacing the visible attack direction with stale server rotation. Kill All requests now carry an explicit `debug-eliminate-all` source; only a server-verified admin address may bypass NPC spatial validation, and the bypass cannot select player Doges. Legacy requests without a source normalize to ordinary attacks. Continuous NPC trajectory prediction and the original BONK movement lock remain unchanged. TypeScript, SDK bundle/typecheck, and targeted diff checks passed. Retest mobile NPC hits from center/edge of the visible arc, ordinary misses behind/out of range, and admin/non-admin Kill All behavior. |
| 2026-08-23 | Fix desktop Waiting Room dynamic panel and actions | Ready for desktop Preview | Codex | Desktop Waiting Room now uses an auto-height dark panel with a 340px minimum, matching its dynamic player list. Start and Leave are equal `48%` by `58px` buttons in a full-width row with an 8px gap, eliminating the prior overlap. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Remove local Waiting Room UI preview | Complete | Codex | Removed the temporary `UI PREVIEW: 8 PLAYERS` button, mock rows, and preview-only action branches at the user's request. Waiting Room presentation now reads authoritative server snapshots only. TypeScript, SDK build, and targeted `git diff --check` passed. |
| 2026-08-23 | Fix mobile Waiting Room visual hierarchy | Ready for mobile Preview | Codex | Mobile Waiting Room now has a separate 52px title block with a 12px roster gap, sizes its roster and panel to actual players instead of four reserved blank rows, and hides the single-page pager. The in-world `DOGE HUNT / Open Room / Room ready` label is hidden while the Waiting Room is open and restores after leaving. TypeScript, SDK build, and targeted `git diff --check` passed. Preview should verify one-player, four-player, and second-page rooms in mobile landscape. |
| 2026-08-23 | Add third admin wallet and mobile admin diagnostics | Ready for mobile Preview | Codex | Added `0x9B3ae2dD9EAAD174cF5700420D4861A5a73a2d2A` to the shared admin allowlist. Mobile admin detection now checks both `PlayerIdentityData.address` and `getPlayer().userId` without discarding `userId` just because mobile marks the profile as guest during identity fallback. Added one-per-change `[Admin]` diagnostic logs showing mobile/admin/source/address/guest so mobile Preview can verify the exact source. TypeScript, SDK build, and targeted diff checks passed. |
| 2026-08-22 | Gate desktop debug controls behind admin wallet | Ready for desktop Preview | Codex | Applied the mobile admin-only debug UI rule to desktop: debug buttons now render only when `canUseAdminControls` is true on all platforms. Admin desktop layout and behavior are unchanged; non-admin desktop players should no longer see debug controls. TypeScript, SDK build, and targeted diff checks passed. |
| 2026-08-22 | Auto-ready server waiting-room players | Ready for Preview | Codex | New players enter the authoritative waiting room ready by default. Non-host players can toggle between `UNREADY` and `READY`; host remains implicitly ready and retains Start gating. TypeScript, SDK build, and `git diff --check` passed. Preview should verify join, auto-ready snapshot, unready/re-ready toggle, and host Start gating. |
| 2026-08-22 | Hide non-participant avatars scene-wide during active match | Ready for desktop/mobile Preview | Codex | Expanded the active-match AvatarModifierArea from the arena-only `92 x 8 x 92` volume to a scene-wide `110 x 40 x 110` volume centered at `(48, 10, 48)`, preserving hide-avatar, hide-name-tag, and disable-passport modifiers. This should hide non-participant default avatars on desktop and mobile during gameplay while existing release logic restores visibility on results/lobby. TypeScript, SDK build, and targeted diff checks passed. Verify with one active player plus one non-participant in scene. |
| 2026-08-23 | Narrow mobile pages and harden text layout | Ready for mobile Preview | Codex | Restored the original How to Play (`320`) and gameplay feedback (`300`) widths. The requested 20% narrowing remains limited to Room Entry, Waiting Room, Results, Leaderboard Rules, and Elimination pages. Guest wallet-prefix names and text-overlap protections remain. TypeScript, SDK build, and `git diff --check` passed. |
| 2026-08-22 | Decouple Rock and BONK from native E/F actions | Ready for mobile Preview | Codex | Removed Rock/BONK gameplay bindings from Explorer Primary/Secondary actions and removed the image-button `uiInputBinding` hooks. Mobile Rock/BONK now trigger only through the scene-owned custom image buttons via direct click handlers; desktop pointer Bonk and desktop Rock button remain. TypeScript and SDK build passed; verify E/F no longer trigger skills in mobile Preview. |
| 2026-08-22 | Improve BONK responsiveness and position consistency | Ready for two-client Preview | Codex | Restored the original 1.02-second BONK movement/input lock at the user's request: triggering BONK stops movement until the attack animation finishes. Retained the reliability fixes: BONK requests include impact-frame yaw; the authoritative server accepts client attack origin/yaw only within a 2.25m and 70-degree envelope around its observed Transform, otherwise falling back to server pose. Target position, attack arc, elimination, and score remain server-owned. Remote Doge proxies follow high-frequency replicated peer Transforms every frame with fast smoothing instead of waiting for the 5Hz public snapshot version and adding another 0.2-second delay; server pose remains the fallback. Required acceptance: two moving players initiate BONK, confirm immediate stop, compare visible proxy and hit position, test misses outside the arc, and repeat on mobile. |
| 2026-08-22 | Stack mobile Rock and BONK controls | Ready for mobile Preview | Codex | Mobile skill controls are vertically stacked (BONK above Rock). Shifted the complete group 20px down from the earlier baseline and 130px right from center, with BONK 30px right relative to the Rock axis. Desktop layout and Explorer-native controls remain unchanged. TypeScript, SDK build, and targeted diff checks passed. |
| 2026-08-22 | Replace mobile native action slots with bound Rock and BONK UI | Confirmed Explorer limitation | Codex | User review proved the native slot configuration did not render as intended: default Jump plus all four surrounding buttons remained, while scene Rock/BONK were suppressed. Source inspection confirmed the hide list includes every SDK-defined native gamepad action except Jump, so this was not an omitted action enum. The SDK helper sequence (`showAll`, `setMainAction`, `hide`) wrote the expected RootEntity payload during a real active match (`main=8`, hidden `0,1,2,10,11,12,13`). A follow-up timing-isolation probe applied the same payload immediately on scene entry, including lobby; the buttons still remained. Therefore the current mobile Explorer Preview ignores this `TouchScreenControls` hide configuration. Reverted the temporary lobby-wide probe; game-only scope is retained for a future Explorer that honors the capability. Do not spend further scene-side iterations on native-button hiding. |
| 2026-08-22 | Restore Creator Hub authoritative-server spawn path | Ready for Creator Hub Preview | Codex | User confirmed Preview loads, but Hub logs showed `Starting Multiplayer Server` immediately followed by `Failed to start Multiplayer Server: spawn EINVAL`; process inspection confirmed only sdk-commands and TypeScript watch children, with no Hammurabi process. This is independent from the repaired `main.crdt` build-lock retry. Applied TAO Quest's guarded project-local lookup pattern to `utils.js`, adding Creator Hub's `resources/app.asar.unpacked/node_modules/npm/bin/npx-cli.js` as a direct candidate for the `node-bin/node.exe` launcher. Exact Creator Hub Node verification now resolves that file rather than `NULL`. A full no-client run with that exact Hub Node passed bundle/typecheck, started port `8000`, then loaded `[Server] Doge Hunt authoritative server entry`, lobby handlers, Storage leaderboard, `Server running`, LiveKit connect, and first server heartbeat. The temporary verifier was stopped and port `8000` is free. Final acceptance: click Preview in Creator Hub and confirm the same server-entry sequence without `spawn EINVAL`. |
| 2026-08-22 | Make Creator Hub composite build resilient to Windows file locks | Ready for Creator Hub Preview | Codex | Creator Hub local log identified the hidden failure as `composite-loader` failing on generated `main.crdt` with Windows `UNKNOWN/-4094`; its automatic follow-up `npm install` then separately failed on `package-lock.json`. Added a persistent postinstall patch that retries only retryable CRDT write errors (`UNKNOWN`, `EBUSY`, `EPERM`) for up to 2.7 seconds. Exact Hub start command `sdk-commands start --explorer-alpha --hub --skip-auth-screen` then completed bundle, started Preview on `8000`, launched the multiplayer server, loaded `[Server] Doge Hunt authoritative server entry`, registered lobby handlers, and reached `Server running` without either file-lock error. Fault-injection verification then held `main.crdt` with a Windows exclusive lock for 2.2 seconds while `sdk-commands build` ran; bundling and type checking completed without the historical `UNKNOWN` failure. The diagnostic shell's comms gatekeeper access remains restricted by its execution environment, so Creator Hub still needs normal internet connectivity for LiveKit acceptance. |
| 2026-08-22 | Clear stale Creator Hub validation state | Ready for Preview | Codex | Creator Hub showed the generic build-error dialog while the project independently completed `sdk-commands build` through bundling and type checking. The active Hub state contained five stale Creator Hub processes but no active Preview/server process. Cleared only those Hub processes, confirmed Preview ports were free, then reopened Creator Hub cleanly. This is a Hub watcher/validation-state issue, not a scene-source build failure. Required acceptance: click Preview in the newly opened Hub; capture the exact terminal output only if it fails again. |
| 2026-08-22 | Repair authoritative server startup cache path | Ready for Creator Hub Preview | Codex | Completed the Windows launcher workaround by moving only Hammurabi's `npx` cache to project-local `.dcl-npm-cache`; the patch remains postinstall/idempotent. Direct full Preview verification started `http://localhost:8000`, downloaded `@dcl/hammurabi-server` into that cache, launched the authoritative runtime, logged `[Server] Doge Hunt authoritative server entry loaded`, registered `[Server][P]` room handlers, and reached `Server running`. `POST /content/entities/active` returned `200`. The diagnostic CLI's own comms handshake was blocked by its restricted execution environment and entered offline mode, so the remaining acceptance is Creator Hub Preview with normal desktop networking: it must show the same server-entry logs plus LiveKit connect, not an npm-cache or server-launch error. |
| 2026-08-22 | Upgrade authoritative SDK line for native mobile controls | Ready for Preview | Codex | Upgraded `@dcl/sdk`, `@dcl/js-runtime`, and `@dcl/sdk-commands` together from `7.24.3` to the shared `7.26.1-32239895147.commit-3c77d90` `@auth-server` build. Do not replace this line with ordinary `@latest`: Doge Hunt requires `isServer`, `registerMessages`, and `Storage`. Confirmed the installed ECS exports `TouchScreenControls`. TypeScript and `npm run build` pass. Creator Hub's generic Preview build error was traced to an inaccessible stale user-level npm installation shadowing Node's bundled npm, not scene source: moving that stale global npm directory to a dated backup restored ordinary `npm` (`10.9.2`) and the full build. The isolated direct Preview service also passed health checks and was stopped after testing. Source/config `git diff --check` passed with `node_modules` excluded because npm refreshed tracked third-party files containing upstream trailing whitespace. Required next acceptance: restart Creator Hub completely, then mobile Preview, desktop Preview, and a two-wallet authoritative flow before adding TouchScreenControls or claiming the upgrade is gameplay-safe. |
| 2026-08-22 | Restore Windows Creator Hub Multiplayer Server launcher workaround | Ready for Preview | Codex | Rechecked the previously validated Doge Hunt and TAO Quest workaround after the authoritative SDK upgrade. TAO's old npx path patch is now built into the installed `7.26.1` launcher, but Doge Hunt's existing guarded `scripts/patch-hammurabi-runtime.cjs` was not invoked by `postinstall`. Added that project-local `postinstall`, applied it to the current `sdk-commands` launcher, and verified idempotence plus all expected launcher fragments: Creator Hub now resolves bundled npx as usual but invokes Hammurabi with system Node, removing the Electron runtime/environment conflict. TypeScript and diff checks pass. A concurrent Creator Hub watcher locked `main.crdt` during the final build attempt; that is a known watcher race rather than a source failure, and the scene had already built successfully with this SDK revision. Required next acceptance: stop then start Preview once so the patched launcher loads. Success requires `Starting Multiplayer Server` followed by Hammurabi/server logs such as `[Server] Doge Hunt authoritative server entry loaded`, with neither `spawn EINVAL` nor a missing server entry. |
| 2026-08-22 | Use native mobile gamepad slots for Rock and BONK | Ready for Preview | Codex | During an active, actionable match only, preserve the Explorer joystick and Jump main button, hide unused action slots, and repurpose native Primary/Secondary as Rock/BONK using existing `Rock`, `Rockin`, and `Bonk` image assets. The mobile Secondary action now enters the same client request/server-confirmed BONK flow as desktop. Scene-drawn mobile skill buttons are suppressed in that state, preventing duplicate controls. Lobby, room UI, results, and spectator state remove `TouchScreenControls`, restoring the untouched Explorer defaults. TypeScript, SDK build, and diff checks pass. The native API cannot render Rock cooldown text over its own button, so this slice retains state-specific icons without an overlapping cooldown label. Required acceptance: mobile Preview active player, Rock/BONK, Rockin visual, spectator/default restoration, and desktop regression. |
| 2026-08-13 | Protect mobile waiting-room and results overlays from Explorer controls | Ready for Preview | Codex | Mobile room entry, Waiting Room, and final-result overlays share a left-biased central modal frame (`65%` width, `62%` height, `left 7%`, `top 17%`) so the panels clear Explorer's top bars, left action control, and right movement controls while sitting lower in the usable screen area. Mobile typography is preserved. Both lists keep four fixed row slots per page and render empty placeholders when fewer players exist, preventing one-player screens from collapsing upward. Mobile pagination is always visible, including disabled `Page 1/1` solid-arrow PNG controls for rooms/results with four or fewer players. Waiting Room omits redundant host identity and room-version diagnostics, retaining only the actionable ready/start hint; mobile Start and Leave controls are taller for touch use. Results keep Return to Lobby fixed at the bottom and reserve a transparent center gutter so Explorer's immutable aiming reticle does not visually combine with the Bonks value. Desktop layout remains unchanged except for the removed redundant Waiting Room diagnostics. TypeScript and `git diff --check` passed; verify room entry, Waiting Room, and a final result in mobile Preview at the actual device aspect ratio. |
| 2026-08-07 | Active-match observer entry and remote-motion smoothing | Ready for Preview | Codex | A running game now exposes `Watch Game` through the Doge-head room entry. The authoritative server records up to 5 separate spectators, sends them a read-only match start payload, and excludes them from the 10 active seats, Doge identity allocation, gameplay actions, survival rules, and leaderboard settlement. Spectators receive the normal public NPC/player state stream, have their own Doge hidden, and keep an independent room heartbeat. The HUD hides Rock/Bonk, shows outlined `SPECTATOR MODE` at bottom-center, and only observer clients see cyan display-name labels above real-player proxies; NPCs remain unlabelled and active players remain anonymous. Observer results use neutral `ROUND FINISHED` / `Spectator view` copy and a `SPECTATOR` status rather than win/loss/eliminated language. Scene reload and mobile resume now request a personalized room snapshot rather than silently leaving; if the server still has the wallet in an active or settling match, it restores that member's match-start payload and current public snapshot. Recovery payloads are explicitly marked, so they rebuild the active presentation without calling the initial spawn teleport. The centered timer now includes an outlined `X REAL PLAYER(S) ALIVE` line from the authoritative public snapshot; debug controls are moved lower to avoid overlap. Remote proxies prefer the local runtime's higher-frequency replicated peer Transform for visual movement and only fall back to the server's public pose before that peer is available; the server remains authoritative for all gameplay. Once path movement has established a heading, they retain it while stationary; only later path displacement sets a new heading. Walk/run follows rendered motion. A spectator's hidden local Doge disables both physics and pointer collision masks, restoring them when spectator state ends. TypeScript/diff checks pending; verify scene reload and mobile lock/resume as both player and observer. |
| 2026-08-07 | Scale authoritative NPC count with active players | Ready for Preview | Codex | Multiplayer rounds now use `max(12, active players x 2)` total Doges, keeping the established 12-Doge experience through six players and guaranteeing at least one NPC per active player above that. Examples: 1 player = 11 NPCs, 2 = 10, 6 = 6, 10 = 10 (20 total). The server includes total Doges and NPC count in its start log for deployment diagnostics. TypeScript and diff checks pending. |
| 2026-08-07 | Spectator-mode product constraint | Planned | Codex | The first spectator implementation must cap spectators at 5. Spectators are separate from the 10 active-player seats, have no Doge identity, gameplay input, ranking, or points, and must not prevent an active match from being cancelled when every real player leaves. |
| 2026-08-07 | Paginate ten-player waiting-room and results lists | Ready for Preview | Codex | Replaced the temporary compact ten-player layout with fixed-density pagination. Waiting Room and final results now display four player rows per page and show left/right arrow controls plus `Page x/y` only when needed. Original row typography and modal sizes are preserved; result Return to Lobby remains anchored. Opening a waiting room or a new results screen resets to page one, while live membership changes clamp the page to a valid index. TypeScript and diff checks passed. |
| 2026-08-07 | Expand Doge Hunt rooms to ten active players | Ready for Preview | Codex | Raised both server and local-room capacity from 4 to 10 and added ten distinct ring spawn points facing the arena center. The authoritative dynamic NPC count is tracked separately in the latest task entry. Waiting-room and result pagination are tracked separately in the next task entry. TypeScript and diff checks passed; verify 1/10 and a two-client spawn first, then validate full capacity after deployment. |
| 2026-08-07 | Treat a scene reload as leaving the prior match | Ready for Preview | Codex | On each fresh scene runtime, after the authoritative room is ready, the client sends one `leaveRoom` with `reason=scene-reload` before any new room interaction. This removes stale same-wallet membership immediately rather than letting the reloaded client continue heartbeating an old active match. If it was the final real player, the server resets the room without settlement or leaderboard writes. TypeScript and diff checks passed; verify a reload returns the Doge head to `No room open` instead of `Game in progress`. |
| 2026-08-07 | Hide native avatar identity and prevent abandoned-match settlement | Ready for two-client Preview | Codex | The arena avatar modifier now hides native avatars and name tags on desktop and mobile, and applies the SDK-supported passport disable modifier so hovering/clicking a real avatar cannot open its profile during a round. Heartbeat timeouts now defer final-survivor settlement for 4 seconds and require the remaining player to still be heartbeating. If all real players have closed/reloaded and time out, the server resets the active match without results or leaderboard writes. TypeScript and diff checks passed; verify profile UI suppression and a two-client close/reload scenario. |
| 2026-08-07 | Prioritize player names and synchronize remote player proxy poses | Ready for two-client Preview | Codex | Waiting room and results now show Decentraland profile names first, using a short wallet address only when no valid name is available. Joining now prefers `getPlayer().name` before avatar-base fallback. To remove platform-dependent remote visibility, the authoritative server now includes each real player's observed Transform in public snapshots at 5Hz; remote proxies use this server pose first and retain native entity scanning only as fallback. Pose-only logs are suppressed to keep diagnostics readable. TypeScript and diff checks passed; verify desktop/mobile mutual visibility, movement, rock, BONK, and elimination in one two-client room. |
| 2026-08-05 | Preserve real player names in the weekly leaderboard | Ready for Preview | Codex | Replaced the literal `You` join name with the real Decentraland profile name, read from `AvatarBase.name` with `getPlayer().name` as fallback. The server updates and persists a returning player's real nickname. On startup it also repairs legacy `You`, `Player`, and `Player + address fragment` records in the background through Decentraland's public profile API, without blocking room startup if that API fails. No wallet-derived label is newly displayed or persisted. TypeScript passed; verify the two existing local records refresh to their game names. |
| 2026-08-05 | Add second admin wallet and harden mobile leaderboard rules access | Ready for Preview | Codex | Replaced the single CSV-admin address with a shared two-wallet admin allowlist used by both UI visibility and authoritative-server export authorization. Mobile now reads the local PlayerIdentityData address before profile data arrives, and shows its compact debug controls only to allowlisted wallets; desktop debug controls remain unchanged. The 3D rules hint now sits 0.24m below the mobile board, while desktop retains its prior position; it has a 16m click range and a separate front-facing pointer collider for reliable mobile taps. TypeScript passed; verify the 3D hint and popup on mobile Preview. |
| 2026-08-05 | Improve mobile UI typography and modal layout | Ready for Preview | Codex | Enlarged mobile-only room entry, waiting room, game results, and weekly-rules text while increasing their modal/button spacing. The game-result window size remains unchanged while its typography now uses fixed mobile values: title 34, subtitle 20, stat values 19, result rows 13-15, and return button 20. Preserved the accepted mobile How to Play `19/13` typography and shared 40px game timer. TypeScript passed; verify all four overlays in mobile Preview. |
| 2026-07-31 | Admin-only leaderboard CSV export UI | Completed | Codex | Moved the export administrator wallet to shared leaderboard configuration so client visibility and server authorization use one source of truth. `EXPORT CSV` is now rendered only for the connected non-guest player whose normalized wallet matches the configured administrator. The authoritative server address check and recipient-targeted export response remain in place, so hiding the button does not replace server-side security. |
| 2026-07-30 | Clickable weekly leaderboard rules popup | Completed | Codex | Added `Click leaderboard to see ranking rules` below the 3D board and made the board panel pointer-clickable on desktop and mobile. Clicking opens a responsive React-ECS popup covering weekly reset timing, solo/multiplayer points and daily caps, multiplayer ranking order, and leave-as-elimination behavior, with a close button. The public board now uses the Preview-validated 10 rows per page with tighter spacing and a shorter panel. Removed the temporary spacing-review placeholders and the `Page x/y` text; unused rows are blank while multi-page arrow navigation remains available. Hidden board and navigation entities now also remove their pointer colliders, preventing invisible hover text during gameplay or when only one page exists. The hint font is four times its original size with black outline width `0.4`. The public 3D board remains player display name plus score only; owner CSV export remains unchanged with rank, wallet address, display name, and weekly score. |
| 2026-07-30 | Monday-to-Monday UTC weekly leaderboard | Completed | Codex | Changed the authoritative leaderboard from lifetime totals to fixed UTC weeks. Each period starts Monday at 00:00 UTC; the server checks rollover during startup, settlement, snapshot/export requests, and every 30 seconds. Weekly data uses the isolated `leaderboard:weekly:v1` Storage key, so legacy lifetime totals are not miscounted in the current week. Daily solo/multiplayer caps remain unchanged. UTC boundary tests and `tsc --noEmit` passed. Creator Hub locked the live `main.crdt`, so the full SDK build was completed successfully in an isolated workspace mirror without stopping Preview. |
| 2026-07-29 | Countdown visual hierarchy (client HUD) | Completed | Codex | Enlarged the shared game countdown to `40px` on both mobile and desktop, added an eight-direction black Label outline for legibility, and removed its semi-transparent black background. No authoritative-server or Preview changes. Verified with `node .\node_modules\typescript\bin\tsc --noEmit` and `node .\node_modules\@dcl\sdk-commands\dist\index.js build` (SDK commands `7.24.3-28199504206.commit-1a6c780`). |
| 2026-07-29 | Circular NPC activity area (local client) | Completed | Codex | Changed local NPC spawn and five patrol waypoints from the `42m` half-width square to a uniformly sampled circle centered at `(48, 48)` with radius `36m`. Added per-movement clamping so NPCs cannot step outside the circle. This shared client runtime applies equally to desktop and mobile. Did not modify authoritative-server code or Preview. Verified with `node .\node_modules\typescript\bin\tsc --noEmit` and `node .\node_modules\@dcl\sdk-commands\dist\index.js build` (SDK commands `7.24.3-28199504206.commit-1a6c780`). |

## Task History

| Date | Task Description | Status | Executor | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 2026-07-29 | Add owner-only in-scene leaderboard CSV export | Ready for Preview | AI Assistant | Replaced the external API approach with a server-authorized clipboard export. The owner can request the complete ranked wallet-address, display-name, and total-score CSV from the authoritative server without Cloudflare or extra server configuration. TypeScript passed; manual clipboard verification remains required. |
| 2026-07-14 | Make authoritative leaderboard persistence explicit | Completed | AI Assistant | Changed leaderboard settlement to await initialization and each Storage write. A points-awarded message is now emitted only after both daily-cap and total-score writes succeed; failed total writes restore the in-memory score and attempt to restore the daily record. Verified with `tsc --noEmit`; deployed-World restart verification remains required. |
| 2026-07-11 | Authoritative server leaderboard with daily caps and 3D lobby board | Completed | AI Assistant | Added server-owned scoring on `endActiveMatch()` with solo +1/day cap 10 and multi rank points 20/10/5/3/day cap 100 (UTC reset). Persisted totals via `Storage` and per-player daily caps via `Storage.player`. Synced Top 10 through `Leaderboard` component, added 3D lobby board, game-over points label, and shared ranking util. Verified with `tsc --noEmit` and `sdk-commands build`. Creator Hub playtest still required manually. |
| 2026-06-02 | Translate README.md to English | Completed | AI Assistant | Completely rewrote README.md in English to match project standards. |
| 2026-06-02 | Translate project rules and tasks to English | Completed | AI Assistant | Switched the language of documentation and rules to English as per user request. |
| 2026-06-02 | Update README.md | Completed | AI Assistant | Rewrote README to reflect mobile goals, core rules (task logging/preview limits), and latest features. |
| 2026-06-02 | Update Project Rules and Establish Task Logging | Completed | AI Assistant | Added technical specs and task logging requirements to `.trae/rules/decentraland.md`. |
| 2026-06-02 | Initial POC Scan and Structure Planning | Completed | AI Assistant | Scanned project structure, main loop, UI, and state flow; proposed cleanup for `uiManager.ts`. |
| 2026-06-02 | Melee Combat: Point-click to Forward Hit Detection | Completed | AI Assistant | Changed "click NPC to kill" to forward-facing hit window detection. |
| 2026-06-02 | Player Appearance, Camera, and Movement Tuning | Completed | AI Assistant | Added 3rd-person follow camera; tuned player rotation and height alignment. |
| 2026-06-02 | NPC Ground Alignment and Hitbox Tuning | Completed | AI Assistant | NPCs now snap to ground height; enlarged hitboxes and attack ranges. |
| 2026-06-02 | Player Animation Upgrade (Muscledoge) | Completed | AI Assistant | Integrated `idel / walk / run / jump / Bonk` animations; fixed sprint modifier keys. |
| 2026-06-02 | NPC Animation State Machine (v1) | Completed | AI Assistant | Added random state switching for NPCs (idle/walk/run/jump/Bonk). |
| 2026-06-02 | NPC Squish Animation on Hit | Completed | AI Assistant | NPCs now squish down before turning into the `SmallDoge` death model. |
| 2026-05-28 | UI Skill Text Update | Completed | AI Assistant | Changed skill hint to "Rock Solid — New skills coming soon!". |
| 2026-05-28 | Removed 3D Broadcast Boards | Completed | AI Assistant | Removed central 3D timer, counters, and kill feed from the arena. |
| 2026-05-28 | Removed Floating Text Above NPCs/Players | Completed | AI Assistant | Cleaned up world UI labels for better immersion. |
| 2026-05-28 | Fixed Game Over "Return to Lobby" Button | Completed | AI Assistant | Refactored UI click logic to fix broken button events and cleanup routines. |
| 2026-05-28 | Replaced Procedural Arena with MoonLobby1.glb | Completed | AI Assistant | Switched to instantiating the lobby model as the arena base for better design. |
| 2026-06-02 | Re-captured updated MoonLobby built-in colliders and aligned NPC collision rules | Completed | AI Assistant | Parsed `models/MoonLobby1.glb` and confirmed dedicated collider nodes (`Land_Collider`, `Starlight_Collider`, plus an extra `_Collider` mesh). Updated lobby/arena model loading to capture invisible collider meshes on `CL_PHYSICS`, and added forward obstacle raycasts for NPCs so they reroute when the environment blocks their path. |
| 2026-06-13 | Add short movement lock during Bonk startup | Completed | AI Assistant | Added a dedicated `Bonk` movement-lock window in `src/player.ts`; attack startup now temporarily sets player walk/jog/run speeds to `0` for `1s`, then restores normal locomotion so players cannot keep sliding forward through the opening half of the attack. |
| 2026-06-13 | Shorten player jump duration by 0.5s total | Completed | AI Assistant | Reduced `PLAYER_JUMP_DURATION` in `src/player.ts` from `1.933s` to `1.433s` in three passes, while keeping the same jump clip and animation speed, so the jump resolves faster without reintroducing extra height offset logic. |
| 2026-06-13 | Split player locomotion animation rules for desktop vs mobile | Completed | AI Assistant | Kept `Bonk/jump` as shared high-priority actions in `src/player.ts`, but split normal locomotion into a desktop resolver (`WASD + modifier`) and a mobile resolver driven by smoothed planar player speed via `@dcl/sdk/platform`, so mobile no longer depends on `Shift` semantics to enter `run`. |
| 2026-06-16 | Replace bottom skill hint with mobile-only BONK button | Completed | AI Assistant | Removed the old bottom-center `E` skill hint from `src/uiManager.ts`, added a mobile-only `BONK` HUD button using `@dcl/sdk/platform`, and routed both pointer input and the new UI button through a shared `triggerPlayerBonkAttack()` helper in `src/combat.ts`. Also added a missing HUD root `key` to eliminate the React-ECS list warning. |
| 2026-06-18 | Disable glider and double jump at game start on desktop and mobile | Completed | AI Assistant | Added a shared gameplay input restriction in `src/player.ts` using `InputModifier.Mode.Standard(...)`, so `setupPlayerDisguise()` now disables `disableDoubleJump` and `disableGliding` on `engine.PlayerEntity` as soon as gameplay starts, and `cleanupPlayerDisguise()` removes the modifier when returning to the lobby. |
| 2026-06-18 | Lower dog hit difficulty by enlarging bonk hit radius | Completed | AI Assistant | Increased the forward melee hit-zone radius in `src/combat.ts` from `1.6` to `1.92` (`+20%`), making near-edge dog hits register more reliably without extending the full forward reach. |
| 2026-05-28 | UI Text Logic Optimization | Completed | AI Assistant | Victory shows "Round Complete" & "You Win", failure shows "GAME OVER" & "You Lose". |
| 2026-05-28 | HUD Panel Position Adjustment | Completed | AI Assistant | Moved main game HUD from the bottom-right corner to the center-left position (left: s(42)). |
| 2026-06-13 | Fix round complete modal outside-click close behavior | Completed | AI Assistant | Removed backdrop dismissal in `src/uiManager.ts` and kept `RETURN TO LOBBY` as the only exit path, so outside clicks no longer close the modal or desync UI from `GameState.GAME_OVER`. |
| 2026-06-16 | Fix SDK7 deployment type definition error | Completed | AI Assistant | Traced deployment failure to an outdated `tsconfig.json` entry: `compilerOptions.types = ["@dcl/sdk/types"]`. In installed `@dcl/sdk` 7.23.2, `types/` now provides `tsconfig.ecs7*.json` presets rather than a loadable type library, so TypeScript raised `TS2688`. Updated the project to `extends: "@dcl/sdk/types/tsconfig.ecs7.strict.json"` and kept local output settings (`outDir`, `declaration`, `sourceMap`). |
| 2026-06-16 | Clear remaining strict TypeScript build blockers after SDK7 tsconfig migration | Completed | AI Assistant | Resolved follow-up build errors revealed by strict SDK7 presets: disabled inherited `inlineSourceMap` conflict in `tsconfig.json`, converted `src/skills.ts` skill entities to SDK7 `Entity`-safe handling with proper imports, replaced `require('./npc')` in `src/uiManager.ts` with a static import, and added safe raycast null guards in `src/npc.ts`. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`, which now completes type checking without errors. |
| 2026-06-20 | Research project architecture and official/OpenDCL server-related code | Completed | AI Assistant | Reviewed current Doge Hunt runtime, local OpenDCL authoritative-server references, and installed DCL SDK/toolchain sources. Confirmed the project is still single-player/local-state only, current installed `@dcl/sdk` is standard `7.23.2` rather than `@auth-server`, and local preview server logic lives in `@dcl/sdk-commands` (`start/server/*`) while authoritative multiplayer patterns require separate `isServer()` / `registerMessages()` / `Storage` / `EnvVar` APIs and `scene.json.authoritativeMultiplayer`. |
| 2026-06-20 | Add `Turn to Rock` HUD button, switch disguise model to `Moonstone.glb`, and freeze player during rock skill | Completed | AI Assistant | Added a second mobile HUD action button beside `BONK` in `src/uiManager.ts`, refactored `src/skills.ts` so keyboard `E` and the new HUD button share `triggerTurnToRock()`, replaced the old box disguise entity with a `GltfContainer` that points to `models/Moonstone.glb`, and locked player movement for the disguise duration via shared movement/input restriction helpers in `src/player.ts`. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. Note: `Moonstone.glb` is not present in the local `models/` folder at the time of implementation, so the asset file still needs to be added or synced locally. |
| 2026-06-20 | Remove rock-skill proximity restriction after `Moonstone.glb` was added locally | Completed | AI Assistant | Confirmed `models/Moonstone.glb` now exists locally, then simplified `src/skills.ts` so `triggerTurnToRock()` no longer requires being near any pillar. Rock disguise can now trigger anywhere, using the player's current facing direction for the disguise rotation. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Lower `Moonstone` disguise height by `0.5m` | Completed | AI Assistant | Adjusted the rock disguise spawn height in `src/skills.ts` from `y = 2.0` to `y = 1.5` so the transformed `Moonstone.glb` sits `0.5m` lower. Confirmed `src/uiManager.ts` still gates both `BONK` and `Turn to Rock` HUD buttons behind `isMobile()`, so desktop continues to use keyboard input instead of separate on-screen action buttons. |
| 2026-06-20 | Add desktop `Turn to Rock` HUD button and surface cooldown state | Completed | AI Assistant | Exposed `Turn to Rock` HUD state from `src/skills.ts` so UI can read `Ready / Active / Cooldown` text and enabled state. Updated `src/uiManager.ts` so the `Turn to Rock` button now renders on desktop as well as mobile, while `BONK` remains mobile-only. Added a status line that shows `Turn to Rock [E]` on desktop with live cooldown/active feedback. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Move `Turn to Rock` prompt text fully inside the button bounds | Completed | AI Assistant | Reworked the `Turn to Rock` control in `src/uiManager.ts` from a plain `Button` plus external status label into a single clickable UI panel with two centered text rows inside the same button rectangle. The top line now shows the action title / shortcut, and the second line shows `Ready`, `Active`, or `Cooldown`, keeping all guidance inside the button area. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Lower `Moonstone` disguise height by another `0.5m` | Completed | AI Assistant | Continued the earlier rock-height tuning pass in `src/skills.ts`, reducing the `Moonstone.glb` transform spawn height from `y = 1.5` to `y = 1.0` so the disguised rock sits even lower. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Remove `Moonstone` disguise self-collision that pushed players out of the rock | Completed | AI Assistant | Traced the "camera turn makes the player slip out from the bottom of the rock" issue to the disguise model being spawned with `CL_PHYSICS` collision while the player was locked inside it. Updated `src/skills.ts` so `Moonstone.glb` is now a visual-only disguise model with no collision masks, preventing the physics solver from ejecting the player when rotating the camera. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Fix falling through scene after switching back from rock to doge | Completed | AI Assistant | Updated `src/skills.ts` so the skill now caches the player's exact transform position when `Turn to Rock` starts, places the `Moonstone.glb` relative to the player's current ground height instead of a hard-coded world Y, and calls `movePlayerTo()` to snap the player back to the cached safe position before re-enabling movement when the disguise ends. Also restores the doge visual to that same cached location immediately to avoid one-frame desync. Verified with `node .\\node_modules\\@dcl\\sdk-commands\\dist\\index.js build`. |
| 2026-06-20 | Refresh project research after major skill-system updates | Completed | AI Assistant | Re-reviewed `tasks.md`, `skills-lock.json`, `.agents/skills`, and runtime source after the new `Turn to Rock` work. Confirmed the meaningful change is in the project-owned gameplay skill module `src/skills.ts`, which now coordinates HUD state, input triggers, player movement locking, disguise visuals, restricted teleport recovery, and cleanup. OpenDCL skill docs remain local references/metadata rather than runtime-integrated authoritative server or multiplayer logic, so the earlier conclusion about the project still being local/single-player architecture remains valid. |
| 2026-06-20 | Produce updated complete authoritative server implementation plan | Completed | AI Assistant | Prepared an updated end-to-end authoritative server plan for the current codebase after the latest `Turn to Rock` skill changes. The plan covers required SDK/runtime changes, `scene.json` updates, proposed `client/server/shared` project structure, synced components, client-server messages, system ownership, migration sequencing, testing gates, and how the current local `skills.ts` logic should be split into server-authoritative state plus client-only presentation. |
| 2026-06-20 | Refine authoritative server plan around future multiplayer goals | Completed | AI Assistant | Adjusted the recommended authoritative server direction so the primary design target is future real multiplayer rather than a serverized single-player loop. The updated guidance prioritizes room lifecycle, player identity/anti-cheat, hidden-role integrity, player-vs-player interactions, matchmaking-ready state modeling, and server-owned combat/skill arbitration that scales from current POC into live multiplayer sessions. |
| 2026-06-27 | Consolidate Doge Hunt project rules into a cleaner project-specific policy | Completed | AI Assistant | Reworked `.trae/rules/decentraland.md` into a structured project rule file covering task logging, preview restrictions, SDK7/ECS7 requirements, mobile optimization, and modular architecture guidance. |
| 2026-06-28 | Refresh architecture and incremental multiplayer migration rules | Completed | Codex | Re-reviewed the restored single-player architecture and updated `.trae/rules/decentraland.md` to require small, runnable phases. Long-term multiplayer remains the goal, but the next implementation steps must first validate room-shaped and match-shaped behavior in the existing local single-player runtime without touching authoritative server APIs or scene-level multiplayer server configuration. |
| 2026-06-28 | Phase A local room entry flow | Completed | Codex | Replaced the old `SINGLE PLAYER / MULTIPLAYER` modal with a local `DOGE HUNT ROOM` entry UI. Clicking the lobby Doge now opens `CREATE ROOM / CANCEL`; `CREATE ROOM` still routes to the existing local single-player match startup, with no authoritative server, dependency, or `scene.json` multiplayer changes. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase B local waiting room flow | Completed | Codex | Updated the lobby affordance copy to `Click to Play Game` / `Play Game`, then added a local waiting-room step after `CREATE ROOM`. The new local room state tracks `1/4`, host, ready/start eligibility, and supports `START` / `LEAVE`; `START` still launches the existing local match. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase C local match lifecycle/config | Completed | Codex | Added a local match lifecycle/config layer so `START` now creates a `LocalMatchConfig` before launching gameplay. `startGame()` receives that config and spawns `decoyNpcCount = totalDoges - playerCount`, so the current 1-player room starts with `11` decoy NPCs from `totalDoges = 12`. The old single-player entry naming was removed from the main callback path. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase D local public/private state naming | Completed | Codex | Added a local runtime state layer with `PublicDogeState`, `PrivatePlayerState`, and private Doge identity naming. `startGame()` now initializes these local public/private state objects from `LocalMatchConfig`, and returning to lobby resets them. Combat, NPC behavior, UI stats, dependencies, and `scene.json` multiplayer settings were not changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase E local BONK request/resolver/result path | Completed | Codex | Refactored `combat.ts` so the impact frame now creates a `BonkRequest`, resolves it through `requestBonk()` / local resolver, then applies the returned `BonkResult`. Existing forward hit-zone math, attack timing, animation trigger, NPC elimination, bonk counter, and kill-feed behavior were kept unchanged. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase F local Turn to Rock request/resolver/result path | Completed | Codex | Refactored `skills.ts` so `triggerTurnToRock()` now creates a `TurnToRockRequest`, resolves it through `requestTurnToRock()` / local resolver, then applies the returned `TurnToRockResult`. Existing skill duration, cooldown, Moonstone visual placement, movement lock, return-position recovery, HUD state, and keyboard/HUD triggers were kept unchanged. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase G local runtime result bookkeeping | Completed | Codex | Connected local public/private runtime state to existing BONK and Turn to Rock results. Spawned NPCs now carry local `publicDogeId` mappings; BONK hits update `PrivatePlayerState.bonks` and mark the target public Doge as eliminated; Turn to Rock updates local active/cooldown state and the player's public visual state. Existing HUD counters, hit behavior, skill timing, movement lock, and game-over logic were kept unchanged. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phases H-K local match semantics bundle | Completed | Codex | Added local round-outcome bookkeeping, a unified `getLocalMatchStats()` selector with old counter fallbacks to preserve visible HUD/game-over behavior, a minimal public Doge state-to-NPC presentation bridge, and local player-slot expansion in `LocalMatchConfig` / runtime private player state. BONK and debug elimination now keep public Doge state aligned with NPC presentation. No server, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-28 | Phase L local multi-player simulation | Completed | Codex | Added waiting-room controls for adding/removing local simulated player slots up to the existing `4` player cap. Simulated players are ready by default, flow into `LocalMatchConfig.playerSlots`, and therefore reduce `decoyNpcCount` through the existing local match lifecycle (`2/3/4` player rooms spawn `10/9/8` decoy NPCs from `12` total Doges). Runtime private player state now carries `isSimulated` metadata. No networking, server APIs, dependency, or `scene.json` multiplayer configuration was changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-29 | Phases M-N resolver interface and state boundary cleanup | Completed | Codex | Added `src/gameResolvers.ts` as the replaceable request/resolver interface for BONK, Turn to Rock, and round-end recording. Current local BONK and Turn to Rock resolvers now register through that interface, and `index.ts` records round end through `requestRoundEnd()` instead of directly writing local state. Added explicit local public/private/presentation state boundary helpers in `localMatchState.ts`, and routed main HUD/NPC-spawn reads through the presentation boundary. Gameplay behavior, HUD values, NPC behavior, dependencies, server APIs, and `scene.json` multiplayer configuration were not changed. Verified with `tsc --noEmit` and `sdk-commands build`. |
| 2026-06-29 | Clarify eliminated-player spectator UX target | Planned | Codex | UX target for multiplayer rounds: a BONKed real player should become out/spectating rather than being forced out of the scene. Eliminated players lose gameplay influence (`BONK` / `Turn to Rock` requests must be rejected), see a `SPECTATING` HUD state, can continue watching until round end, and should not receive full identity reveal until final results. Round-over UI should reveal identities, winner, bonks, survival/elimination status, and support return/rematch flow. |
| 2026-06-29 | Split Phase O into authoritative-server compatibility checkpoints | Planned | Codex | Phase O must be split into small stop-and-review checkpoints because prior failures may come from authoritative server runtime, SDK package compatibility, or Creator Hub preview integration. Every O subphase must record exact files changed, commands run, tool versions, observed warnings/errors, and rollback notes in `tasks.md`. Preview/Creator Hub smoke tests require explicit user authorization and must be separated from gameplay server logic changes. |
| 2026-06-29 | Phase O0 authoritative-server compatibility baseline | Completed | Codex | Captured the pre-server rollback/debug baseline before changing dependencies, `scene.json`, or entry branching. Current branch is `PVP-GPT-try-2` at `a25f878`; only documentation files were dirty before O0 runtime work. Confirmed current standard SDK build passes (`tsc --noEmit`, `sdk-commands build`) and no authoritative server keywords are present in `scene.json`, `package.json`, `package-lock.json`, or `src`. Recorded global `npm`/`npx` are broken in the user Roaming npm path, which must be handled before O1 dependency testing. No runtime, dependency, server API, or `scene.json` authoritative config changes were made. |
| 2026-06-29 | Authoritative server risk triage before O1 | Completed | Codex | Diagnosed O0 package/tooling risks without changing runtime code, dependencies, or `scene.json`. Bare PowerShell `npm`/`npx` fail because they resolve through user-prefix npm shims under `C:\Users\sunch\AppData\Roaming\npm`, where access/CLI resolution is broken. Explicit Program Files npm/npx (`npm.cmd`, `npx.cmd`, or direct `node ...\npm-cli.js`) work at npm `10.9.2`. Confirmed `npm ls @dcl/js-runtime` reports the current install invalid: root `@dcl/js-runtime=7.22.3` does not satisfy `package.json` `7.23.2`. Recommended O1 command style: explicit npm CLI plus a writable temp cache, and first reconcile the existing runtime mismatch before adding auth-server dependencies. |
| 2026-06-29 | Phase O1a dependency baseline repair | Completed | Codex | Reconciled the existing root `@dcl/js-runtime` mismatch to `7.23.2` before any auth-server install. The first explicit npm install failed during reify with `Exit handler never called!` after mirror fetches to `mirrors.tencentyun.com` returned `ENOTFOUND`; repaired npm's temporary reify leftovers in `node_modules`, kept the newly installed root runtime, manually aligned `package-lock.json`, and removed the leftover hidden runtime backup. No auth-server package, server API, `scene.json` authoritative config, source code, or preview launch was added. Verified `npm ls`, `tsc --noEmit`, SDK build, and server-keyword scan. |
| 2026-06-29 | Phase O1b auth-server SDK/API feasibility | Completed | Codex | Verified `@dcl/sdk@auth-server` from npm registry without mutating the main project. The tag resolves to `7.24.3-28199504206.commit-1a6c780` and brings a matching prerelease SDK cohort (`@dcl/ecs`, `@dcl/react-ecs`, `@dcl/js-runtime`, `@dcl/sdk-commands`). The tarball contains `@dcl/sdk/network` exports for `isServer`, `registerMessages`, `syncEntity`, `isStateSyncronized`, and `AUTH_SERVER_PEER_ID`, plus `@dcl/sdk/server` exports for `Storage` and `EnvVar`. A clean temp install and TypeScript API harness passed. Main project dependencies, source, `scene.json`, and preview state were not changed; actual project install is deferred to a separate O1c because the current lockfile still has unresolved tencentyun mirror URLs and `node_modules` is tracked. |
| 2026-06-29 | Phase O1c main-project auth-server dependency install | Completed | Codex | Installed the auth-server SDK cohort into the main project using explicit Program Files npm CLI, temp cache, npmjs registry, and `replace-registry-host=always`. `package.json`, `package-lock.json`, tracked `node_modules`, and generated `bin/index.js` now reflect `@dcl/sdk`, `@dcl/js-runtime`, and `@dcl/sdk-commands` at `7.24.3-28199504206.commit-1a6c780`; `package-lock.json` now has `mirrors.tencentyun.com=0`. `npm ls` and `tsc --noEmit` passed; `sdk-commands build` also passed but auto-wrote `scene.json.authoritativeMultiplayer=true` and `scripts.server-logs`, which were reverted to keep O1c dependency-only. No source code, final `scene.json` config, `logsPermissions`, server/client branching, or preview launch was added. |
| 2026-06-29 | Phase O1c runtime failure and rollback | Completed | Codex | User reported Creator Hub console `write EPIPE` and an empty scene after O1c, with the watcher rebuilding a file under `node_modules/@dcl/inspector/node_modules/@dcl/ecs/...`. O1c-R first blocked on `EBUSY` because `node_modules/@dcl/inspector/public/bundle.js` was locked by lingering Creator Hub / preview node processes. After user authorization, stopped those processes, completed the rollback to standard SDK `7.23.2`, added a narrow `package.json` override for `@dcl/asset-packs=2.15.2` because `2.16.2` imports `@dcl/sdk/text-codec` which standard SDK `7.23.2` does not provide, and verified `npm ls`, `tsc --noEmit`, SDK build, server-keyword scan, and process state. |
| 2026-06-30 | Phase O1d auth-server / Creator Hub compatibility investigation | Completed | Codex | Kept the working main project on standard SDK `7.23.2` and did not mutate main-project dependencies or server config. Confirmed the restored main project is stable while Creator Hub/Decentraland are running. Re-checked npm metadata: `@dcl/sdk@auth-server` still resolves to `7.24.3-28199504206.commit-1a6c780`, with `sdk-commands=7.24.3...`, `inspector=7.34.3`, and nested `asset-packs=2.16.2`. A clean temp auth-server scene installed and built successfully; therefore the O1c failure is most likely live Creator Hub/preview watcher disruption during main-project `node_modules` mutation, not a simple auth-server compile failure. |
| 2026-06-30 | Phase O1e-a isolated auth-server CLI preview smoke test | Completed | Codex | With user authorization to continue validation, kept the main Doge Hunt project untouched and started the existing scratch auth-server scene using `sdk-commands start --no-client --no-browser --no-watch -p 3799`. The preview server returned HTTP 200, bundled and type-checked successfully, launched `@dcl/hammurabi-server@next`, printed `[O1D] scratch main loaded 0`, connected to the local LiveKit room, and was then stopped with its process tree. This verifies the auth-server runtime can start in CLI preview. Creator Hub UI cold-start compatibility is still untested. |
| 2026-06-30 | Phase O1e-b1 automated Creator Hub scratch open attempt | Blocked | Codex | With user authorization to close/switch Creator Hub context, stopped the active Creator Hub/preview processes, launched Creator Hub with the scratch auth-server project path, and inspected processes, ports, logs, and the app bundle. Creator Hub received the scratch path but only matched arguments against `--env=` and `--open-devtools-with-port=`; no scratch preview process, Hammurabi process, esbuild process, or preview port appeared. Automated command-line project opening is not supported in this Creator Hub build, so true Creator Hub UI preview still requires manual import/open plus Preview. |
| 2026-06-30 | Phase O1e-b2 manual Creator Hub scratch preview | Completed | Codex | After Creator Hub updated to `0.42.0`, the user manually added/opened the scratch auth-server project and clicked Preview. Creator Hub ran `sdk-commands start --explorer-alpha --hub --skip-auth-screen` from the scratch path, started preview on port `8000`, launched the multiplayer/Hammurabi server, attached the inspector debugger, type-check watch reported `Found 0 errors`, `/about` returned HTTP 200 with `healthy:true`, scene logs printed `[O1D] scratch main loaded 0`, and LiveKit connected. No `EPIPE` or immediate crash was observed. This verifies updated Creator Hub can preview the isolated auth-server scene. |
| 2026-06-30 | Phase O1f main-project auth-server dependency retry | Completed | Codex | Safely retried the main-project auth-server dependency cohort after O1e proved the isolated auth-server scene works in Creator Hub `0.42.0` and after confirming Creator Hub/preview remnants were stopped. Installed `@dcl/sdk`, `@dcl/js-runtime`, and `@dcl/sdk-commands` at `7.24.3-28199504206.commit-1a6c780`, removed the standard-SDK-only `@dcl/asset-packs=2.15.2` override, verified `npm ls`, `tsc --noEmit`, and SDK build. SDK build auto-added `authoritativeMultiplayer` and `server-logs`; both were removed to keep O1f dependency-only. Final scope scan has no `scene.json` authoritative config or source server APIs. |
| 2026-06-30 | Phase O2 minimal authoritative scene config | Rolled Back | Codex | Added `scene.json.authoritativeMultiplayer=true`, `logsPermissions`, and SDK-added `scripts.server-logs`; build/type checks passed. O2a preview then failed before O3 with `/content/entities/active` timing out twice and `Failed to start: timeout after 15000ms`. Rolled O2 config back by removing `authoritativeMultiplayer`, `logsPermissions`, and `server-logs`, while keeping the O1f auth-server dependency cohort. |
| 2026-06-30 | Phase O2a authoritative config preview smoke | Failed / Rolled Back | Codex | User manually previewed the main project after O2 and before O3. Creator Hub started `sdk-commands start`, preview listened on `8000`, Hammurabi/multiplayer server was launched, and TypeScript watch reported zero errors, but scene startup failed because `http://localhost:8000/content/entities/active` timed out twice (`15016ms`, `15008ms`) and then gave up. A lingering Hammurabi child process was stopped. This isolates the failure to main-project authoritative scene config / preview content endpoint behavior, not source server branching. |
| 2026-06-30 | O1f replay failure and Creator Hub auto-mutation finding | Completed | Codex | User retried preview after rolling O2 back to O1f dependencies. Even though final files had no O2 config at rest, `sdk-commands start` with the auth-server dependency cohort auto-reintroduced `scene.json.authoritativeMultiplayer=true` and `package.json` `scripts.server-logs`, then preview again failed at `http://localhost:8000/content/entities/active` after two `15000ms` timeouts. Cleaned preview/Creator Hub remnants, removed the auto-written fields again, and confirmed no listeners on `8000` or `3799`. Conclusion: O1f is a file-level dependency-only checkpoint, but not a stable previewable checkpoint for the main project; do not preview it again expecting standard single-player behavior. |
| 2026-06-30 | O1f-R rollback to playable standard SDK baseline | Completed | Codex | Rolled the main project back from the auth-server dependency cohort to standard SDK `7.23.2` after confirming O1f preview is not safe. `package.json`, `package-lock.json`, and tracked `node_modules` now resolve `@dcl/sdk`, `@dcl/js-runtime`, `@dcl/sdk-commands`, `@dcl/ecs`, and `@dcl/react-ecs` to `7.23.2`, with `@dcl/asset-packs=2.15.2` overridden under inspector. `tsc --noEmit` and standard SDK build passed, and server/auth keywords plus `7.24.3-28199504206` no longer appear in `scene.json`, `package.json`, `package-lock.json`, or `src`. No preview was launched. |
| 2026-06-30 | O1f-R standard SDK preview smoke | Completed | User / Codex | User reopened/ran Creator Hub preview after O1f-R and confirmed the project works again. This validates standard SDK `7.23.2` plus the `@dcl/asset-packs=2.15.2` override as the current playable single-player baseline after the failed auth-server dependency experiment. |
| 2026-06-30 | OQ auth-server content endpoint ladder | Completed | Codex / User | Created an isolated auth-server diagnostic scene under `%TEMP%\doge-hunt-auth-ladder-20260630` and gradually added Doge Hunt traits. Direct CLI preview checks against `/content/entities/active` stayed fast: OQ0 official auth template `26ms`, OQ1 36 parcels/spawn `23ms`, OQ2 Doge metadata/source `26ms`, OQ3 Doge assets/models `31ms`, OQ4 Doge source+assets `34ms`, OQ5 no `.dclignore` plus `dclcontext` docs `34ms`. User confirmed OQ5/OQ7 can preview normally in Creator Hub/Explorer-alpha. The repeated non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` remains present, but scene logs, model content requests, and LiveKit connection continue. Conclusion: Doge Hunt content plus Creator Hub/Explorer-alpha path does not reproduce the original main-project `/content/entities/active` timeout in the isolated project. |

## Authoritative Server Migration Logs

### 2026-06-29 - Phase O0 Baseline

- Scope: baseline and rollback checkpoint only. No dependency changes, no `scene.json` authoritative fields, no `isServer()` branch, no `registerMessages()`, and no preview/Creator Hub launch.
- Files changed by O0: `tasks.md` only for logging. Runtime code was not changed.
- Git baseline: branch `PVP-GPT-try-2`, commit `a25f878`.
- Dirty files at O0 start: `.trae/rules/decentraland.md`, `tasks.md`. `git diff --name-only` showed only those documentation files.
- Runtime/dependency config before O1:
  - `package.json`: `@dcl/sdk` `^7.6.0`, `@dcl-sdk/utils` `^1.2.0`, `@dcl/js-runtime` `7.23.2`, dev `@dcl/sdk-commands` `^7.6.0`.
  - Installed packages: `@dcl/sdk=7.23.2`, `@dcl/sdk-commands=7.23.2`, `@dcl-sdk/utils=1.4.0`, `typescript=5.9.3`, root `@dcl/js-runtime=7.22.3`.
  - Lockfile note: `package-lock.json` root dependency records `@dcl/js-runtime=7.22.3`, while `@dcl/sdk` nests `@dcl/js-runtime=7.23.2`; this mismatch must be considered during O1 dependency testing.
  - `scene.json`: has `worldConfiguration.name = playandearn.dcl.eth`; does not have `authoritativeMultiplayer` or `logsPermissions`.
  - Lockfile present: `package-lock.json` with lockfileVersion `3`.
- File hashes before O1:
  - `package.json`: SHA256 `66763DDA8A65818C30A899F47908C8B209ACEB84C77D0428A88830E9639BC392`
  - `package-lock.json`: SHA256 `07346D9B9A17183E15620B9D31809256227DDCA7A0268064D8DB9BDEBC8ECFF1`
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Commands run:
  - `git branch --show-current` -> `PVP-GPT-try-2`
  - `git rev-parse --short HEAD` -> `a25f878`
  - `git status --short` -> docs dirty only
  - `node -v` -> `v22.13.1`
  - `npm -v` -> failed: missing `C:\Users\sunch\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js`
  - `npx --version` -> failed: missing `C:\Users\sunch\AppData\Roaming\npm\node_modules\npm\bin\npx-cli.js`
  - `rg -n "authoritativeMultiplayer|logsPermissions|isServer\(|registerMessages|@auth-server|@dcl/sdk/server|@dcl/sdk/network" scene.json package.json package-lock.json src` -> no matches
  - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed; warning: Node `punycode` deprecation
- Suspected risk layers before O1:
  - Package/tooling layer: global `npm` and `npx` are broken, so dependency work may require repairing npm path, using a bundled npm path, or another explicitly approved package workflow.
  - Package consistency layer: `package.json` vs lockfile/root install mismatch for `@dcl/js-runtime`.
  - Scene config layer: `worldConfiguration.name` already exists, but `logsPermissions` wallet value still needs confirmation before O2.
  - Creator Hub/runtime layer: not tested in O0 because preview was not authorized.
- Rollback boundary for O1:
  - O1 must change only package/dependency files needed for auth-server API feasibility.
  - If O1 fails, restore `package.json`, `package-lock.json`, and any generated dependency artifacts to the O0 hashes above, then rerun `tsc --noEmit` and SDK build.
  - Do not proceed to `scene.json` authoritative config or `isServer()` branching until O1 dependency/API feasibility is documented and reviewed.

### 2026-06-29 - Risk Triage Before O1

- Scope: diagnose O0 risks only. No dependency install, no runtime code changes, no `scene.json` authoritative config, no `isServer()` branch, and no preview.
- Risk R1 - bare `npm`/`npx` failure:
  - `npm -v` fails with missing `C:\Users\sunch\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js`.
  - `npx --version` fails with missing `C:\Users\sunch\AppData\Roaming\npm\node_modules\npm\bin\npx-cli.js`.
  - `Get-Command` and `where.exe` find Node under `C:\Program Files\nodejs`, but PowerShell `npm.ps1` / `npx.ps1` consult the global prefix `C:\Users\sunch\AppData\Roaming\npm`.
  - Reading `C:\Users\sunch\AppData\Roaming\npm` directly is access denied in this environment, so do not rely on that user-prefix npm for O1.
- Risk R1 mitigation:
  - Explicit `& "$env:ProgramFiles\nodejs\npm.cmd" -v` works -> `10.9.2`.
  - Explicit `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --version` works -> `10.9.2`.
  - Explicit `& "$env:ProgramFiles\nodejs\npx.cmd" --version` works -> `10.9.2`.
  - For O1, use explicit Program Files npm CLI instead of bare `npm`/`npx`.
- Risk R2 - npm cache/log write reliability:
  - Default npm cache is `C:\Users\sunch\AppData\Local\npm-cache`.
  - Earlier npm failures could not write logs there.
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ...` successfully writes debug logs under `%TEMP%\doge-hunt-npm-cache\_logs`.
  - O1 should use a temporary cache path and record the exact log file path on failure.
- Risk R3 - current dependency mismatch:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" ls @dcl/js-runtime --depth=0` reports `ELSPROBLEMS`.
  - Current root install is `@dcl/js-runtime@7.22.3 invalid: "7.23.2" from the root project`.
  - O1 should first reconcile or explicitly account for this mismatch before testing `@dcl/sdk@auth-server`; otherwise auth-server failures may be conflated with the existing invalid install.
- Risk R4 - generated cache cleanup:
  - A repo-local `.npm-cache/` was accidentally created during diagnostics and removed after confirming it was inside the workspace.
  - Future npm cache paths should stay outside the repo, preferably under `%TEMP%`.
- Recommended O1 start condition:
  - Use explicit npm CLI path: `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js"`.
  - Use cache path: `$env:TEMP\doge-hunt-npm-cache`.
  - First command should be a read-only dependency sanity check with explicit npm CLI and temp cache.
  - First dependency-changing command should be limited to package/dependency feasibility and stop immediately after `package.json` / `package-lock.json` / build results are recorded.

### 2026-06-29 - Phase O1a Dependency Baseline Repair

- Scope: repair the pre-existing root `@dcl/js-runtime` mismatch only. No `@dcl/sdk@auth-server` install, no authoritative server API imports, no `scene.json` authoritative fields, no server/client entry split, and no preview/Creator Hub launch.
- Pre-repair baseline:
  - `package.json` already required root `@dcl/js-runtime` `7.23.2`.
  - `package-lock.json` and installed root `node_modules/@dcl/js-runtime` still recorded `7.22.3`.
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/js-runtime --depth=0` failed with `ELSPROBLEMS`: `@dcl/js-runtime@7.22.3 invalid: "7.23.2" from the root project`.
- Dependency command attempted:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" install @dcl/js-runtime@7.23.2 --save-exact --no-audit --no-fund`
  - Result: failed after npm reify with `Exit handler never called!`.
  - Debug log path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-npm-cache\_logs\2026-06-29T08_34_03_067Z-debug-0.log`.
  - First relevant lower-level issue in the log: repeated `ENOTFOUND` fetching package tarballs from `http://mirrors.tencentyun.com/npm/...`; `@dcl/js-runtime@7.23.2` itself was fetched successfully from `https://registry.npmjs.org`.
- Repair actions after failed npm reify:
  - Confirmed npm had updated root `node_modules/@dcl/js-runtime` to `7.23.2`.
  - Restored npm temporary reify paths whose target names were missing: bin shims plus the nested `node_modules/@dcl/sdk/node_modules/@dcl/js-runtime`.
  - Replaced 19 incomplete package directories with their npm hidden reify backups.
  - Kept the new root `node_modules/@dcl/js-runtime` and removed the old hidden root backup `node_modules/@dcl/.js-runtime-bcgDIx8f`.
  - Manually aligned `package-lock.json` root dependency and `node_modules/@dcl/js-runtime` entry to `7.23.2`, reusing the existing `7.23.2` integrity value already present for the SDK nested runtime entry.
- Files changed by O1a:
  - `package-lock.json`: root `@dcl/js-runtime` dependency and lock entry changed from `7.22.3` to `7.23.2`.
  - `node_modules/@dcl/js-runtime/package.json`: installed root package version changed from `7.22.3` to `7.23.2`.
  - `node_modules/@dcl/js-runtime/apis.d.ts`: installed root runtime definitions updated to the `7.23.2` contents.
  - `tasks.md`: O1a logging.
  - No source files, `package.json`, `scene.json`, or `tsconfig.json` changed.
- File hashes after O1a:
  - `package.json`: SHA256 `66763DDA8A65818C30A899F47908C8B209ACEB84C77D0428A88830E9639BC392` (unchanged from O0).
  - `package-lock.json`: SHA256 `2276BA5790C95CDB3C2DBD3797D4C4C2CC895B32C00FEDB70F74F55F06C556DF`.
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3` (unchanged from O0).
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375` (unchanged from O0).
- Verification:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/js-runtime @dcl/sdk @dcl/sdk-commands --depth=0` -> passed: all three are `7.23.2`.
  - `rg -n "authoritativeMultiplayer|logsPermissions|isServer\(|registerMessages|@auth-server|@dcl/sdk/server|@dcl/sdk/network" scene.json package.json package-lock.json src` -> no matches.
  - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed; warning remains Node `punycode` deprecation.
- Risk notes for O1 proper:
  - The dependency tree is now internally consistent for the current standard SDK, but the project still has many `package-lock.json` tarball URLs pointing at `mirrors.tencentyun.com`, which is not resolvable from this environment.
  - Any future dependency-changing O1 command should either account for that mirror risk or explicitly test a registry/lockfile strategy before touching auth-server packages.
  - `node_modules` is tracked in this repository, so dependency repairs can surface tracked `node_modules` diffs in addition to lockfile diffs.
- Stop condition: O1a is complete. Do not proceed to `@dcl/sdk@auth-server` until reviewed.

### 2026-06-29 - Phase O1b Auth-server SDK/API Feasibility

- Scope: verify whether `@dcl/sdk@auth-server` exists, resolves cleanly from npm, and exposes the required authoritative-server API surface. No main-project dependency mutation, no `scene.json` authoritative fields, no source imports, no server/client branching, and no preview/Creator Hub launch.
- Preflight:
  - Main project `git status --short`: existing O1a/docs changes only (`.trae/rules/decentraland.md`, `tasks.md`, `package-lock.json`, `node_modules/@dcl/js-runtime/*`).
  - Main project dependency baseline remains `@dcl/sdk=7.23.2`, `@dcl/sdk-commands=7.23.2`, `@dcl/js-runtime=7.23.2`.
  - Main project `package-lock.json` mirror count remains `mirrors.tencentyun.com=360`, `registry.npmjs.org=0`.
- Registry metadata command:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" view '@dcl/sdk@auth-server' version dist.tarball dist.integrity dependencies peerDependencies --registry=https://registry.npmjs.org/ --json`
  - Result: `@dcl/sdk@auth-server` resolves to `7.24.3-28199504206.commit-1a6c780`.
  - Tarball: `https://registry.npmjs.org/@dcl/sdk/-/sdk-7.24.3-28199504206.commit-1a6c780.tgz`.
  - Integrity: `sha512-Rak7W1GiGYIp5JmxykePd34oNI9nxSASfV86hcKi333upV5SnAsBlytNm62RtYAzotne/1FWPC4kKtYZ4wkS6w==`.
  - Dependency cohort: `@dcl/ecs`, `@dcl/react-ecs`, `@dcl/js-runtime`, and `@dcl/sdk-commands` all move to `7.24.3-28199504206.commit-1a6c780`.
- Tarball inspection:
  - Packed to `%TEMP%\doge-hunt-o1b-auth-server-pack-cc54c812666942e1a9d59f456fbf562c`.
  - The tarball includes `network/index.d.ts`, `network/events`, `network/message-bus-sync.d.ts`, `server/index.d.ts`, `server/env-var.d.ts`, and `server/storage/*`.
  - Confirmed `@dcl/sdk/network` exports `isServer`, `registerMessages`, `syncEntity`, and `isStateSyncronized`.
  - Confirmed `@dcl/sdk/network/message-bus-sync` exports `AUTH_SERVER_PEER_ID`.
  - Confirmed `@dcl/sdk/server` exports `EnvVar` and `Storage`.
  - Current standard project SDK comparison: `node_modules/@dcl/sdk/network/index.d.ts` exists but does not export `isServer` / `registerMessages`; `node_modules/@dcl/sdk/server/index.d.ts` does not exist.
- Storage API shape note:
  - The local skill text mentions `Storage.world`, but the actual auth-server package exposes scene-scoped storage as `Storage.get/set/delete/getValues` plus `Storage.player`.
  - Future implementation should follow the package types from `@dcl/sdk@auth-server` unless later runtime testing proves otherwise.
- Isolated install / compile check:
  - Clean temp project: `%TEMP%\doge-hunt-o1b-auth-server-clean-54493451f9fe404aa8bb3eeae1f30af0`.
  - Installed with explicit npm CLI, temp cache, and `--registry=https://registry.npmjs.org/`.
  - Install command used `--ignore-scripts --no-audit --no-fund` and completed: `added 337 packages`.
  - Clean temp lockfile counts: `mirrors.tencentyun.com=0`, `registry.npmjs.org=359`.
  - Installed direct dependency: `@dcl/sdk@7.24.3-28199504206.commit-1a6c780`; transitive SDK cohort includes `@dcl/ecs`, `@dcl/react-ecs`, `@dcl/js-runtime`, and `@dcl/sdk-commands` at the same prerelease version.
  - TypeScript harness imported and type-checked `isServer`, `registerMessages`, `syncEntity`, `isStateSyncronized`, `AUTH_SERVER_PEER_ID`, `Storage`, and `EnvVar` using the auth-server SDK types. Result: passed.
  - Discarded temp attempt: an earlier `npm install --prefix <tempProject>` run from the main workspace polluted the temp package with a `doge-hunt` file dependency and produced `ELSPROBLEMS` during `npm ls`; no main-project files were changed. The clean temp run above is the trusted result.
- Warnings observed during clean temp install:
  - Deprecation warnings from transitive packages: `inflight`, `interface-ipld-format`, `stable`, old `glob` versions, `cids`, `text-encoding`, `multibase`, `multicodec`, `ipld-dag-pb`, and `uuid@9.0.1`.
  - These warnings did not block install or TypeScript API validation.
- Main project verification after O1b:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/js-runtime @dcl/sdk @dcl/sdk-commands --depth=0` -> passed: all remain `7.23.2`.
  - `rg -n "authoritativeMultiplayer|logsPermissions|isServer\(|registerMessages|@auth-server|@dcl/sdk/server" scene.json package.json package-lock.json src` -> no matches.
  - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed; warning remains Node `punycode` deprecation.
  - File hashes remain the same as after O1a: `package.json` SHA256 `66763DDA8A65818C30A899F47908C8B209ACEB84C77D0428A88830E9639BC392`, `package-lock.json` SHA256 `2276BA5790C95CDB3C2DBD3797D4C4C2CC895B32C00FEDB70F74F55F06C556DF`, `scene.json` SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`, `tsconfig.json` SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`.
- Decision / stop condition:
  - Auth-server SDK/API feasibility is positive in isolation.
  - Do not mutate the main project dependency tree in O1b. A direct project install would need to move the SDK cohort from standard `7.23.2` to prerelease `7.24.3-28199504206.commit-1a6c780`, while the main lockfile still points 360 tarballs at an unreachable mirror and tracked `node_modules` means install failures can create large diffs.
  - Next dependency step should be a separate O1c checkpoint: define a registry/lockfile strategy, then attempt the main project auth-server dependency install with explicit rollback and logging.

### 2026-06-29 - Phase O1c Main-project Auth-server Dependency Install

- Scope: install the auth-server SDK dependency cohort into the main project only. No source imports, no `scene.json` authoritative config in the final tree, no `logsPermissions`, no server/client branching, and no preview/Creator Hub launch.
- Preflight:
  - Starting dirty files: existing docs/O1a changes plus `package-lock.json` and root `node_modules/@dcl/js-runtime` from O1a.
  - Starting dependency state: `@dcl/sdk=7.23.2`, `@dcl/sdk-commands=7.23.2`, `@dcl/js-runtime=7.23.2`.
  - Starting lockfile mirror count: `mirrors.tencentyun.com=360`, `registry.npmjs.org=0`.
  - Starting hashes: `package.json` SHA256 `66763DDA8A65818C30A899F47908C8B209ACEB84C77D0428A88830E9639BC392`, `package-lock.json` SHA256 `2276BA5790C95CDB3C2DBD3797D4C4C2CC895B32C00FEDB70F74F55F06C556DF`, `scene.json` SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`, `tsconfig.json` SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`.
- Registry / lockfile strategy:
  - Manually set `package.json` dependency cohort to exact auth-server prerelease versions:
    - `@dcl/sdk`: `7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime`: `7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands`: `7.24.3-28199504206.commit-1a6c780`
  - Ran lockfile-only update first, before touching `node_modules`:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always install --package-lock-only --ignore-scripts --no-audit --no-fund`
    - Result: passed.
  - Lockfile-only reduced mirror URLs from `360` to `4`. The remaining entries were `@dcl-sdk/utils`, `@dcl/ecs-math`, `@dcl/explorer`, and `text-encoding`.
  - Manually replaced the remaining four `resolved` URLs with equivalent `https://registry.npmjs.org/...` tarball URLs while preserving versions and integrity hashes.
  - Final lockfile mirror count after this step: `mirrors.tencentyun.com=0`, `registry.npmjs.org=360`.
- Main-project reify:
  - Command:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always install --ignore-scripts --no-audit --no-fund`
  - Result: passed.
  - npm summary: `added 12 packages, removed 13 packages, and changed 66 packages in 19s`.
  - npm warnings:
    - Deprecated transitive packages: `glob@11.1.0`, `uuid@9.0.1`.
    - Cleanup warning: npm initially failed to remove a hidden `.esbuild-3XR4O86e` backup because an `esbuild.exe` helper was still running. The specific `esbuild` process was stopped and the hidden backup directory was removed.
- Installed dependency result:
  - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/js-runtime @dcl/sdk @dcl/sdk-commands --depth=0` -> passed:
    - `@dcl/js-runtime@7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk@7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands@7.24.3-28199504206.commit-1a6c780`
  - Confirmed auth-server API files now exist in the main project:
    - `node_modules/@dcl/sdk/network/index.d.ts`
    - `node_modules/@dcl/sdk/network/message-bus-sync.d.ts`
    - `node_modules/@dcl/sdk/server/index.d.ts`
  - Confirmed exported API names in installed files: `isServer`, `registerMessages`, `AUTH_SERVER_PEER_ID`, `EnvVar`, and `Storage`.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed after install and again after reverting auto scene/package config writes.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed with SDK commands `v7.24.3-28199504206.commit-1a6c780`; warning remains Node `punycode` deprecation.
  - Important build-side effect: auth-server `sdk-commands build` auto-added `authoritativeMultiplayer: true` to `scene.json` and `scripts.server-logs: "sdk-commands sdk-server-logs"` to `package.json`.
  - Those auto-added config/script fields were reverted to keep O1c dependency-only. Final `scene.json` hash is unchanged from O1a/O1b.
  - Final scope scan: `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server" scene.json package.json src` -> no matches.
- Files changed by O1c:
  - `package.json`: dependency cohort upgraded to auth-server prerelease versions.
  - `package-lock.json`: dependency tree upgraded and all resolved tarball URLs moved to npmjs.
  - `node_modules/`: tracked dependency tree reified to the auth-server cohort; this is expected because `node_modules` is tracked in this repository.
  - `bin/index.js`: regenerated by the successful auth-server SDK build.
  - `tasks.md`: O1c logging.
  - Final `scene.json`: no content change.
  - No `src` files changed.
- Final hashes after O1c:
  - `package.json`: SHA256 `8DC3D20914C6B2E329F0EB800F10599D284AEFF5F846BE3A903F06218A77355F`
  - `package-lock.json`: SHA256 `7212ABAD1C36384860244D8CD15FB6A65C612B7BD5EF15E4FBA0B5838080B876`
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Risk notes for O2:
  - With auth-server dependencies installed, `sdk-commands build` is no longer a non-mutating verification command if `scene.json.authoritativeMultiplayer` and `scripts.server-logs` are absent.
  - O2 should intentionally add/keep the required scene config and decide whether to keep the `server-logs` npm script, then run build expecting those fields to stay.
  - `logsPermissions` still needs wallet values before O2 can be complete.
- Stop condition: O1c dependency install is complete. Do not proceed to `scene.json` config or entry branching until reviewed.

### 2026-06-29 - Phase O1c Runtime Failure / O1c-R Rollback Attempt

- Trigger:
  - User reported Creator Hub console output after O1c: `File ...node_modules\@dcl\inspector\node_modules\@dcl\ecs\dist-cjs\components\generated\pb\decentraland\sdk\components\common\texts.gen.js changed, rebuilding...` followed by `error: Error: The service was stopped: write EPIPE`.
  - User also reported that scene contents disappeared.
- Suspected layer:
  - Package / Creator Hub preview integration, not gameplay code.
  - The failing path is under `node_modules/@dcl/inspector/...`, and O1c had only changed dependencies plus generated `bin/index.js`; no `src` gameplay files or final `scene.json.authoritativeMultiplayer` config were introduced.
- Process state before rollback:
  - Detected running Creator Hub processes: `3032`, `25436`.
  - Detected running ordinary Program Files `node.exe` processes: `23432`, `23440`, `24116`, `24144`.
  - Codex `node_repl` processes were intentionally excluded from any stop attempt.
- Rollback actions attempted:
  - Updated `package.json` dependency cohort to exact standard versions:
    - `@dcl/sdk`: `7.23.2`
    - `@dcl/js-runtime`: `7.23.2`
    - `@dcl/sdk-commands`: `7.23.2`
  - Offline lockfile-only npm command failed:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --offline --package-lock-only --ignore-scripts --no-audit --no-fund install`
    - Result: failed with `ENOTCACHED` for `@well-known-components/fetch-component`.
  - Registry-backed lockfile-only npm command succeeded:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always --package-lock-only --ignore-scripts --no-audit --no-fund install`
    - Result: `package-lock.json` now resolves the root SDK cohort to `7.23.2`.
  - Full rollback reify command failed because Creator Hub / preview still had files locked:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always install --ignore-scripts --no-audit --no-fund`
    - Result: failed with `EBUSY: resource busy or locked, rename '...\node_modules\@dcl\inspector\public\bundle.js' -> '...\node_modules\@dcl\.inspector-bUQUpFkA\public\bundle.js'`.
    - Npm debug log: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-npm-cache\_logs\2026-06-29T21_33_29_943Z-debug-0.log`.
- Current partial state after the blocked rollback:
  - `package.json`: `@dcl/sdk=7.23.2`, `@dcl/js-runtime=7.23.2`, `@dcl/sdk-commands=7.23.2`.
  - `package-lock.json`: root SDK cohort resolved to `7.23.2`.
  - Installed `node_modules`: still `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`, `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`, `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`.
  - No hidden `node_modules/@dcl/.inspector-*` backup directory remained after the failed rename check.
  - Build/type verification was not run because manifest/lock and installed `node_modules` are intentionally known to be out of sync.
- Stop condition:
  - O1c-R is blocked until Creator Hub, Decentraland preview, and related Program Files `node.exe` processes are fully closed.
  - Next retry should only run the full rollback install after the file lock is gone, then run `npm ls`, `tsc --noEmit`, SDK build, scope scan, and hashes.
- Completion update after user authorization:
  - User explicitly authorized stopping the lingering Creator Hub and preview node processes.
  - Stopped these process IDs: Creator Hub `3032`, `25436`; Program Files `node.exe` `23432`, `23440`, `24116`, `24144`.
  - Post-stop process check showed only Codex `node_repl` processes remained.
  - Full rollback reify command then passed:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always install --ignore-scripts --no-audit --no-fund`
    - Result: `added 12 packages, removed 12 packages, and changed 12 packages in 7s`.
    - Warning: deprecated transitive `glob@11.1.0`.
  - First SDK build after that rollback failed because `@dcl/asset-packs@2.16.2` imported `@dcl/sdk/text-codec`, which standard `@dcl/sdk@7.23.2` does not provide.
  - Compared against the original git lockfile and found `@dcl/asset-packs@2.15.2`; added a narrow `package.json` override:
    - `"overrides": { "@dcl/asset-packs": "2.15.2" }`
  - Re-ran npm install after the override:
    - Result: `added 8 packages, and removed 8 packages in 2s`.
    - Final `@dcl/asset-packs` is nested under `node_modules/@dcl/inspector/node_modules/@dcl/asset-packs` at `2.15.2`.
  - Final dependency state:
    - `@dcl/sdk=7.23.2`
    - `@dcl/js-runtime=7.23.2`
    - `@dcl/sdk-commands=7.23.2`
    - `package-lock.json` mirror count: `mirrors.tencentyun.com=0`, `registry.npmjs.org=359`.
  - Final scope scan:
    - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server|@dcl/sdk/text-codec|7\.24\.3-28199504206|commit-1a6c780" scene.json package.json package-lock.json src` -> no matches.
  - Final verification:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/asset-packs @dcl/js-runtime @dcl/sdk @dcl/sdk-commands --depth=0` -> passed for root SDK cohort; `@dcl/asset-packs` is transitive/nested due the override.
    - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
    - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed with SDK commands `v7.23.2`; warning remains Node `punycode` deprecation.
    - Post-build process check showed only Codex `node_repl` processes; Creator Hub and preview node processes were not relaunched.
  - Final hashes after O1c-R:
    - `package.json`: SHA256 `51B2AEB9056EB7B768F5EB78AE9D8E88879FBD73734C7C1824F2ED5F7406F238`
    - `package-lock.json`: SHA256 `99C567B81E3766064FE44834E82B4BF8FCCF1A9AB19D6BEF55931812742D0318`
    - `scene.json`: SHA256 `0C1CA22B677C03028AC825A9FE6306F8E4BDE04DF3608A82651A275074E504DB`
    - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Final stop condition: O1c-R is complete. Do not restart Creator Hub/preview until the user is ready to manually smoke-test the restored standard SDK scene.

### 2026-06-30 - Phase O1d Auth-server / Creator Hub Compatibility Investigation

- Scope:
  - Investigate why O1c caused Creator Hub preview failure after the user confirmed the restored standard SDK scene now opens and starts normally.
  - Main project must remain on standard SDK `7.23.2` during this checkpoint.
  - No main-project dependency install, no `scene.json.authoritativeMultiplayer`, no `logsPermissions`, no `isServer()` / `registerMessages()` code, no server/client entry split, and no preview launch from Codex.
- Rollback boundary:
  - Main-project rollback should not be needed because O1d is read-only for code/dependencies except this task log update.
  - If any scratch/temp project is used, it must live outside the main project and can be discarded without affecting Doge Hunt.
- Key question:
  - Distinguish whether the O1c failure was caused by the auth-server prerelease cohort itself, by mutating `node_modules` while Creator Hub/preview was already running, or by a narrower package mismatch such as inspector/asset-packs/SDK path compatibility.
- Main-project stable baseline:
  - User confirmed on 2026-06-30 that the restored standard SDK scene can preview normally and start the game.
  - Current main project dependency state:
    - `@dcl/sdk=7.23.2`
    - `@dcl/js-runtime=7.23.2`
    - `@dcl/sdk-commands=7.23.2`
    - `@dcl/inspector=7.25.0`
    - `@dcl/asset-packs=2.15.2` nested under `node_modules/@dcl/inspector/node_modules/@dcl/asset-packs`
    - `package-lock.json` mirror count: `mirrors.tencentyun.com=0`, `registry.npmjs.org=359`
  - Current main project server-keyword scan:
    - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server|@dcl/sdk/text-codec|7\.24\.3-28199504206|commit-1a6c780" scene.json package.json package-lock.json src` -> no matches.
  - Creator Hub / Decentraland were running during O1d evidence capture, but O1d did not stop them or mutate main-project dependencies.
- Current npm metadata check:
  - `@dcl/sdk@auth-server` still resolves to `7.24.3-28199504206.commit-1a6c780`.
  - Its dependency cohort remains:
    - `@dcl/ecs=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/react-ecs=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
  - `@dcl/sdk-commands@7.24.3-28199504206.commit-1a6c780` depends on `@dcl/inspector=7.34.3`.
  - `@dcl/inspector@7.34.3` depends on `@dcl/asset-packs=^2.15.3`, which currently resolves to `2.16.2`.
  - `@dcl/asset-packs@2.16.2` and `2.15.2` both declare `@dcl/ecs` peer dependency `^7.15.2`.
- Isolated auth-server scratch test:
  - Scratch path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
  - Installed with explicit Program Files npm CLI, temp npm cache, npmjs registry, `--replace-registry-host=always`, and `--ignore-scripts`.
  - Install result: `added 337 packages`.
  - Scratch package summary:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/inspector=7.34.3`
    - `@dcl/inspector/node_modules/@dcl/asset-packs=2.16.2`
    - `@dcl/inspector/node_modules/@dcl/ecs=7.24.2`
    - `node_modules/@dcl/sdk/text-codec.js` exists in the auth-server SDK.
  - First scratch build attempt failed because the temporary PowerShell-written `scene.json` had a UTF-8 BOM; this was a scratch file-generation issue, not an SDK compatibility issue.
  - Second scratch build attempt confirmed auth-server `sdk-commands build` auto-adds:
    - `scene.json.authoritativeMultiplayer = true`
    - `package.json scripts.server-logs = "sdk-commands sdk-server-logs"`
  - The second scratch build was blocked by sandbox directory access while building outside the workspace; rerunning with escalation reached TypeScript and exposed a minimal scratch `tsconfig` `inlineSources/sourceMap` mismatch.
  - Final scratch build after fixing `tsconfig` passed:
    - `node .\node_modules\@dcl\sdk-commands\dist\index.js build`
    - Result: bundle saved to `bin/index.js`, type checking completed without errors.
- O1d conclusion:
  - Auth-server cohort is not inherently build-broken in a clean project.
  - `@dcl/asset-packs@2.16.2` is compatible with the auth-server SDK because the auth-server SDK package includes `@dcl/sdk/text-codec`.
  - `@dcl/asset-packs@2.16.2` is not compatible with the restored standard SDK `7.23.2`, which is why O1c-R needed the narrow `@dcl/asset-packs=2.15.2` override.
  - The O1c runtime failure is therefore most likely caused by mutating the main project's tracked `node_modules` / SDK tooling cohort while Creator Hub or preview watcher was already running, causing inspector/esbuild watcher instability and `write EPIPE`.
  - A secondary unresolved risk remains: even if installed while Creator Hub is closed, the auth-server cohort plus Creator Hub preview runtime may still have runtime compatibility issues. O1d did not preview the scratch auth-server scene.
- Recommended next checkpoint:
  - Add O1e before O2.
  - O1e should not touch the main Doge Hunt project. It should use either the existing O1d scratch project or a fresh minimal auth-server scratch project, then manually test Creator Hub preview from a cold start after dependencies are already installed.
  - O1e success/failure will tell us whether Creator Hub can preview a clean auth-server scene at all. Only after that should we consider a main-project auth-server retry.

### 2026-06-30 - Phase O1e-a Isolated Auth-server CLI Preview Smoke Test

- Scope:
  - Continue validation after O1d without touching the main Doge Hunt project.
  - Use the existing scratch auth-server scene created during O1d.
  - Do not mutate main-project dependencies, `scene.json`, `src`, or Creator Hub state.
  - Avoid opening Explorer/browser/client windows by using CLI preview flags.
- Scratch project:
  - Path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
  - Dependencies:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
  - `scene.json.authoritativeMultiplayer=true`
  - `package.json scripts.server-logs="sdk-commands sdk-server-logs"`
- Command:
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js start --no-client --no-browser --no-watch -p 3799`
  - Started from the scratch project with Program Files Node.
  - Ran for approximately 25 seconds, then the started process tree was stopped.
- Process tree observed:
  - SDK start parent: `node.exe ... sdk-commands\dist\index.js start --no-client --no-browser --no-watch -p 3799`
  - Multiplayer server launch: `node.exe ... npx-cli.js --yes @dcl/hammurabi-server@next --realm=http://localhost:3799`
  - Hammurabi command: `hammurabi-server --realm=http://localhost:3799`
  - Esbuild service under the scratch `node_modules`.
- Network/preview result:
  - `http://127.0.0.1:3799` returned `HTTP 200 OK`.
  - After stopping the process tree, port `3799` was no longer listening.
- Relevant stdout:
  - `Babylon.js v6.4.1 - Null engine`
  - `Fetching realm info from: http://localhost:3799/about`
  - `[Hot Reoad]: Connected to development server...`
  - `[O1D] scratch main loaded 0`
  - `Server running - Type "r" + Enter to restart or [Ctrl+C] to exit`
  - `[Comms] Connected to livekit room preview-...`
- Relevant stderr:
  - `@dcl/sdk-commands start v7.24.3-28199504206.commit-1a6c780`
  - Bundling `src\index.ts`
  - `Type checking completed without errors`
  - `Starting preview server`
  - `Listening 0.0.0.0:3799`
  - `Starting Multiplayer Server with realm: http://localhost:3799`
  - `Preview server is now running!`
  - Warnings only: Node `punycode` deprecation and a Babylon empty vertex-data warning.
- O1e-a conclusion:
  - The auth-server SDK cohort can start a CLI preview server and Hammurabi multiplayer server in an isolated project.
  - This further reduces the likelihood that O1c failed because auth-server runtime is fundamentally unable to start.
  - O1c's `write EPIPE` remains most consistent with live main-project `node_modules` mutation while Creator Hub/preview watchers were active.
  - Remaining gap: Creator Hub UI cold-start smoke has not been executed. CLI preview does not fully exercise Creator Hub's project import/open flow or its UI wrapper around preview.
- Next smallest step:
  - O1e-b: Creator Hub cold-start smoke test against the scratch auth-server project.
  - This requires either manually opening/importing the scratch project in Creator Hub, or authorizing Codex to close/switch the current Creator Hub context. Do not run it against the main Doge Hunt project.

### 2026-06-30 - Phase O1e-b1 Automated Creator Hub Scratch Open Attempt

- Scope:
  - Continue O1e validation without touching the main Doge Hunt project.
  - Test whether Creator Hub can be cold-started directly into the isolated scratch auth-server scene.
  - Do not mutate main-project dependencies, `scene.json`, `src`, or tracked `node_modules`.
- Scratch project:
  - Path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
  - Same auth-server cohort and successful CLI-preview state as O1e-a.
- User authorization:
  - User selected option `2`, authorizing Codex to close/switch the current Creator Hub context for this isolated verification.
- Process cleanup before attempt:
  - Stopped active Creator Hub processes and related preview/tooling processes from the previous context.
  - Post-cleanup check showed no active Creator Hub, preview `sdk-commands`, Hammurabi, or esbuild process except Codex-owned helper processes.
- Attempted launch:
  - Started `C:\Users\sunch\AppData\Local\Programs\creator-hub\Decentraland Creator Hub.exe` with the scratch project path as an argument.
  - Creator Hub processes started, and the main process command line included the scratch path.
- Observed Creator Hub behavior:
  - `C:\Users\sunch\AppData\Roaming\creator-hub\logs\main.log` recorded:
    - `[Args] Parsing arguments: C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
    - `[Args] Handling argument: ... with prefix: --env=`
    - `[Args] Handling argument: ... with prefix: --open-devtools-with-port=`
  - Creator Hub then loaded existing workspace paths from its config, including the main Doge Hunt project, but did not add/open the scratch project.
  - No scratch `sdk-commands start`, Hammurabi, or esbuild child process appeared.
  - No preview port such as `3799`, `8000`, `7666-7669`, or `3000-3005` was listening for the scratch scene.
- App bundle check:
  - Read-only string inspection of `C:\Users\sunch\AppData\Local\Programs\creator-hub\resources\app.asar` found the argument handler map only contains:
    - `--env=`
    - `--open-devtools-with-port=`
  - No command-line project-open handler such as `openProject`, `openScene`, `scenePath`, or equivalent was found near the argument parser.
- Cleanup after attempt:
  - Stopped the Creator Hub processes started by this attempt.
  - Post-cleanup check showed no remaining Creator Hub, preview `sdk-commands`, Hammurabi, or esbuild processes.
- O1e-b1 conclusion:
  - This does not prove Creator Hub UI preview fails for auth-server scenes.
  - It proves this Creator Hub build does not support opening a scene by passing a raw project path on the command line, so Codex cannot complete the UI cold-start smoke test through that route.
  - O1e-a remains the strongest automated evidence: the isolated auth-server CLI preview and Hammurabi startup work.
  - The remaining Creator Hub-specific risk must be tested manually by importing/opening the scratch project in Creator Hub and pressing Preview after dependencies are already installed.
- Next smallest step:
  - O1e-b2: Manual Creator Hub scratch import/open + Preview.
  - Keep this pointed at the scratch project, not the main Doge Hunt project.
  - Record whether Creator Hub starts preview, whether Hammurabi appears, and the first relevant Creator Hub/console error if it fails.

### 2026-06-30 - Phase O1e-b2 Manual Creator Hub Scratch Preview

- Scope:
  - Verify the Creator Hub UI wrapper against the isolated scratch auth-server scene after the Creator Hub update.
  - Do not touch the main Doge Hunt project.
  - Treat this as Creator Hub/preview compatibility evidence only, not gameplay migration.
- Creator Hub update note:
  - Creator Hub config/log evidence shows `lastVersion="0.42.0"` and `installedAt="2026-06-30T19:20:16.720Z"`.
  - Because Creator Hub changed after O1e-b1, this checkpoint supersedes the old UI-wrapper evidence for current tooling.
- Scratch project:
  - Path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
  - SDK cohort:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
  - `scene.json.authoritativeMultiplayer=true`
- User action:
  - User manually clicked Preview in Creator Hub for the scratch auth-server project.
  - Creator Hub config added the scratch project path to `workspace.paths`.
- Creator Hub command observed:
  - `cli.start` target: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-o1d-auth-server-82e4dd3c20644117a52ec4e8ef919241`
  - Command: `sdk-commands start --explorer-alpha --hub --skip-auth-screen`
  - Working directory: the scratch auth-server project.
- Startup evidence:
  - `@dcl/sdk-commands start v7.24.3-28199504206.commit-1a6c780`
  - Bundled `src\index.ts`.
  - `Bundle saved bin/index.js`.
  - Type checker entered watch mode and reported `Found 0 errors. Watching for file changes.`
  - Preview HTTP server logged `Listening 0.0.0.0:8000`.
  - Creator Hub logged `Starting Multiplayer Server with realm: http://localhost:8000`.
  - Creator Hub logged `Preview server is now running!`.
  - Inspector attached via `inspector.attachSceneDebugger`.
- Process/port evidence:
  - Preview utility process `12180` owned port `8000`.
  - `esbuild.exe` process `35864` ran from the scratch `node_modules`.
  - TypeScript watch process `16280` ran against scratch `tsconfig.json`.
  - Hammurabi launch chain was present:
    - `36112`: `npx-cli.js --yes @dcl/hammurabi-server@next --realm=http://localhost:8000`
    - `18956`: `cmd.exe ... hammurabi-server --realm=http://localhost:8000`
    - `40256`: `@dcl/hammurabi-server\dist\cli.js --realm=http://localhost:8000`
  - `Invoke-WebRequest http://127.0.0.1:8000/about` returned `HTTP 200`.
  - `/about` response included `healthy:true`, `comms.healthy:true`, and `realmName:"LocalPreview"`.
- Scene/runtime evidence:
  - Babylon null engine started.
  - Realm info was fetched from `http://localhost:8000/about`.
  - Hot reload connected to the scratch scene.
  - Scene logs started and printed `[O1D] scratch main loaded 0`.
  - LiveKit connected to a `preview-...` room.
- Warnings / non-blocking notes:
  - `npm outdated --depth=0 --json @dcl/sdk @dcl/js-runtime` exited with code `1` during Creator Hub dependency checks; preview still started successfully afterward, so this is not treated as the failure point.
  - Node warning observed: `[DEP0190] Passing args to a child process with shell option true...`; non-blocking for this checkpoint.
  - Babylon warning about empty vertex data was previously seen in CLI preview and did not block startup.
- O1e-b2 conclusion:
  - Updated Creator Hub `0.42.0` can manually open/import and preview the isolated auth-server scratch scene.
  - The auth-server SDK cohort, Creator Hub preview wrapper, inspector attach path, esbuild watch, TypeScript watch, and Hammurabi startup all worked together in the isolated project.
  - No `write EPIPE`, disappearing-scene symptom, or immediate preview crash was observed during the logged window.
  - Combined with O1c-R and O1e-a, the O1c failure is now most consistent with mutating the main project's SDK/inspector `node_modules` while Creator Hub/preview watchers were active, rather than auth-server being fundamentally incompatible with Creator Hub.
- Next smallest step:
  - Proceed to O2 only after stopping preview/Creator Hub or otherwise ensuring no main-project watcher is active.
  - O2 should still be main-project config-only: add required authoritative `scene.json` fields after confirming `logsPermissions`, validate JSON/build, and stop for review.
- Post-preview cleanup:
  - User closed Creator Hub after the successful scratch preview.
  - Background check found one remaining Hammurabi-related Creator Hub child process:
    - `40256`: `@dcl\hammurabi-server\dist\cli.js --realm=http://localhost:8000`
  - Stopped PID `40256`.
  - Follow-up process scan showed no remaining Creator Hub, scratch preview, Hammurabi, or scratch esbuild process.
  - Follow-up port scan showed no listener on `8000` or `3799`.

### 2026-06-30 - Phase O1f Main-project Auth-server Dependency Retry

- Scope:
  - Retry the main-project auth-server dependency switch under safer conditions after O1e-b2 passed.
  - Dependency-only checkpoint: no `scene.json.authoritativeMultiplayer`, no `logsPermissions`, no `isServer()` branch, no `registerMessages()`, no server/client entry split, and no preview launch.
  - Keep the change small enough that package/build failures can be isolated from gameplay code.
- Why this is needed before O2:
  - O1c-R intentionally restored the main project to standard SDK `7.23.2`.
  - The auth-server APIs and authoritative preview runtime require the auth-server SDK cohort.
  - Therefore O2 should not add authoritative `scene.json` config until the main project dependencies are back on the auth-server cohort and pass build checks.
- Current pre-O1f dependency state:
  - `package.json` dependencies:
    - `@dcl/sdk=7.23.2`
    - `@dcl/js-runtime=7.23.2`
    - `@dcl/sdk-commands=7.23.2`
  - `package.json` has a rollback-only override:
    - `@dcl/asset-packs=2.15.2`
  - `scene.json` has `worldConfiguration.name = playandearn.dcl.eth`.
  - `scene.json` does not have `authoritativeMultiplayer` or `logsPermissions`.
- Pre-O1f hashes:
  - `package.json`: SHA256 `7885B469A51C7D35D3E0908B8C7F33AEC486F6AB1DC07CFBF96D050FDCEABB6B`
  - `package-lock.json`: SHA256 `99C567B81E3766064FE44834E82B4BF8FCCF1A9AB19D6BEF55931812742D0318`
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Rollback boundary:
  - If O1f fails, restore the dependency state to standard SDK `7.23.2` with the `@dcl/asset-packs=2.15.2` override, then rerun `npm ls`, `tsc --noEmit`, SDK build, and server-keyword scope scan.
  - Do not proceed to O2 until O1f passes.
- Planned command style:
  - Use explicit Program Files npm CLI, not bare `npm` / `npx`.
  - Use temp cache: `%TEMP%\doge-hunt-npm-cache`.
  - Use npmjs registry with `--replace-registry-host=always`.
  - Use `--ignore-scripts --no-audit --no-fund`.
- Commands run:
  - Version check:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ view @dcl/sdk@auth-server version dependencies --json`
    - Result: `@dcl/sdk@auth-server` still resolves to `7.24.3-28199504206.commit-1a6c780`.
  - Package edit:
    - Removed rollback-only `package.json` override `@dcl/asset-packs=2.15.2`.
  - Dependency install:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" --registry=https://registry.npmjs.org/ --replace-registry-host=always install @dcl/sdk@auth-server @dcl/js-runtime@7.24.3-28199504206.commit-1a6c780 @dcl/sdk-commands@7.24.3-28199504206.commit-1a6c780 --save-exact --ignore-scripts --no-audit --no-fund`
    - Result: `added 4 packages, removed 3 packages, and changed 12 packages in 19s`.
  - Dependency verification:
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/sdk @dcl/js-runtime @dcl/sdk-commands --depth=0` -> passed.
    - `node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" --cache "$env:TEMP\doge-hunt-npm-cache" ls @dcl/asset-packs` -> passed; nested `@dcl/asset-packs=2.16.2` under `@dcl/inspector=7.34.3`.
  - Build/type verification:
    - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
    - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed with `@dcl/sdk-commands build v7.24.3-28199504206.commit-1a6c780`.
    - Warning: Node `punycode` deprecation remains.
    - SDK build auto-added `scene.json.authoritativeMultiplayer=true` and `scripts.server-logs="sdk-commands sdk-server-logs"`; both were removed immediately to keep O1f dependency-only.
  - Final scope scan:
    - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server" scene.json package.json src` -> no matches.
  - Lockfile registry check:
    - `mirrors.tencentyun.com=0`
    - `registry.npmjs.org=360`
- Final O1f dependency state:
  - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
  - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
  - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
  - `@dcl/inspector=7.34.3`
  - `@dcl/asset-packs=2.16.2` nested under `@dcl/inspector`
- Final O1f file state:
  - `package.json`: auth-server SDK cohort, no `server-logs`, no `overrides`.
  - `package-lock.json`: auth-server SDK cohort and npmjs registry URLs.
  - `scene.json`: content restored to pre-O1f state; no authoritative fields.
  - `tsconfig.json`: unchanged.
  - Build generated updates remain in tracked `bin/index.js` and `main.crdt`.
  - Tracked `node_modules` reflects the auth-server dependency install.
- Final hashes after O1f:
  - `package.json`: SHA256 `730DED284B0FA3622CBA4A4FB3A1A91FB2A724596F8AB100295C945780D18421`
  - `package-lock.json`: SHA256 `4741D9C338596490F16ABF177F9067E1EA634CA8592CA677899F31E99E4F1334`
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- O1f conclusion:
  - Main project dependency install now matches the isolated auth-server cohort that passed O1e-a/O1e-b2.
  - No Creator Hub or preview process was running during the dependency switch.
  - No `scene.json` authoritative config or source-code server branching remains after O1f.
  - Proceed to O2 only after confirming the wallet address for `logsPermissions`.

### 2026-06-30 - Phase O2 Minimal Authoritative Scene Config

- Scope:
  - Add only the required authoritative scene config fields now that O1f dependencies passed.
  - No source code changes.
  - No `isServer()` entry branch.
  - No `registerMessages()`.
  - No gameplay migration.
  - No preview launch.
- User-provided log wallet:
  - `0x797066a17F83425C1B4C7a8Cca52D19095520a52`
- Intended `scene.json` additions:
  - `authoritativeMultiplayer: true`
  - `logsPermissions: ["0x797066a17F83425C1B4C7a8Cca52D19095520a52"]`
  - Keep existing `worldConfiguration.name = playandearn.dcl.eth`.
- Pre-O2 safety checks:
  - Background check found no Creator Hub, preview `sdk-commands`, Hammurabi, scratch preview, or esbuild watcher processes.
  - No listeners on ports `8000` or `3799`.
  - Pre-O2 scope scan:
    - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server" scene.json package.json src` -> no matches.
- Pre-O2 hashes:
  - `package.json`: SHA256 `730DED284B0FA3622CBA4A4FB3A1A91FB2A724596F8AB100295C945780D18421`
  - `package-lock.json`: SHA256 `4741D9C338596490F16ABF177F9067E1EA634CA8592CA677899F31E99E4F1334`
  - `scene.json`: SHA256 `AD4006116E9BECAF3DBA118496FC8ACDA1D80C230C9CC828633F0433EB3AF6B3`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Rollback boundary:
  - If O2 fails, remove only `authoritativeMultiplayer` and `logsPermissions` from `scene.json`, and remove any auto-added `scripts.server-logs` if it appears during build verification.
  - Dependencies from O1f should remain unchanged unless the failure directly points to dependency corruption.
- Files changed by O2:
  - `scene.json`: added `authoritativeMultiplayer: true` and `logsPermissions`.
  - `package.json`: SDK build auto-added `scripts.server-logs = "sdk-commands sdk-server-logs"`; kept intentionally for later server log debugging.
  - `bin/index.js` and `main.crdt`: regenerated by SDK build.
  - `tasks.md`: O2 logging.
  - No source files changed.
- Commands run:
  - JSON validation:
    - `node -e "JSON.parse(require('fs').readFileSync('scene.json','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('json ok')"` -> passed.
  - TypeScript:
    - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
  - SDK build:
    - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed with `@dcl/sdk-commands build v7.24.3-28199504206.commit-1a6c780`.
    - Warning: Node `punycode` deprecation remains.
    - Build side effect: added `scripts.server-logs`.
  - Final scope scan:
    - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server" scene.json package.json src`
    - Matches are limited to:
      - `scene.json.authoritativeMultiplayer`
      - `scene.json.logsPermissions`
      - `package.json scripts.server-logs`
    - No `src` server API, `isServer()`, or `registerMessages()` matches.
- Final O2 hashes:
  - `package.json`: SHA256 `E4D4CACD70F15D0AFBFCA2F7B04D0AE3B167BD4EF5F0FC99FEDC9710BE8E41B3`
  - `package-lock.json`: SHA256 `4741D9C338596490F16ABF177F9067E1EA634CA8592CA677899F31E99E4F1334`
  - `scene.json`: SHA256 `A57C713871EA2A34B5F28E8F4AB0F866CA4963229775DA2035DA01A4FA83C0AC`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- O2 conclusion:
  - Main project now has the minimal authoritative scene configuration required by the auth-server SDK.
  - `logsPermissions` is set to the user-provided Creator Hub wallet address.
  - Build/type checks pass.
  - No source-level server/client branching or message registration exists yet.
  - Next phase should be O2a preview smoke before O3, so scene-config/runtime issues are not mixed with entry-branch code changes.

### 2026-06-30 - Phase O2a Authoritative Config Preview Smoke

- Status: Failed / rolled back.
- Scope:
  - Manually preview the main project after O2, before O3.
  - No code changes.
  - No dependency changes.
  - No `isServer()` branch.
  - No `registerMessages()`.
  - No gameplay migration.
- Purpose:
  - Validate that the main project with `authoritativeMultiplayer=true` and `logsPermissions` can start in Creator Hub before adding any source-level server/client branching.
  - Separate scene-config / Creator Hub / Hammurabi runtime risk from O3 source-code risk.
- Evidence to capture:
  - Creator Hub launches `sdk-commands start` from the main project path.
  - Preview HTTP server starts and listens.
  - Hammurabi / multiplayer server starts.
  - TypeScript watch reports zero errors.
  - Scene logs begin.
  - No `write EPIPE`, empty-scene symptom, or immediate crash.
  - If it fails, record the first relevant Creator Hub / console / process error and stop before O3.
- Rollback boundary:
  - If O2a fails due scene config, remove only O2 additions (`authoritativeMultiplayer`, `logsPermissions`, and `scripts.server-logs`) and keep O1f dependencies intact unless evidence points to dependency corruption.
- User-observed failure:
  - `BJS - [20:50:15]: Babylon.js v6.4.1 - Null engine`
  - `Fetching realm info from: http://localhost:8000/about`
  - `entities/active FAILED in 15016ms (attempt 1/2): http://localhost:8000/content/entities/active`
  - `entities/active FAILED in 15008ms (attempt 2/2): http://localhost:8000/content/entities/active`
  - `entities/active gave up after 2 attempt(s)`
  - `Failed to start: timeout after 15000ms`
- Captured Creator Hub evidence:
  - Main project preview started from:
    - `D:\Files\02_Project\01_Metaverse\MetaLiveStudio\02_3rdPartyWorks\2026\Decoy Doge\Doge Hunt Proof of Concept`
  - Creator Hub ran:
    - `sdk-commands start --explorer-alpha --hub --skip-auth-screen`
  - SDK command version:
    - `@dcl/sdk-commands start v7.24.3-28199504206.commit-1a6c780`
  - Preview startup reached:
    - `Bundle saved bin/index.js`
    - `Starting preview server`
    - `Listening 0.0.0.0:8000`
    - `Starting Multiplayer Server with realm: http://localhost:8000`
    - `Preview server is now running!`
    - `Found 0 errors. Watching for file changes.`
    - `inspector.attachSceneDebugger` for the main project path.
  - Failure then occurred in the content endpoint:
    - `entities/active FAILED in 15016ms (attempt 1/2)`
    - `entities/active FAILED in 15008ms (attempt 2/2)`
    - `Failed to start: timeout after 15000ms`
  - Creator Hub later killed the SDK start process `38280` gracefully.
  - A lingering Hammurabi-related child process remained:
    - PID `5844`: `@dcl\hammurabi-server\dist\cli.js --realm=http://localhost:8000`
  - Stopped PID `5844`.
  - Follow-up process and port checks showed no remaining matching preview/Hammurabi process and no listener on `8000` or `3799`.
- O2 rollback performed:
  - Removed `scene.json.authoritativeMultiplayer`.
  - Removed `scene.json.logsPermissions`.
  - Removed `package.json scripts.server-logs`.
  - Kept O1f auth-server dependencies unchanged.
- Post-rollback verification:
  - JSON parse for `scene.json` and `package.json` passed.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server" scene.json package.json src` -> no matches.
  - `npm ls @dcl/sdk @dcl/js-runtime @dcl/sdk-commands --depth=0` passed with all three at `7.24.3-28199504206.commit-1a6c780`.
  - SDK build was intentionally not rerun after rollback because auth-server `sdk-commands build` auto-adds O2 config fields when they are absent.
- O2a conclusion:
  - The user's concern was correct: O2 needed a preview smoke before O3.
  - O3 was not started, so the failure is isolated from source-level server/client branching.
  - Current active state is back to O1f: auth-server dependency cohort installed, but authoritative scene config disabled.
  - Next step should be risk analysis and a smaller diagnostic plan before reattempting scene config.

### 2026-06-30 - O1f Replay Failure / Auto-Mutation Finding

- Status: O1f file state restored, but O1f is not preview-safe in the main project.
- Trigger:
  - User retried Creator Hub preview after O2 rollback, expecting the dependency-only O1f checkpoint.
  - Preview log included a scene reload, LiveKit connection, then two failed content endpoint attempts:
    - `entities/active FAILED in 15002ms (attempt 1/2): http://localhost:8000/content/entities/active`
    - `entities/active FAILED in 15001ms (attempt 2/2): http://localhost:8000/content/entities/active`
    - `Error: timeout after 15000ms`
- Finding:
  - With the auth-server SDK cohort installed, `sdk-commands start` is not read-only for this project.
  - It auto-wrote back:
    - `scene.json.authoritativeMultiplayer=true`
    - `package.json scripts.server-logs="sdk-commands sdk-server-logs"`
  - This means the practical preview state was pushed back into O2-like authoritative mode even after O2's fields had been removed.
- Cleanup:
  - Stopped remaining Creator Hub / preview / Hammurabi / esbuild / TypeScript watch remnants.
  - Follow-up retry confirmed both risk symptoms at once:
    - `scene.json.authoritativeMultiplayer=true` and `package.json scripts.server-logs` were present again after preview.
    - Running processes included Decentraland PID `20092`, Creator Hub PIDs `7084`, `8960`, `25344`, `25504`, `34172`, `38756`, `39864`, `41000`, `42616`, and project `esbuild` PID `10704`.
    - User preview log again failed at `/content/entities/active` after `15003ms` and `15009ms`.
  - Stopped those Creator Hub / Decentraland / esbuild processes.
  - Removed the auto-written `authoritativeMultiplayer` and `server-logs` fields again.
  - Confirmed no Creator Hub / Decentraland / esbuild / Hammurabi process remained, except Codex's own `node_repl` processes.
  - Confirmed no preview/Hammurabi listener remained on `8000` or `3799`.
- Current file state:
  - `package.json`: auth-server SDK cohort remains from O1f, no `server-logs`.
  - `scene.json`: no `authoritativeMultiplayer` and no `logsPermissions`.
  - `src`: no `isServer()` branch, no `registerMessages()`, no `@dcl/sdk/server` imports.
- Conclusion:
  - The failure is earlier than source-code server branching and earlier than any gameplay migration.
  - O1f is only useful as an install/API checkpoint; it should not be treated as a safe Creator Hub preview checkpoint.
  - The safest playable rollback target is O1c-R / standard SDK `7.23.2` with the `@dcl/asset-packs=2.15.2` override.
  - Any next auth-server diagnostic should avoid previewing the main project until it isolates why `/content/entities/active` times out under the auth-server cohort.

### 2026-06-30 - O1f-R Rollback to Standard SDK Baseline

- Status: Completed.
- Purpose:
  - Restore a previewable single-player baseline after proving O1f auth-server dependencies are not safe to preview in the main project.
  - Avoid further Creator Hub preview attempts while the main project is on the auth-server SDK cohort.
- Files changed:
  - `package.json`: restored standard SDK versions and added the rollback override:
    - `@dcl/sdk=7.23.2`
    - `@dcl/js-runtime=7.23.2`
    - `@dcl/sdk-commands=7.23.2`
    - `overrides["@dcl/asset-packs"]="2.15.2"`
  - `package-lock.json`: synchronized by npm to standard SDK `7.23.2`.
  - Tracked `node_modules`: synchronized back to standard SDK `7.23.2`.
  - `bin/index.js` and `main.crdt`: regenerated by standard SDK build.
  - `scene.json`: no authoritative config remains.
  - `tasks.md`: rollback log.
- Process cleanup before rollback:
  - Stopped lingering Decentraland / Creator Hub / esbuild processes from the failed preview.
  - Final process checks showed no Creator Hub / Decentraland / esbuild / Hammurabi process, except Codex's own `node_repl`.
  - No listeners on `8000` or `3799`.
- Dependency sync:
  - First npm install attempt timed out in the sandbox after registry fetches repeatedly hit `EACCES`, leaving `package.json` ahead of `package-lock.json` / `node_modules`.
  - Re-ran the same npm install with approved network access:
    - Result: `added 11 packages, removed 12 packages, and changed 11 packages in 13s`.
    - Warning: `glob@11.1.0` deprecation warning from npm; not blocking.
- Verification:
  - `npm ls @dcl/sdk @dcl/js-runtime @dcl/sdk-commands @dcl/asset-packs --all --depth=2`:
    - `@dcl/sdk@7.23.2`
    - `@dcl/js-runtime@7.23.2`
    - `@dcl/sdk-commands@7.23.2`
    - `@dcl/ecs@7.23.2`
    - `@dcl/react-ecs@7.23.2`
    - `@dcl/inspector@7.25.0 -> @dcl/asset-packs@2.15.2 overridden`
  - `node .\node_modules\typescript\bin\tsc --noEmit` -> passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` -> passed with `@dcl/sdk-commands build v7.23.2`.
  - `rg -n "authoritativeMultiplayer|logsPermissions|server-logs|isServer\(|registerMessages|@dcl/sdk/server|@auth-server|7\.24\.3-28199504206|commit-1a6c780" scene.json package.json package-lock.json src` -> no matches.
- Final hashes:
  - `package.json`: SHA256 `51B2AEB9056EB7B768F5EB78AE9D8E88879FBD73734C7C1824F2ED5F7406F238`
  - `package-lock.json`: SHA256 `D574FB620BD8E40574DDFDC5A2130EF25D6EECB01B79DF4DEEC78BCF6C2529CE`
  - `scene.json`: SHA256 `0C1CA22B677C03028AC825A9FE6306F8E4BDE04DF3608A82651A275074E504DB`
  - `tsconfig.json`: SHA256 `62A395C156D1DE43BED270049C68A273B7F0D31BE4AE6F14D6AF827CE9221375`
- Conclusion:
  - Main project is back on standard SDK and should no longer auto-write authoritative fields during normal build.
  - Preview was not launched by Codex; the next preview should be treated as a standard single-player smoke test, not an auth-server test.
  - Future auth-server work should happen in an isolated diagnostic branch/project or with a much narrower reproduction of `/content/entities/active` before reintroducing the auth-server SDK into the main project.

### 2026-06-30 - O1f-R Standard SDK Preview Smoke

- Status: Completed.
- Trigger:
  - User ran/opened Creator Hub preview after O1f-R.
- Result:
  - User confirmed the project works again.
- Conclusion:
  - The current standard SDK `7.23.2` rollback state is the active playable single-player baseline.
  - The previous `/content/entities/active` failure is tied to the auth-server dependency/config path, not the local gameplay phases A-N.
  - Do not reintroduce the auth-server SDK cohort into the main project until a smaller isolated reproduction explains the content endpoint timeout.

### 2026-06-30 / 2026-07-01 - OQ Auth-server Content Endpoint Ladder

- Status: Completed.
- Purpose:
  - Reproduce the main-project `/content/entities/active` timeout outside the playable Doge Hunt project.
  - Add Doge Hunt traits one by one to distinguish content-scan failure from Creator Hub / Explorer wrapper failure.
- Diagnostic project:
  - Path: `C:\Users\sunch\AppData\Local\Temp\doge-hunt-auth-ladder-20260630`
  - Created via `sdk-commands init --project scene-template --skip-install`.
  - Installed auth-server cohort:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
  - Added `authoritativeMultiplayer=true`, `logsPermissions`, and `worldConfiguration.name=playandearn.dcl.eth`.
- Direct endpoint test method:
  - Start isolated CLI preview with no browser/client/watch on port `3799`.
  - Wait for `/about` HTTP 200.
  - POST `{"pointers":["0,0"]}` to `/content/entities/active` with a 20s timeout.
  - Stop the preview process tree after each run.
- Results:
  - OQ0 official auth template: `/content/entities/active` HTTP 200 in `26ms`, `2022` bytes.
  - OQ1 Doge Hunt 36 parcels/spawn only: HTTP 200 in `23ms`, `2915` bytes.
  - OQ2 Doge Hunt scene metadata/source/feature toggles: HTTP 200 in `26ms`, `3509` bytes.
  - OQ3 Doge Hunt `assets` + `models` copied, about `15.43MB`: HTTP 200 in `31ms`, `4888` bytes.
  - OQ4 Doge Hunt `src` + assets/models, auth-server build passed: HTTP 200 in `34ms`, `5206` bytes.
  - OQ5 removed diagnostic `.dclignore` and copied `dclcontext`/docs to mimic root clutter: HTTP 200 in `34ms`, `5821` bytes.
  - OQ5 Creator Hub manual preview:
    - User confirmed the middle-sized repro project can preview in Creator Hub.
    - This means Doge Hunt content, assets, source, metadata, and root docs are not enough to reproduce the main-project failure in the isolated temp project.
  - OQ6 Hub flags without client launch:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` became ready.
    - `/content/entities/active` returned HTTP 200 in `119ms`, `6186` bytes.
    - Conclusion: hidden Hub flags do not by themselves reproduce the timeout when Explorer is not launched.
  - OQ7 direct Explorer-alpha/Hub client launch:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-watch -p 3799`.
    - SDK started preview on `3799` and opened a desktop client deep link with `hub=true&skip-auth-screen=true`.
    - Logs show scene startup:
      - `Doge Hunt Proof of Concept loaded. Trust No Doge.`
      - `[Lobby] Creating lobby...`
      - model content requests returned HTTP 200.
      - LiveKit connected to the preview room.
    - Direct follow-up `/content/entities/active` returned HTTP 200 in `378ms`, `6504` bytes while OQ7 was running.
    - Non-blocking error observed in the stderr log:
      - `RemoteError: Cannot read properties of undefined (reading 'bind')`
    - User later manually previewed through Creator Hub on port `8000` and confirmed preview can proceed normally.
    - During the user-run Creator Hub preview, a direct `/content/entities/active` probe returned HTTP 200 in `380ms`, `6504` bytes.
    - Console still prints the same non-blocking baseline error:
      - `RemoteError: Cannot read properties of undefined (reading 'bind')`
    - Scene logs, content fetches, and LiveKit connection continue after that error.
- Important side note:
  - The first OQ4 copy left the template `src/ui.tsx` in place and caused false build errors. The diagnostic `src` directory was then deleted and recopied cleanly from Doge Hunt; the corrected OQ4 build passed.
- Current interpretation:
  - Doge Hunt parcels, metadata, assets, models, source bundle, generated `bin/index.js`, and root docs do not reproduce the content endpoint timeout in an isolated CLI auth-server preview.
  - The remaining likely failure layer is not game content itself; it is likely one of:
    - Creator Hub / Explorer-alpha client launch path.
    - The exact main project directory/tooling state after dependency mutation.
    - Concurrent Creator Hub / preview watcher behavior.
    - A difference between direct CLI endpoint probing and Explorer's startup request sequence.
- Current interpretation:
  - OQ0-OQ6 and the OQ7 logs reduce the likelihood that the failure is caused by:
    - Doge Hunt content size.
    - Parcel count.
    - Scene metadata/source fields.
    - Auth-server SDK direct CLI preview.
    - Hub flags alone.
    - The isolated Creator Hub / Explorer-alpha preview path.
  - Remaining highest-value suspects:
    - Exact main project directory/tooling state after in-place dependency mutation.
    - Watcher/concurrent process contamination during the dependency switch.
    - A main-project-specific `node_modules` / package-lock state that the temp repro does not yet mirror.
    - Main project path/working-directory quirks not represented by the temp repro.

### 2026-07-01 - OQ8a Auth-server Path-shape Reproduction

- Status: Completed.
- Purpose:
  - Test whether the main project's Windows path shape (spaces and path length) is enough to reproduce the auth-server `/content/entities/active` failure outside the playable Doge Hunt project.
- Setup:
  - First attempted a very long copied diagnostic path:
    - `C:\Users\sunch\AppData\Local\Temp\OQ8 Long Path Test With Spaces\Files 02_Project\01 Metaverse\MetaLiveStudio\02 3rdPartyWorks\2026\Decoy Doge\Doge Hunt Proof of Concept Auth Server Repro Long Path`
    - Path length: `197`.
    - Main project path length: `107`.
    - This produced noisy `node_modules` traversal/path errors and was rejected as an unclean test because it was much longer than the real main project path.
  - Created a cleaner OQ8a copy from the working OQ5 diagnostic project:
    - Path: `C:\Users\sunch\AppData\Local\Temp\02 Project\MetaLiveStudio\2026\Decoy Doge\Doge Hunt Proof of Concept OQ8a`
    - Path length: `107`, matching the main project.
    - Includes spaces in the path.
    - Display title changed to `Auth Ladder OQ8a - Main Path Shape Repro`.
- Verification:
  - Auth-server cohort preserved:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
  - `scene.json` still has `authoritativeMultiplayer=true`, `worldConfiguration.name=playandearn.dcl.eth`, and the user's `logsPermissions` wallet.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed after rerunning outside the sandbox; the sandboxed attempt failed with `Access is denied` while esbuild tried to inspect parent directories, so that first failure was treated as a sandbox false positive.
  - Direct endpoint probe method was corrected:
    - PowerShell `Invoke-WebRequest` and naive `curl --data-raw` introduced false failures/hangs.
    - The reliable method uses `curl.exe --max-time`, waits for the runtime log `Server running`, and sends the JSON body from a temp file via `--data-binary @body.json`.
    - The OQ5 short-path control returned `/content/entities/active` HTTP `200` in about `239ms`, `6504` bytes.
    - OQ8a returned `/content/entities/active` HTTP `200` in about `241ms`, wall-clock `273ms`, `8259` bytes.
  - OQ8a Creator Hub manual preview:
    - User confirmed the project can preview successfully through Creator Hub on port `8000`.
    - Console showed:
      - `Found 0 errors. Watching for file changes.`
      - `/about` fetched from `http://localhost:8000/about`.
      - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')`.
      - Scene logs started normally: `Doge Hunt Proof of Concept loaded. Trust No Doge.`, `[Lobby] Creating lobby...`, start button entity/click handler created.
      - Model content requests for `MoonLobby1.glb` and `roblox_doge_hat.glb` returned HTTP `200`.
      - LiveKit connected to the preview room.
  - OQ8a logs still show the known non-blocking baseline error:
    - `RemoteError: Cannot read properties of undefined (reading 'bind')`
    - Scene logs, model content requests, and LiveKit connection continue after it.
- Current interpretation:
  - Matching the main project path length and using spaces is not enough to reproduce the main-project `/content/entities/active` timeout.
  - The isolated Creator Hub / Explorer-alpha preview path also works when the copied Doge auth-server project is clean.
  - The strongest remaining suspects are main-project-specific mutation state, watcher/process contamination during in-place dependency switching, or a package-lock/node_modules state difference that has not yet been mirrored by the temp repro.

### 2026-07-01 - OQ09 Main-copy Auth-server Reinstall Reproduction

- Status: Completed.
- Purpose:
  - Test whether the current real main-project working tree, copied fresh to temp and then reinstalled to the auth-server cohort, reproduces the main-project `/content/entities/active` timeout without touching the real main project.
- Cleanup before setup:
  - Stopped prior OQ8a Creator Hub / preview / Hammurabi / esbuild remnants.
  - Cleared remaining port `8000` listener owned by a Creator Hub utility process.
  - Confirmed `3799` / `8000` were free before the OQ09 backend test.
- Setup:
  - Copied the current main project working tree to:
    - `C:\Users\sunch\AppData\Local\Temp\02 Project\MetaLiveStudio\2026\Decoy Doge\Doge Hunt Proof of Concept OQ09`
    - Path length: `107`, matching the main project.
  - Excluded `.git`; copied project files, generated files, package files, and `node_modules`.
  - Initial copied state:
    - `@dcl/sdk=7.23.2`
    - `@dcl/js-runtime=7.23.2`
    - `@dcl/sdk-commands=7.23.2`
    - `@dcl/asset-packs=2.15.2`
    - no `authoritativeMultiplayer`, no `logsPermissions`.
  - Installed the already-verified auth-server exact cohort inside OQ09 only:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
    - `@dcl-sdk/utils=1.4.0`
  - Kept the copied main-project override:
    - `overrides["@dcl/asset-packs"]="2.15.2"`
  - Added OQ09-only authoritative config:
    - `authoritativeMultiplayer=true`
    - `worldConfiguration.name=playandearn.dcl.eth`
    - `logsPermissions=["0x797066a17F83425C1B4C7a8Cca52D19095520a52"]`
    - `scripts.server-logs="sdk-commands sdk-server-logs"`
    - display title `Auth Ladder OQ09 - Main Copy Reinstall Repro`.
- Verification:
  - `rg` found no O3/server-branch code in `src`:
    - no `isServer(`, no `registerMessages`, no `@dcl/sdk/server`, no `AUTH_SERVER`, no `validateBeforeChange`.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed.
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `233ms`, wall-clock about `418ms`, `4328` bytes.
    - Model content requests returned HTTP `200`.
    - LiveKit connected to the preview room.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
    - Preview processes were stopped after the probe; no `3799` listener remained.
  - OQ09 Creator Hub manual preview:
    - User confirmed the project can preview successfully through Creator Hub on port `8000`.
    - Console showed:
      - `/about` fetched from `http://localhost:8000/about`.
      - One hot-reload/reload cycle: `Change detected for scene ... reloading...`.
      - `Server running`.
      - LiveKit connected to the preview room.
      - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` printed twice.
      - Scene logs started normally: `Doge Hunt Proof of Concept loaded. Trust No Doge.`, UI setup, lobby creation, start button entity/click handler created.
      - Model content requests for `MoonLobby1.glb` and `roblox_doge_hat.glb` returned HTTP `200`.
- Current interpretation:
  - The current main-project working tree, when copied cleanly to temp and reinstalled to the auth-server cohort, does not reproduce the `/content/entities/active` failure in backend or Creator Hub preview.
  - The main failure is therefore more likely tied to in-place mutation of the real project while Creator Hub/watchers/processes were active, or to stale process/cache state around the real project path, rather than to Doge content, path shape, or package-lock/node_modules content alone.

### 2026-07-01 - O2 Retry Main-project Cold-start

- Status: Backend probe passed; manual Creator Hub preview failed on the real main project path.
- Purpose:
  - Reattempt the main-project authoritative config checkpoint only after the OQ7 / OQ8a / OQ09 diagnostics showed clean temp projects can preview through Creator Hub.
  - Keep the step narrow and reversible: dependency/config only, no server/client source branching and no gameplay migration.
- Preconditions:
  - User explicitly requested cleanup and main-project cold-start O2 retry.
  - Creator Hub / Decentraland / preview / Hammurabi / watch processes were checked before mutation.
  - Ports `8000` and `3799` were clear before mutation.
- Intended scope:
  - Install the already-verified exact auth-server cohort in the real main project:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
    - `@dcl-sdk/utils=1.4.0`
  - Keep the existing `@dcl/asset-packs=2.15.2` override.
  - Add only minimal authoritative scene/config fields:
    - `scene.json.authoritativeMultiplayer=true`
    - `scene.json.logsPermissions=["0x797066a17F83425C1B4C7a8Cca52D19095520a52"]`
    - `scene.json.worldConfiguration.name=playandearn.dcl.eth`
    - `package.json scripts.server-logs="sdk-commands sdk-server-logs"`
  - Run build/type checks and a no-client `/content/entities/active` probe.
  - Stop all probe processes before asking the user to manually preview.
- Out of scope:
  - No `src` changes.
  - No `isServer()` branch.
  - No `registerMessages()`.
  - No server gameplay logic.
  - No Codex-launched Creator Hub preview.
- Rollback boundary:
  - The safe playable rollback remains standard SDK `7.23.2` plus `@dcl/asset-packs=2.15.2`, with authoritative scene fields and `server-logs` removed.
- Execution:
  - Pre-mutation cleanup found no Creator Hub / Decentraland / preview / Hammurabi / watch remnants.
  - Ports `8000` and `3799` were clear.
  - Installed the exact auth-server cohort in the real main project using explicit Program Files npm CLI and temp cache `C:\Users\sunch\AppData\Local\Temp\npm-cache-main-o2-retry`.
  - npm install completed with existing audit warnings (`16 vulnerabilities`) and `glob@11.1.0` deprecation warning; no install failure.
  - Final installed versions:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
    - `@dcl-sdk/utils=1.4.0`
  - Kept `overrides["@dcl/asset-packs"]="2.15.2"`.
  - Added `scripts.server-logs`, `scene.json.authoritativeMultiplayer=true`, and `scene.json.logsPermissions`.
  - `rg` confirmed no O3/server source code was added:
    - no `isServer(`, no `registerMessages`, no `@dcl/sdk/server`, no `AUTH_SERVER`, no `validateBeforeChange`.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Build regenerated tracked generated artifacts:
    - `assets/scene/main.composite`
    - `bin/index.js`
    - `main.crdt`
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `241ms`, wall-clock about `338ms`, `4254` bytes.
    - Model content requests returned HTTP `200`.
    - LiveKit connected to the preview room.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
    - Probe process tree was stopped after the test.
  - Post-probe cleanup check:
    - No listeners on `8000` or `3799`.
    - No main-project preview / Creator Hub / Decentraland related process remained.
- Current interpretation:
  - The real main project now passes the O2 retry backend gate under cold-start conditions.
  - The previous main-project `/content/entities/active` timeout has not reproduced in this cold-start retry.
  - Manual Creator Hub preview is still required before treating O2 retry as fully passed.
- Manual Creator Hub preview result:
  - User re-imported/opened the real main project path and previewed through Creator Hub on port `8000`.
  - Preview failed again:
    - `entities/active FAILED in 15008ms (attempt 1/2)`
    - `entities/active FAILED in 15013ms (attempt 2/2)`
    - `entities/active gave up after 2 attempt(s)`
    - `Failed to start: timeout after 15000ms`
  - New concrete error surfaced from the preview server:
    - `TypeError: fetch failed`
    - `cause.code=UND_ERR_CONNECT_TIMEOUT`
    - stack points to `node_modules/@dcl/sdk-commands/dist/commands/start/server/endpoints.js:121`.
  - Inspection of `endpoints.js:121` shows this is inside the `/lambdas/:path+` proxy route, where `sdk-commands` forwards a request to the catalyst URL via `components.fetch.fetch(...)`.
  - This suggests the Creator Hub / Explorer startup path on the real main project is getting stuck on a lambda/catalyst proxy request, not on local scene bundling, TypeScript, model content serving, or the direct `/content/entities/active` backend path.
- Decision:
  - Since OQ09 proved the same current main working tree copied to a clean temp folder can preview successfully through Creator Hub, continued time on the original real path is low value.
  - Next step is to prepare a new clean replacement project folder from the proven OQ09 state, then continue authoritative migration there if it previews cleanly.

### 2026-07-01 - Clean Replacement Project Folder

- Status: Completed.
- Reason:
  - The real main project path still fails Creator Hub preview even after a cold-start O2 retry, while OQ09 proved the same project state works from a clean copied folder.
  - To avoid spending more time on likely Creator Hub/path/cache state around the original project, create a stable clean folder outside `%TEMP%`.
- Source:
  - Copied from the proven OQ09 temp project:
    - `C:\Users\sunch\AppData\Local\Temp\02 Project\MetaLiveStudio\2026\Decoy Doge\Doge Hunt Proof of Concept OQ09`
- Target:
  - `D:\Files\02_Project\01_Metaverse\MetaLiveStudio\02_3rdPartyWorks\2026\Decoy Doge\Doge Hunt Auth Clean`
  - Path length: `101`.
  - `.git` and OQ09 diagnostic logs were excluded.
- Cleanup/config:
  - Display title changed to `Doge Hunt Auth Clean`.
  - Description changed to `Trust No Doge. Clean authoritative-server migration copy.`
  - `source.projectId` regenerated to `9564fe3f-7f87-4267-9934-c980f2271114`.
  - Initial PowerShell JSON rewrite accidentally added a UTF-8 BOM to `scene.json`; `sdk-commands build` rejected it as invalid JSON.
  - Rewrote `scene.json` as UTF-8 without BOM; first bytes now start with `{`.
- Verification:
  - Installed/auth config preserved:
    - `@dcl/sdk=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/js-runtime=7.24.3-28199504206.commit-1a6c780`
    - `@dcl/sdk-commands=7.24.3-28199504206.commit-1a6c780`
    - `@dcl-sdk/utils=1.4.0`
    - `authoritativeMultiplayer=true`
    - `logsPermissions=["0x797066a17F83425C1B4C7a8Cca52D19095520a52"]`
    - `worldConfiguration.name=playandearn.dcl.eth`
  - `rg` found no O3/server source code:
    - no `isServer(`, no `registerMessages`, no `@dcl/sdk/server`, no `AUTH_SERVER`, no `validateBeforeChange`.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed after BOM fix.
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `246ms`, wall-clock about `278ms`, `4173` bytes.
    - Model content requests returned HTTP `200`.
    - LiveKit connected to the preview room.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
    - Probe process tree was stopped after the test.
  - Post-probe cleanup:
    - No listeners on `8000` or `3799`.
    - No clean-project preview / Creator Hub / Decentraland related process remained.
  - Manual Creator Hub preview:
    - User confirmed `Doge Hunt Auth Clean` can preview successfully through Creator Hub on port `8000`.
    - Console showed:
      - `Found 0 errors. Watching for file changes.`
      - `/about` fetched from `http://localhost:8000/about`.
      - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')`.
      - Scene logs started normally: `Doge Hunt Proof of Concept loaded. Trust No Doge.`, UI setup, lobby creation, start button entity/click handler created.
      - Model content requests for `MoonLobby1.glb` and `roblox_doge_hat.glb` returned HTTP `200`.
      - `Server running`.
      - LiveKit connected to the preview room.
      - Later participant disconnect / `PEER_DISCONNECTED` logs were observed for the user's wallet; not treated as a startup blocker.
- Decision:
  - Continue future authoritative-server migration work from the clean replacement folder:
    - `D:\Files\02_Project\01_Metaverse\MetaLiveStudio\02_3rdPartyWorks\2026\Decoy Doge\Doge Hunt Auth Clean`
  - Treat the original `Doge Hunt Proof of Concept` path as a contaminated Creator Hub path for auth-server preview work.

### 2026-07-01 - Phase O3 Minimal Server/Client Entry Branch

- Status: Completed.
- Scope:
  - Add only a minimal `isServer()` branch at the scene entry point.
  - Server branch logs a clear `[Server]` startup marker and returns before client UI/lobby/system setup.
  - Client branch logs a clear `[Client]` startup marker and then keeps the existing lobby/gameplay startup path.
- Out of scope:
  - No `registerMessages()`.
  - No synced components.
  - No Storage / EnvVar usage.
  - No gameplay migration to server.
  - No resolver or combat/skill changes.
- Rollback boundary:
  - Revert the `src/index.ts` import/log/branch changes only.
- Files changed:
  - `src/index.ts`
  - `tasks.md`
- Implementation:
  - Added `import { isServer } from '@dcl/sdk/network'`.
  - Added an early `isServer()` guard at the start of `main()`.
  - Server branch logs:
    - `[Server] Doge Hunt authoritative server entry loaded. O3 has no gameplay server logic yet.`
  - Client branch logs:
    - `[Client] Doge Hunt client entry loaded.`
  - Existing client startup flow remains unchanged after the client log.
- Verification:
  - Scope scan found only the intended O3 markers:
    - `isServer(` in `src/index.ts`
    - `[Server]` / `[Client]` logs in `src/index.ts`
    - no `registerMessages`
    - no `@dcl/sdk/server`
    - no `AUTH_SERVER`
    - no `validateBeforeChange`
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed.
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `233ms`, wall-clock about `279ms`, `4173` bytes.
    - Backend scene logs contain `[Server]`.
    - Backend scene logs do not contain `[Client]`.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
    - Probe process tree was stopped after the test.
    - No listener remained on `3799`.
- Current interpretation:
  - The O3 server branch works in the headless authoritative runtime.
  - Because the no-client probe does not launch Explorer, manual Creator Hub preview is still required to confirm the client branch logs `[Client]` and still creates the lobby.
- Manual Creator Hub preview:
  - User confirmed `Doge Hunt Auth Clean` can preview through Creator Hub after O3.
  - Console showed:
    - `/about` fetched from `http://localhost:8000/about`.
    - `Server running`.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')`.
    - Scene logs include `[Server] Doge Hunt authoritative server entry loaded. O3 has no gameplay server logic yet.`
    - LiveKit connected to the preview room.
  - The posted Creator Hub console did not show `[Client] Doge Hunt client entry loaded.`
  - Interpretation: the authoritative server marker is confirmed in the terminal logs, and preview startup is not blocked. The `[Client]` marker may not be forwarded to this terminal log surface; future client-side checks should rely on visual/client behavior or a more explicit client-visible marker if needed.

### 2026-07-01 - Phase O4 Runtime Readiness Diagnostics

- Status: Completed.
- Scope:
  - Add explicit non-gameplay diagnostics to distinguish authoritative server readiness from client readiness.
  - Keep diagnostics small and removable.
  - Server diagnostics may log a one-time startup/heartbeat marker.
  - Client diagnostics may create a temporary visible readiness marker so client execution can be verified even if client console logs are not forwarded into Creator Hub terminal output.
- Out of scope:
  - No `registerMessages()`.
  - No client/server message transport.
  - No synced gameplay state.
  - No combat, skill, resolver, room, or match migration.
- Rollback boundary:
  - Revert `src/authDiagnostics.ts`, its imports/calls in `src/index.ts`, and this task-log section.
- Files changed:
  - `src/authDiagnostics.ts`
  - `src/index.ts`
  - `tasks.md`
- Implementation:
  - Added removable O4 diagnostics with no gameplay ownership changes.
  - Server branch now calls `setupO4ServerDiagnostics()` after the O3 `[Server]` entry marker.
  - Server diagnostics log:
    - `[Server][O4] Runtime diagnostics registered.`
    - `[Server][O4] Runtime heartbeat confirmed after first server tick.`
  - Client branch now calls `setupO4ClientDiagnostics()` after the O3 `[Client]` entry marker.
  - Client diagnostics log:
    - `[Client][O4] Runtime diagnostics registered.`
    - `[Client][O4] First client frame confirmed.`
  - Client diagnostics also create a temporary cyan billboard at approximately `(48, 6.2, 48)` with text:
    - `[O4] Client Ready`
- Verification:
  - Scope scan found only the intended O3/O4 markers:
    - `isServer(` in `src/index.ts`
    - `[Server]`, `[Client]`, and `[O4]` logs in `src/index.ts` / `src/authDiagnostics.ts`
    - no `registerMessages`
    - no `@dcl/sdk/server`
    - no `AUTH_SERVER`
    - no `validateBeforeChange`
    - no `syncEntity`
    - no Storage / EnvVar usage
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `233ms`, wall-clock about `306ms`, `4173` bytes.
    - Backend scene logs contain `[Server][O4] Runtime diagnostics registered.`
    - Backend scene logs contain `[Server][O4] Runtime heartbeat confirmed after first server tick.`
    - Backend scene logs do not contain `[Client][O4]`, as expected for a no-client probe.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
  - Post-probe cleanup:
    - The no-client probe process tree was stopped.
    - Previous Creator Hub / preview residue was also cleaned before manual O4 preview.
    - No listener remained on `3799`, `3801`, `3802`, or `8000`.
- Manual Creator Hub preview:
  - User confirmed the clean project can preview through Creator Hub after O4.
  - Preview did not hang on `/content/entities/active`.
  - LiveKit connected and the user's wallet joined the preview room.
  - Terminal logs confirmed:
    - `[Server] Doge Hunt authoritative server entry loaded. O3 has no gameplay server logic yet.`
    - `[Server][O4] Runtime diagnostics registered.`
    - `[Server][O4] Runtime heartbeat confirmed after first server tick.`
  - The known `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears and remains non-blocking.
  - The posted Creator Hub terminal output still did not surface `[Client][O4]`; future client-side checks should continue to rely on visible scene behavior or a dedicated client-observable signal rather than terminal forwarding alone.

### 2026-07-01 - Phase P Server Lobby Flow

- Status: Completed.
- Goal:
  - Replace the local-only waiting room entry with a server-owned room snapshot flow.
  - Keep this phase focused on lobby/room ownership only.
- Scope:
  - Add a shared authoritative message channel using `registerMessages()`.
  - Add server-side room handlers for `joinRoom`, `leaveRoom`, and `setReady`.
  - Server stores room players, host, ready state, capacity, and snapshot version.
  - Client waits for room readiness/state sync, sends `joinRoom`, receives `roomSnapshot`, and keeps a client-side room view.
  - Waiting room UI now renders the server room snapshot instead of `localRoom` state.
  - Leave button notifies the server and exits the waiting-room UI.
- Out of scope:
  - No server match start.
  - No hidden identity seed.
  - No gameplay resolver migration.
  - No BONK / Turn to Rock / round-end authority changes.
  - No Storage / EnvVar usage.
  - No `syncEntity()` state replication.
- Review focus:
  - In Creator Hub, click the lobby Doge, then `CREATE ROOM`.
  - Confirm the waiting room changes from connecting/joining to a server room snapshot.
  - Confirm player count is `1/4`.
  - Confirm host row shows the current player and wallet short address.
  - Confirm Creator Hub terminal shows `[Server][P] joinRoom accepted ...` and `[Server][P] roomSnapshot ...`.
  - Confirm `START` is disabled in this phase; server match start is reserved for Phase Q.
  - Confirm no `/content/entities/active` timeout or scene disappearance.
- Rollback boundary:
  - Revert `src/shared/messages.ts`, `src/shared/serverRoom.ts`, `src/server/serverLobby.ts`, `src/client/serverRoomClient.ts`, and the Phase P changes in `src/index.ts`, `src/lobby.ts`, `src/uiManager.ts`, and this task-log section.
- Files changed:
  - `src/shared/messages.ts`
  - `src/shared/serverRoom.ts`
  - `src/server/serverLobby.ts`
  - `src/client/serverRoomClient.ts`
  - `src/index.ts`
  - `src/lobby.ts`
  - `src/uiManager.ts`
  - `tasks.md`
- Implementation:
  - Message schemas:
    - `joinRoom`
    - `leaveRoom`
    - `setReady`
    - `roomSnapshot`
    - `roomError`
  - Server logs include:
    - `[Server][P] Server lobby handlers registered.`
    - `[Server][P] joinRoom accepted ...`
    - `[Server][P] roomSnapshot ...`
  - Client logs include:
    - `[Client][P] server room join requested.`
    - `[Client][P] joinRoom sent after state sync.`
    - `[Client][P] roomSnapshot ...`
  - Room snapshots are sent as JSON strings in Phase P to avoid mixing the first room-flow migration with nested schema complexity.
  - Existing local match start remains out of the server path and is not triggered by the Phase P waiting-room `START` button.
- Verification:
  - Scope scan found the expected `registerMessages()` and `[P]` logs.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
  - Scope scan found no `requestStartMatch` / `matchStarted` implementation.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Direct no-client backend probe:
    - Command shape: `sdk-commands start --explorer-alpha --hub --skip-auth-screen --no-client --no-watch -p 3799`.
    - `/about` returned HTTP `200`.
    - Runtime printed `Server running`.
    - `/content/entities/active` returned HTTP `200`, curl time about `219ms`, wall-clock about `359ms`, `4173` bytes.
    - Backend scene logs contain `[Server][P] Server lobby handlers registered.`
    - The probe cannot verify `joinRoom` because it does not launch an Explorer client.
  - Hot-reload / process policy:
    - Only the temporary no-client probe was stopped after verification.
    - The existing Creator Hub preview on port `8000` was left running for hot-reload review.
- Creator Hub hot-reload finding:
  - User attempted `CREATE ROOM` after Phase P hot reload.
  - Client-side logs showed:
    - `[Client][P] server room join requested.`
    - `[Client][P] joinRoom sent after state sync.`
  - Creator Hub/server terminal did not show `[Server][P] joinRoom accepted ...`.
  - Terminal showed authoritative communication loss:
    - `LIVEKIT DISCONNECTED - SERVER COMMUNICATION LOST`
    - `Reason: DUPLICATE_IDENTITY`
    - `[Comms] Comms transport lost (kicked=true)`
  - Process inspection showed one active Creator Hub preview on `8000`, but the Phase P no-client probe had also been started earlier from the same project path on `3799`.
  - Interpretation:
    - Even with a different HTTP port, a no-client probe from the same project path can join the same LiveKit preview room because the room identity is derived from the scene/project path.
    - Running a no-client probe while Creator Hub preview is open can kick the authoritative server connection with `DUPLICATE_IDENTITY`.
    - The observed stuck `Joining server room` state is therefore not enough to judge Phase P room logic; the message never reached the server after comms were kicked.
  - Updated verification rule:
    - Do not run same-path no-client probes while the Creator Hub preview for that path is active.
    - For hot-reload review, use `tsc` / SDK build plus the live Creator Hub preview only.
    - If a backend probe is needed while Creator Hub remains open, run it from a copied scratch path so it gets a distinct LiveKit preview room.
  - Recovery step:
    - Restart the active Creator Hub preview server with `R` after `DUPLICATE_IDENTITY`, then reload/retry `CREATE ROOM` without starting another same-path probe.
- Preview restart recovery:
  - User reported Creator Hub could not accept input for `R` restart.
  - Stopped the stuck preview server process tree, including:
    - Creator Hub NodeService listening on `8000`.
    - `hammurabi-server --realm=http://localhost:8000`.
    - existing Decentraland Explorer process.
    - related tsc/esbuild preview children for the clean project.
  - Left the main Creator Hub UI process running.
  - Restarted preview from the clean project with:
    - `sdk-commands start --explorer-alpha --hub --skip-auth-screen -p 8000`
  - New preview server verification:
    - `http://localhost:8000/about` returned HTTP `200`.
    - `Server running` marker appeared.
    - `[Server][P] Server lobby handlers registered. roomId=doge-server-room` appeared.
    - LiveKit connected to the preview room.
    - No `DUPLICATE_IDENTITY` was observed in the fresh startup logs.
    - Known non-blocking `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears.
  - Restart logs:
    - `C:\Users\sunch\AppData\Local\Temp\doge-hunt-auth-clean-preview-restart\20260701-203417`
- Manual Creator Hub review:
  - User confirmed Phase P worked after the preview restart.
  - Server logs confirmed:
    - `[Server][P] joinRoom accepted address=0x797066a17f83425c1b4c7a8cca52d19095520a52 host=true players=1/4`
    - `[Server][P] roomSnapshot v=1 reason=join players=1/4 host=0x797066a17f83425c1b4c7a8cca52d19095520a52`
  - Interpretation:
    - Phase P server-owned waiting-room flow is confirmed in the live Creator Hub/Explorer path.
    - The earlier stuck `Joining server room` state was caused by the duplicate server identity/comms loss, not by Phase P room logic.

### 2026-07-01 - Phase Q Server Match Start + Identity Seed

- Status: Completed.
- Goal:
  - Let the authoritative server own match start, match config, public Doge list, and private identity seed.
  - Keep existing client-side gameplay presentation runnable after server match start.
- Scope:
  - Add `requestStartMatch`, `matchStarted`, and `matchError` messages.
  - Enable the waiting-room `START` button when the server room snapshot says the host can start.
  - Server validates that the requester is in the room, is host, and the room can start.
  - Server creates `server-match-*` match config from room players.
  - Server creates the authoritative public Doge list.
  - Server sends each player a targeted `matchStarted` payload with a local runtime seed.
  - Client receives `matchStarted`, initializes local runtime state from the server seed, and enters the existing game scene.
- Out of scope:
  - No server BONK authority.
  - No server Turn to Rock authority.
  - No server round timer / round end.
  - No Storage / EnvVar usage.
  - No `syncEntity()` state replication.
  - No `validateBeforeChange()`.
- Review focus:
  - In Creator Hub, enter the server waiting room.
  - Confirm `START` becomes enabled for the host after `Players 1/4`.
  - Click `START`.
  - Confirm server logs show:
    - `[Server][Q] requestStartMatch accepted ...`
    - `[Server][Q] matchStarted sent ...`
  - Confirm client logs show:
    - `[Client][Q] requestStartMatch sent ...`
    - `[Client][Q] matchStarted received ...`
    - `[Match][Q] Runtime state initialized from server seed ...`
  - Confirm the scene enters gameplay and still spawns current NPCs/HUD.
  - Confirm no `DUPLICATE_IDENTITY`; if it appears, restart preview before judging Q logic.
- Important caveat:
  - Phase Q uses a temporary presentation bridge so the current single-player-style client can spawn decoy NPCs from the server seed.
  - This proves server-owned match start and identity seeding, but it is not the final hidden-information model for real multiplayer. Phase R/S must continue tightening public state and private identity exposure.
- Rollback boundary:
  - Revert `src/shared/serverMatch.ts`, the Q message additions in `src/shared/messages.ts`, Q changes in `src/server/serverLobby.ts`, `src/client/serverRoomClient.ts`, `src/localMatch.ts`, `src/localMatchState.ts`, `src/lobby.ts`, `src/index.ts`, `src/uiManager.ts`, and this task-log section.
- Files changed:
  - `.trae/rules/decentraland.md`
  - `src/shared/serverMatch.ts`
  - `src/shared/messages.ts`
  - `src/server/serverLobby.ts`
  - `src/client/serverRoomClient.ts`
  - `src/localMatch.ts`
  - `src/localMatchState.ts`
  - `src/lobby.ts`
  - `src/index.ts`
  - `src/uiManager.ts`
  - `tasks.md`
- Verification:
  - Added persistent project rules for the same-path no-client probe / Creator Hub `DUPLICATE_IDENTITY` issue.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - Scope scan found the expected `requestStartMatch`, `matchStarted`, and `[Q]` logs.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Because the live Creator Hub preview server is active on the same project path, no same-path no-client probe was run for Phase Q.
  - Existing preview server remained listening on `8000` and hot reload rebuilt the scene with zero TypeScript watch errors.
  - User Creator Hub review passed:
    - Waiting room showed `Players 1/4`, current wallet short address, and host status.
    - Client logs showed `[Client][Q] requestStartMatch sent ...`.
    - Client logs showed `[Client][Q] matchStarted received matchId=server-match-1 players=1 decoys=11 version=1`.
    - Client logs showed `[Match][Q] Runtime state initialized from server seed ...`.
    - Client logs showed `[GameState] LOBBY -> PLAYING`.
    - No `DUPLICATE_IDENTITY` was reported during this Q user flow.

### 2026-07-01 - Phase R Server Public State + HUD Sync

- Status: Completed.
- Goal:
  - Introduce a server-owned public match snapshot channel after server match start.
  - Let the client cache the latest server public snapshot and surface it in HUD data.
  - Keep current local BONK, Turn to Rock, and elimination presentation runnable until Phase S moves gameplay authority.
- Scope:
  - Add `publicStateSnapshot` message.
  - Add shared server public snapshot types and parser.
  - Server creates an active public match state after `matchStarted`.
  - Server broadcasts `publicStateSnapshot` on match start and once per second while active.
  - Snapshot includes public Doge list, public player state, target Doge counts, elapsed time, time left, phase, and version.
  - Client caches the latest server public snapshot.
  - HUD stats now merge the server public snapshot for time/target totals while preserving local Bonk/elimination presentation until Phase S.
  - HUD shows a compact `Server public v*` line for review.
- Out of scope:
  - No server BONK authority.
  - No server Turn to Rock authority.
  - No server-side elimination updates from client actions.
  - No synced ECS components.
  - No Storage / EnvVar usage.
  - No `validateBeforeChange()`.
- Review focus:
  - In Creator Hub, enter room, click `START`, and confirm gameplay starts.
  - Confirm Creator Hub/server logs show:
    - `[Server][R] publicStateSnapshot sent reason=match-started ...`
    - `[Server][R] publicStateSnapshot sent reason=tick ...`
  - Confirm client logs show:
    - `[Client][R] publicStateSnapshot received ...`
  - Confirm the in-game HUD shows a `Server public v*` line and its time value changes.
  - Confirm local gameplay still works: NPCs spawn, BONK/Turn to Rock remain usable, and no scene content disappears.
  - Confirm no second same-path preview server is active; if `DUPLICATE_IDENTITY` appears, restart the active preview before judging R logic.
- Important caveat:
  - Phase R intentionally does not make BONK/elimination authoritative yet.
  - Until Phase S, the server public snapshot is a server-owned public match/timer feed while hit results remain local presentation.
- Rollback boundary:
  - Revert `src/shared/serverPublicState.ts`, `src/client/serverPublicStateClient.ts`, the `publicStateSnapshot` message in `src/shared/messages.ts`, R changes in `src/server/serverLobby.ts`, `src/index.ts`, `src/lobby.ts`, `src/uiManager.ts`, and this task-log section.
- Files changed:
  - `.trae/rules/decentraland.md`
  - `src/shared/serverPublicState.ts`
  - `src/client/serverPublicStateClient.ts`
  - `src/shared/messages.ts`
  - `src/server/serverLobby.ts`
  - `src/index.ts`
  - `src/lobby.ts`
  - `src/uiManager.ts`
  - `tasks.md`
- Verification:
  - Found two same-path preview listeners before R validation:
    - `8001`: Creator Hub preview.
    - `8000`: older CLI preview started during previous recovery.
  - Stopped only the older CLI preview on `8000`; left Creator Hub preview on `8001` running to avoid unnecessary full restart.
  - Updated persistent project rules to forbid leaving multiple same-path preview servers running while judging authoritative server behavior.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - Scope scan found the expected `publicStateSnapshot`, `[Server][R]`, `[Client][R]`, and `Server public` code.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Final process check found only `8001` listening for the current Creator Hub preview.
  - Final `node .\node_modules\typescript\bin\tsc --noEmit` passed after task/rule updates.
  - User Creator Hub single-client review passed:
    - Client logs showed `[Client][P] roomSnapshot v=1 players=1/4`.
    - Client logs showed `[Client][Q] matchStarted received matchId=server-match-1 players=1 decoys=11 version=1`.
    - Client logs showed `[GameState] LOBBY -> PLAYING`.
    - Client logs showed `[Client][R] publicStateSnapshot received matchId=server-match-1 reason=match-started version=2 targetAlive=11/11 timeLeft=180`.
    - Client logs showed repeated `[Client][R] publicStateSnapshot received ... reason=tick ...` entries with timeLeft decreasing from `179` to `176`.
    - This confirms the single-client authoritative server public-state feed is live and ticking after match start.

### 2026-07-01 - Phase S Authoritative Gameplay Core

- Status: Completed.
- Goal:
  - Move gameplay result authority from local-only state into server-owned request/result messages.
  - Keep the first S checkpoint single-client focused: server accepts/rejects BONK, Turn to Rock, and round-end requests, mutates authoritative public match state, and broadcasts updated public snapshots.
- Scope:
  - Add BONK, Turn to Rock, and round-end request/result messages.
  - Client sends BONK requests with the locally detected target `publicDogeId`; server owns accepted/rejected result and elimination state.
  - Client sends Turn to Rock requests; server owns activation/cooldown acceptance and public visual state.
  - Client sends round-end requests; server accepts only when its own public state says the round is over.
  - Server updates `publicStateSnapshot` after accepted gameplay events.
  - Preserve existing local NPC movement, local hit candidate detection, animation, and visual presentation.
- Out of scope:
  - No real multi-client gameplay validation in this phase.
  - No server-side NPC transform registry yet.
  - No full anti-cheat hit geometry yet; the first S checkpoint validates server-owned result state using client-provided local hit candidates.
  - No Storage / EnvVar usage.
  - No synced ECS components.
  - No `validateBeforeChange()`.
- Review focus:
  - Single-client Creator Hub flow: create room, start match, BONK one NPC.
  - Confirm client logs show `[Client][S] bonkRequest sent ...` and `[Client][S] bonkResult accepted ...`.
  - Confirm server logs show `[Server][S] bonk accepted ...`.
  - Confirm R public snapshot updates after the BONK with target alive count decreasing.
  - Trigger Turn to Rock and confirm `[Client][S] turnToRockRequest sent ...`, `[Server][S] turnToRock activated ...`, and `[Client][S] turnToRockResult activated ...`.
  - Confirm local visual gameplay still works and no scene content disappears.
- Rollback boundary:
  - Revert `src/shared/serverGameplay.ts`, the S message additions in `src/shared/messages.ts`, S changes in `src/server/serverLobby.ts`, `src/client/serverGameplayClient.ts`, `src/combat.ts`, `src/skills.ts`, `src/gameResolvers.ts`, `src/npc.ts`, `src/index.ts`, and this task-log section.
- Files changed:
  - `src/shared/serverGameplay.ts`
  - `src/shared/messages.ts`
  - `src/server/serverLobby.ts`
  - `src/client/serverGameplayClient.ts`
  - `src/combat.ts`
  - `src/skills.ts`
  - `src/gameResolvers.ts`
  - `src/npc.ts`
  - `src/index.ts`
  - `tasks.md`
- Implementation:
  - Added JSON-payload message schemas:
    - `bonkRequest` / `bonkResult`
    - `turnToRockRequest` / `turnToRockResult`
    - `roundEndRequest` / `roundEndResult`
  - Server BONK handler:
    - Validates active match, sender player, target public Doge, and duplicate elimination.
    - Rejects player-target BONK for this checkpoint because real multi-client player combat is intentionally deferred.
    - Marks accepted target public Doge as `eliminated`, increments server player bonks, and broadcasts a public snapshot.
  - Server Turn to Rock handler:
    - Validates active match/player/cooldown.
    - Marks the player's public Doge as `rock`, starts server-side active/cooldown timers, and broadcasts public snapshots on activation/end.
  - Server round-end handler:
    - Accepts round-end only when server public state is actually over.
  - Client gameplay resolver:
    - Sends local BONK hit candidates to the server with `publicDogeId`.
    - Waits for accepted `bonkResult` before applying local NPC elimination presentation.
    - Sends Turn to Rock requests and waits for accepted server activation before starting local disguise.
    - Sends round-end requests to server instead of recording them only locally.
- Verification:
  - Final process check before S found only `8001` listening for the current Creator Hub preview.
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - Scope scan found the expected S messages and `[Server][S]` / `[Client][S]` logs.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - 2026-07-02 user Creator Hub single-client gameplay review passed:
    - Client logs showed room join, server match start, and `[GameState] LOBBY -> PLAYING`.
    - Client logs showed `[Client][S] bonkRequest sent requestId=bonk-1 matchId=server-match-1 target=server-match-1-doge-6`.
    - Client logs showed `[Client][S] bonkResult accepted requestId=bonk-1 target=server-match-1-doge-6 applied=true targetAlive=10/11`.
    - Server logs showed `[Server][S] bonk accepted ... target=server-match-1-doge-6 bonks=1 targetAlive=10/11 requestId=bonk-1`.
    - Client/server logs showed a second accepted BONK for `server-match-1-doge-3`, moving target alive count to `9/11`.
    - Public snapshots after BONK showed `reason=bonk` and the authoritative target alive count decreasing.
    - Client logs showed `[Client][S] turnToRockRequest sent requestId=rock-1 matchId=server-match-1`.
    - Server logs showed `[Server][S] turnToRock activated ... publicDoge=server-match-1-doge-1 requestId=rock-1`.
    - Client logs showed `[Client][S] turnToRockResult activated requestId=rock-1 applied=true`.
    - Server logs showed `[Server][S] turnToRock ended ... cooldown=15`, followed by a `reason=turn-to-rock-ended` public snapshot.
    - Known non-blocking Creator Hub `RemoteError: Cannot read properties of undefined (reading 'bind')` still appears, but gameplay/server messaging continued normally.
    - This review did not manually exercise `roundEndRequest` / `roundEndResult`; that path is implemented and build-verified, but still needs a targeted round-end review before final hardening.

## Current Plans / To-Do List
- [ ] Creator Hub manual verification for authoritative leaderboard: solo +1/day cap 10, multi rank 20/10/5/3/day cap 100, 3D lobby board refresh, Storage persistence across preview restart.
- [ ] Continue manual playtesting to fine-tune `jump` duration and `Bonk` feel.
- [ ] Monitor NPC state switching frequency (adjust `Bonk/jump` probability).
- [ ] Verify the updated `MoonLobby1.glb` collider layout in playtests and trim any remaining false-positive wall hits.
- [ ] Scale NPC patrol zones and skill triggers to match `1.5x` arena scale.
- [ ] Refactor `uiManager.ts` to decouple state management from UI layout.
- [x] Historical migration constraint: keep multiplayer as the long-term product goal while proving local/runtime boundaries first. Superseded by completed P-S authoritative single-client checkpoints.
- [x] Phase A: Replace the current `SINGLE PLAYER / MULTIPLAYER` modal with a local "room entry" flow that still starts the existing single-player match.
- [x] Phase B: Add a local waiting-room state (`1/4`, host, ready/start semantics) without server code.
- [x] Phase C: Start matches through local room/match lifecycle functions so the future server migration has clear seams.
- [x] Phase D: Introduce local public/private state naming for Doges and player state without changing current combat behavior.
- [x] Phase E: Wrap BONK in a local `requestBonk -> resolver -> result` path without changing hit behavior.
- [x] Phase F: Wrap `Turn to Rock` in a local request/resolver/result path without changing skill behavior.
- [x] Phase G: Connect local public/private runtime state to BONK and Turn to Rock results for bookkeeping only, without changing gameplay behavior.
- [x] Phase H: Add local round-outcome bookkeeping around the existing timer/all-eliminated game-over path, without changing the current UI trigger behavior.
- [x] Phase I: Add a unified local stats selector while preserving old counter fallbacks for visible HUD/game-over behavior.
- [x] Phase J: Add a minimal public Doge state-to-presentation bridge for local NPC elimination.
- [x] Phase K: Expand local match/runtime state from a single private player toward player-slot based state.
- [x] Phase L: Add local multi-player simulation in the waiting room, using fake player slots to validate 2-4 player room/match semantics without networking.
- [x] Phase M: Add resolver interface cleanup so BONK, Turn to Rock, and round lifecycle callers depend on replaceable resolver interfaces before any server integration.
- [x] Phase N: Clarify local public/private/presentation state boundaries without changing gameplay behavior.
- [x] Phase O0: Compatibility baseline and rollback checkpoint. Record current package versions, `scene.json`, `package.json`, lockfile state, current build result, known dirty files, and exact rollback boundary before changing authoritative-server infrastructure.
- [x] Phase O1a: Repair the existing root `@dcl/js-runtime` dependency mismatch using explicit Program Files npm CLI and a temp cache, without installing auth-server packages.
- [x] Phase O1b: Authoritative-server SDK/dependency feasibility checkpoint. With the current `@dcl/js-runtime` mismatch repaired, verify auth-server package availability and API types in isolation; use explicit Program Files npm CLI plus a temp cache, account for the unresolved mirror risk, record install/build output, and stop for review.
- [x] Phase O1c: Main-project auth-server dependency install checkpoint. Define a registry/lockfile strategy for the 360 unresolved tencentyun tarball URLs, then attempt the minimum main-project dependency install with explicit rollback, `npm ls`, `tsc`, SDK build, and server-keyword scope checks.
- [x] Phase O1c-R: Complete rollback from the auth-server dependency cohort to standard SDK `7.23.2` after Creator Hub / preview node processes are closed; includes a narrow `@dcl/asset-packs=2.15.2` override to avoid the incompatible `@dcl/sdk/text-codec` import from `2.16.2`.
- [x] Phase O1d: Investigate auth-server / Creator Hub compatibility without mutating main-project dependencies; decide whether the next safe experiment should test live-watcher sensitivity, isolated auth-server preview, or a pinned transitive dependency strategy.
- [x] Phase O1e-a: Isolated auth-server CLI preview smoke test. Do not touch the main Doge Hunt project; start the prepared auth-server scratch with `--no-client --no-browser --no-watch`, confirm preview/Hammurabi startup logs, then stop the process tree.
- [x] Phase O1e-b1: Attempt automated Creator Hub cold-start against the scratch auth-server project by launching Creator Hub with the scratch path; record that this Creator Hub build does not treat raw path arguments as project-open commands.
- [x] Phase O1e-b2: Manual Creator Hub scratch import/open + Preview. Do not touch the main Doge Hunt project; open/import the scratch auth-server scene in Creator Hub after dependencies are already installed, manually preview from a cold start, and record logs.
- [x] Phase O1f: Main-project auth-server dependency retry under clean no-preview conditions. Dependency-only; do not touch `scene.json` authoritative fields or source server branching.
- [ ] Phase O2: Minimal `scene.json` authoritative config checkpoint. Original attempt rolled back after O2a preview failed; cold-start retry backend gate passed but real main path Creator Hub preview still failed; move to a clean replacement folder.
- [x] Phase O2a: Authoritative config preview smoke test failed and was rolled back before any O3 source changes.
- [x] O1f replay finding: Previewing O1f auth-server dependencies auto-reintroduces authoritative fields and reproduces `/content/entities/active` timeouts.
- [x] O1f-R: Roll back to standard SDK `7.23.2` plus `@dcl/asset-packs=2.15.2` override to restore the playable single-player baseline.
- [x] O1f-R preview smoke: User confirmed Creator Hub preview works again on the standard SDK baseline.
- [x] OQ6: Hub flags/no-client passed for the isolated auth-server diagnostic project.
- [x] OQ7: Creator Hub / Explorer-alpha preview passed for the isolated auth-server diagnostic project; non-blocking `bind` RemoteError remains.
- [x] OQ8a direct CLI/backend probe: path length `107` with spaces passed `/content/entities/active` using the corrected body-file probe.
- [x] OQ8a manual Creator Hub preview: `Auth Ladder OQ8a - Main Path Shape Repro` loads successfully through Creator Hub; known `bind` RemoteError remains non-blocking.
- [x] OQ09 direct CLI/backend probe: current main working tree copied to temp, reinstalled to auth-server cohort, passed `/content/entities/active`.
- [x] OQ09 manual Creator Hub preview: `Auth Ladder OQ09 - Main Copy Reinstall Repro` loads successfully through Creator Hub; known `bind` RemoteError remains non-blocking.
- [x] O2 retry backend gate: real main project cold-start auth-server dependency/config retry passed `tsc`, SDK build, and `/content/entities/active`.
- [x] O2 retry manual Creator Hub preview: real main path still fails through Creator Hub with `/content/entities/active` timeout and `/lambdas` proxy `UND_ERR_CONNECT_TIMEOUT`.
- [x] Prepare clean replacement project folder from the proven OQ09 auth-server state.
- [x] Clean replacement manual Creator Hub preview: `Doge Hunt Auth Clean` loads successfully through Creator Hub; known `bind` RemoteError remains non-blocking.
- [x] Phase O3: Minimal `isServer()` entry-branch checkpoint. Backend and Creator Hub preview passed; `[Server]` marker confirmed, while `[Client]` marker was not surfaced in the posted terminal logs.
- [x] Phase O4: Explicit Creator Hub / preview smoke-test checkpoint. Backend gate and manual Creator Hub preview passed; server O4 readiness markers are confirmed in the real preview path.
- [x] Phase P: Server Lobby Flow. Creator Hub user-flow review passed; server-owned waiting room confirmed.
- [x] Phase Q: Server Match Start + Identity Seed. Creator Hub user-flow review passed; server-owned match start and identity seed confirmed.
- [x] Phase R: Server Public State + HUD Sync. Creator Hub single-client review passed; server public snapshot feed and ticking timer confirmed.
- [x] Phase S: Authoritative Gameplay Core. Creator Hub single-client review passed; server-owned BONK and Turn to Rock result authority confirmed.
- [x] Phase S follow-up: Targeted round-end request/result review. Creator Hub single-client review passed; server-owned round-end acceptance confirmed.
  - Goal:
    - Verify `roundEndRequest` / `roundEndResult` against server-owned public state.
    - Avoid the old local-only `KILL ALL (DEBUG)` path because it bypassed server authority.
  - Implementation:
    - Added `getAliveNpcPublicDogeIds()` in `src/npc.ts` so debug review can enumerate local alive NPC public Doge IDs.
    - Added `requestServerDebugEliminateAllDoges()` in `src/client/serverGameplayClient.ts`.
    - The debug clear now sends one server `bonkRequest` per alive NPC public Doge instead of directly mutating local NPC state.
    - The existing game-over detector should then send `roundEndRequest` only after server-accepted BONK results have driven the local presentation to zero alive NPCs.
    - The server should accept round end only after its own public state reaches `targetAlive=0/11`.
  - Review focus:
    - Start a single-client server match.
    - Click `KILL ALL (DEBUG)`.
    - Confirm client logs show `[Client][S][RoundEnd] debug eliminate all requested targets=...`.
    - Confirm multiple `[Client][S] bonkRequest sent ... source=debug-round-end` logs.
    - Confirm server logs show accepted BONKs until `targetAlive=0/11`.
    - Confirm client logs show `[Client][S] roundEndRequest sent ... reason=all-doges-eliminated`.
    - Confirm server logs show `[Server][S] roundEnd accepted reason=all-doges-eliminated ...`.
    - Confirm client logs show `[Client][S] roundEndResult accepted ...`.
  - Verification:
    - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
    - Scope scan found the expected follow-up debug and round-end request/result logs.
    - Scope scan found no Storage / EnvVar usage.
    - Scope scan found no `syncEntity()`.
    - Scope scan found no `validateBeforeChange()`.
    - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
    - 2026-07-02 user Creator Hub review passed:
      - Client logs showed `[DEBUG][S] Server Kill All button clicked`.
      - Client logs showed `[Client][S][RoundEnd] debug eliminate all requested targets=10 matchId=server-match-1`.
      - Client logs showed multiple `[Client][S] bonkRequest sent ... source=debug-round-end` requests.
      - Client/server logs showed accepted server BONK results until `targetAlive=0/11`.
      - Server logs showed `[Server][R] publicStateSnapshot sent reason=all-doges-eliminated ... targetAlive=0/11`.
      - Client logs showed `[Client][S] roundEndRequest sent requestId=round-1 reason=all-doges-eliminated alive=0/11`.
      - Server logs showed `[Server][S] roundEnd accepted reason=all-doges-eliminated ... requestId=round-1`.
      - Client logs showed `[Client][S] roundEndResult accepted requestId=round-1 reason=all-doges-eliminated`.
      - Client returned from game over to lobby cleanly and server room snapshot returned to `players=0/4`.
- [x] Phase T: Single-client authoritative Spectator + Results UX. In one medium-sized phase, add server-owned `active/out/spectator` player state, spectator HUD, gameplay-input lock for out players, and final-results identity reveal. Use a controlled single-client debug trigger to validate the out/spectator flow before real two-client combat testing.
- [x] Phase U: Compact Hardening + Cleanup. Single-client Creator Hub smoke passed; two-client smoke is deferred until a real multi-client/deployment review path is available.
- [ ] Phase V: Real Player BONK + Final Survivor Rules. Code implemented; awaiting deployment/two-client review because local single-client preview cannot prove player-vs-player targeting.
- [ ] Phase W1: Deterministic NPC Presentation Sync. Code implemented; awaiting two-client review. This is a low-risk consistency pass before full server-authoritative NPC transforms.
- [ ] Phase W2: Lightweight Server NPC Snapshot Reconciliation. Code implemented; awaiting two-client review.
- [x] Historical server deferral note: defer authoritative server APIs, `scene.json.authoritativeMultiplayer`, dependency changes, and server/client entry splitting until local room and match semantics are proven. Superseded by completed authoritative migration through Phase S.
- [ ] Visual polish backlog: manually verify `Moonstone.glb` rock disguise scale/orientation after core multiplayer UX is stable.

### 2026-07-02 - Product UX Goal Refresh + Current Plan Cleanup

- Status: Completed.
- Goal:
  - Refresh the target user experience now that P-S authoritative single-client checkpoints have passed.
  - Clean stale standalone TODO items that no longer match the current migration stage.
- Final target user flow:
  - Player enters the Doge Hunt scene and sees a clear play affordance in the lobby.
  - Player opens/joins a server room, sees player count/host state, and the host starts the match.
  - When the match starts, every real player is secretly mapped to a public Doge identity; NPC Doges fill the rest of the field so players and decoys look identical.
  - Server owns room state, match start, public match state, timer, BONK results, Turn to Rock results, and round-end acceptance.
  - During play, clients present local movement/animation and submit gameplay requests; server decides the authoritative result and broadcasts public snapshots.
  - A player who is out becomes a spectator: no BONK, no Turn to Rock, no gameplay influence, but they can continue watching with a spectator HUD.
  - Full identity reveal happens only in final results, not at the moment a player is eliminated.
  - Round ends by server authority: all target Doges eliminated, time up, or final survivor/winner rules once real multi-player combat is enabled.
  - Results screen shows winner/outcome, bonks, remaining Doges, identity reveal, and return-to-lobby.
- Cleanup decisions:
  - Merged the eliminated-player spectator UX TODO into Phase T instead of keeping it as a duplicate standalone item.
  - Marked the old "defer authoritative server APIs" note as completed historical guidance because authoritative server migration through Phase S is now already done.
  - Moved the Moonstone scale/orientation check to visual polish backlog so it does not block core multiplayer UX work.
- Updated phase plan:
  - Phase T is not split into formal T1/T2/T3 checkpoints. Treat those as implementation order only, not separate review phases.
  - Phase T delivers the single-client authoritative spectator/results experience in one reviewable step:
    - server/player state for `active/out/spectator`;
    - spectator HUD and out-player input lock for BONK / Turn to Rock / gameplay influence;
    - final results driven by server state, with full identity reveal only at results;
    - controlled single-client debug trigger so the out/spectator path can be reviewed without needing a second player.
  - Phase U follows after T and covers hardening plus multiplayer smoke:
    - remove or gate temporary diagnostics/debug controls while preserving useful `[Client]` / `[Server]` logs;
    - harden disconnect, rejoin, host-leave, empty-room, and match-reset behavior;
    - then run two-client smoke testing for lobby, start, out/spectator, results, and return-to-lobby.
- Review standards:
  - Phase T review focuses on one-client Creator Hub preview: start server room, start match, trigger local out/spectator, confirm spectator HUD, confirm BONK and Turn to Rock are blocked, confirm final results reveal identities only at round end, and confirm return-to-lobby resets cleanly.
  - Phase U review focuses on stability: logs stay readable, stale preview/process issues do not recur, disconnect/rejoin/host-leave paths do not corrupt room or match state, and two-client smoke does not reveal identities early or allow out players to affect gameplay.

### 2026-07-02 - Phase T Implementation Scope

- Status: Completed.
- Goal:
  - Deliver the single-client authoritative spectator/results experience in one medium-sized review step.
  - Keep the change scoped to server-owned player status, client input gating, HUD/results presentation, and controlled debug triggers.
- Planned implementation:
  - Extend server public player state with `active/out/spectator` status while keeping existing `isAlive` compatibility.
  - Add a controlled single-client debug request that marks the local server player as out/spectating through the authoritative server.
  - Reject BONK and Turn to Rock requests on the server when the requesting player is not active.
  - Add client-side input gates so out/spectator players do not play BONK animation, send BONK requests, or activate Turn to Rock.
  - Show compact spectator HUD state while keeping the player in the scene as a watcher.
  - Drive final results from server round-over state and reveal identities only on the final results UI.
  - Add a controlled server-owned debug round-end trigger only for review, so an out/spectator single client can reach final results without waiting for the full timer.
- Review standard:
  - Creator Hub single-client preview starts normally.
  - Create room -> start match still works.
  - `OUT (DEBUG)` marks the local player as spectator through server logs and public snapshots.
  - Spectator HUD appears and normal BONK / Turn to Rock inputs are blocked with `[Client][T]` logs.
  - Server rejects any spectator gameplay requests with `[Server][T]` / `[Server][S]` logs.
  - `END ROUND (DEBUG)` reaches final results and identity reveal appears only there.
  - Return to lobby resets room, public snapshot, spectator state, HUD, and results state.
- Implementation notes:
  - Added server public player `status` values: `active`, `out`, `spectator`.
  - Added server/client debug messages for `debugMarkOutRequest` / `debugMarkOutResult` and `debugForceRoundEndRequest` / `debugForceRoundEndResult`.
  - Server `debugMarkOutRequest` marks the requesting player as `spectator`, sets `isAlive=false`, eliminates that player's public Doge, clears active skill timers, and broadcasts `publicStateSnapshot reason=player-spectator`.
  - Server BONK and Turn to Rock validation now rejects non-active players with `eliminated`.
  - Client now tracks the local server player by the `recipientAddress` from `matchStarted`.
  - Client BONK and Turn to Rock inputs are blocked for out/spectator state with `[Client][T]` logs before normal gameplay effects run.
  - HUD shows compact spectator state and locks normal action controls when the local server player cannot act.
  - Results UI now shows final status and identity reveal lines only when the server public snapshot is round-over.
  - Game-over detection now respects merged server `roundOver` state, so a server-owned debug round end can reach results without local NPC elimination.
  - 2026-07-02 user review confirmed `OUT (DEBUG)` blocks BONK and Turn to Rock while preserving movement/jump.
  - Follow-up patch hides the local `Muscledoge.glb` disguise when server public state marks the local player as spectator, so out players can still move as watchers but their in-game Doge identity disappears.
- Files changed:
  - `src/shared/serverPublicState.ts`
  - `src/shared/serverGameplay.ts`
  - `src/shared/messages.ts`
  - `src/server/serverLobby.ts`
  - `src/client/serverPublicStateClient.ts`
  - `src/client/serverRoomClient.ts`
  - `src/client/serverGameplayClient.ts`
  - `src/combat.ts`
  - `src/skills.ts`
  - `src/player.ts`
  - `src/uiManager.ts`
  - `src/index.ts`
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Lobby How To Play Copy Pass + Debug Button Offset

- Status: Implemented; awaiting preview review.
- User feedback:
  - The lobby How to Play text was too small.
  - It also missed the important room-entry flow: click the Doge head, create/join a room, ready up, host starts.
  - The three debug buttons overlapped the top-center gameplay timer.
- Implementation notes:
  - Enlarged the lobby How to Play panel and increased title/body font sizes.
  - Follow-up readability pass increased the panel again: desktop body text is now roughly `20px`, title roughly `30px`; mobile body text is roughly `18px`, title roughly `26px`.
  - Mobile follow-up kept the approved desktop layout but restored mobile text to title `19px` and body `13px`, with a narrower left-side panel instead of a near-full-screen centered panel.
  - Desktop follow-up moved the lobby How to Play panel to the bottom-right and reduced panel height so top/bottom padding around the text is more balanced.
  - Replaced the copy with the shorter three-part flow:
    - `Click the Doge head to create or join a room.`
    - `Ready up, then host starts the game.`
    - `All Doges look identical.`
    - `BONK suspicious Doges to eliminate real players.`
    - `Win: last real player standing.`
    - `Solo: clear all NPCs. Time up: most Bonks wins.`
  - Moved desktop debug buttons from `top: 20` to `top: 92` so they no longer cover the timer.
- Review standard:
  - Lobby How to Play should be readable on desktop and mobile.
  - The first two lines should clearly explain the room-entry flow.
  - Gameplay timer should remain unobstructed by debug controls on desktop.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Minimal In-Game HUD + Lobby How To Play

- Status: Implemented; awaiting desktop/mobile preview review.
- User feedback:
  - The in-game HUD panel is too noisy. During a match, the only always-needed informational UI is the countdown timer.
  - How to Play instructions should live in the lobby instead of the active gameplay screen.
  - The timer should be top-center and responsive across desktop and mobile.
- Implementation notes:
  - Active gameplay HUD now renders a compact top-center countdown timer instead of the old left-side title/stats/instruction panel.
  - Mobile uses a smaller top timer; desktop uses a larger timer with the same centered placement.
  - The existing gameplay action controls remain available so mobile input is not broken.
  - Added a lobby idle How to Play panel positioned near the old in-game instruction panel location. It appears when no room modal, waiting room, gameplay HUD, or results UI is active.
  - Lobby How to Play copy now covers hidden identities, BONK, eliminated players, final survivor, solo NPC clear, and time-up tie direction.
- Review standard:
  - In lobby idle state, How to Play should be visible on desktop and mobile without clicking the Doge.
  - Opening room entry / waiting room should hide the lobby How to Play panel.
  - During gameplay, the old left-side HUD panel should not appear.
  - During gameplay, the timer should be centered near the top on desktop and mobile.
  - Mobile gameplay controls should remain usable.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Faster Elimination Squash + Final-Hit Visual Grace

- Status: Implemented; awaiting preview and multiplayer review.
- User feedback:
  - NPCs currently squash too slowly after BONK.
  - In a one-player round, the last NPC can trigger the result UI before the squash-to-SmallDoge visual is visible.
  - Multiplayer player eliminations also need review so a real player BONK shows the same readable elimination transition before result UI.
- Implementation notes:
  - NPC squash duration changed from `0.5s` to `0.25s`, making the flattening portion play at 2x speed.
  - Game-over detection now waits `0.35s` after round-over is detected before opening the results UI. Server authority still ends the match immediately; the delay is client-side presentation time for the final-hit squash feedback, not for the full SmallDoge animation.
  - Local eliminated player Doge visual now plays a squash transition, switches briefly to `SmallDoge.glb`, and then hides for spectator mode.
  - Remote player proxies now do the same when their server public state becomes eliminated/spectator: squash, briefly show `SmallDoge.glb`, then hide.
  - Expected logs for remote real-player eliminations include `[Client][W3i] remote proxy elimination visual started ...` and `[Client][W3i] remote proxy small doge shown ...`.
- Review standard:
  - Single-player: each NPC BONK should squash faster, then become SmallDoge.
  - Single-player final NPC: the last NPC should visibly squash before the results UI appears; SmallDoge may appear briefly but should not delay results.
  - Multiplayer non-final player BONK: other clients should see the hit player's Doge squash, become SmallDoge, then disappear into spectator state.
  - Multiplayer final survivor BONK: the final eliminated player's visual transition should happen before final results UI appears.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Avatar Hide Modifier Release Refresh

- Status: Implemented; awaiting preview review.
- Problem observed:
  - After a local preview round ended and the user clicked Return to Lobby, logs showed cleanup ran and the avatar hide modifier was removed, but the native Decentraland avatar still did not visibly return.
  - The log confirmed `showGameOverUI()` called avatar release and `returnToLobby()` completed, so the issue was not a missing cleanup call.
- Root-cause hypothesis:
  - `AvatarModifierArea` removal can fail to visibly refresh the local avatar when the player remains inside the old affected area bounds.
  - The old hide area was centered around the gameplay/lobby space, so removing the component while still inside that region was not reliable enough for Explorer rendering.
- Implementation notes:
  - Avatar visibility release now first moves the hide modifier entity to a far-off refresh position and shrinks the affected area.
  - A short delayed cleanup system removes the modifier entity after `0.75s`, giving Explorer frames to process that the player has left the hide area.
  - `setupPlayerDisguise()` force-removes any stale modifier before creating a new gameplay hide area.
  - Expected logs are now `[Player] Avatar visibility modifier moved away for refresh` followed by `[Player] Avatar visibility modifier removed reason=delayed-release`.
- Review standard:
  - End a local/server preview round, click Return to Lobby, and confirm the native Decentraland avatar reappears near the lobby Doge.
  - Confirm the Doge gameplay visual is removed when returning to lobby.
  - Confirm starting a second round still hides the native avatar and shows the Doge disguise during gameplay.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Single-Player NPC Clear Victory + Result UX Stability

- Status: Implemented; awaiting preview/mobile review.
- User clarification:
  - A one-player server match should not require waiting for the timer. If the solo player eliminates all NPC decoys, the round should immediately end as Victory.
  - This is a single-player-only rule. In multiplayer, clearing NPC decoys must not end the match; the round still depends on real-player elimination, final survivor, time-up, or other server round-end rules.
- Implementation notes:
  - Server BONK handling now checks a dedicated single-player NPC-clear rule after a decoy BONK is accepted.
  - The new rule only fires when `activeMatch.playerCount === 1` and `getServerTargetDogesAlive() <= 0`.
  - When it fires, the server ends the active match with reason `all-doges-eliminated` and the active solo player as winner, producing client result UI of `VICTORY / You Win`.
  - Multiplayer final-survivor logic remains separate and unchanged for `playerCount > 1`.
  - Game Over now releases the avatar hide modifier as soon as the result screen opens, reducing the intermittent case where the native Decentraland avatar stays hidden after returning to lobby.
  - Result UI now has a compact mobile layout with smaller modal dimensions, tighter stats/rows, and a fixed lower Return to Lobby button position so the screen should stay inside mobile bounds.
- Review standard:
  - One-player server match: killing all NPC decoys should immediately end the round with Victory.
  - Server log should include `[Server][V] single-player npc clear ...`.
  - Two-or-more-player match: killing all NPC decoys should not end the round unless a separate valid player-survival/time condition is met.
  - After result screen / return to lobby, the native Decentraland avatar should become visible again consistently.
  - Mobile result screen should show the modal, final reveal content, countdown text if settling, and Return to Lobby button inside the viewport.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Settling Timeout For Abandoned Results Screen

- Status: Implemented; awaiting Creator Hub/two-client review.
- Problem addressed:
  - A player can finish a match and leave the results screen open without clicking `RETURN TO LOBBY`.
  - Because that client is still alive, heartbeat continues and the server would otherwise keep the old room in `settling`, blocking the next room.
- Implementation notes:
  - Added `SERVER_ROOM_SETTLING_TIMEOUT_SECONDS = 30`.
  - `ActiveServerMatch` now tracks `settlingElapsedSeconds` after `phase='ended'`.
  - The server room maintenance system increments the settling timer even while the public match tick system is stopped.
  - After 30 seconds in settling, server clears `activeMatch`, clears old room players, clears heartbeat presence, logs `[Server][U] settled room released ...`, and broadcasts an empty room snapshot.
  - Results UI shows a fixed-position room close countdown above `RETURN TO LOBBY`.
  - Clients still on the results screen keep their local final reveal UI, but no longer occupy the server room.
  - Later `leaveRoom` calls from those old result screens are safe because missing players are ignored.
- Review standard:
  - End a match and do not click `RETURN TO LOBBY`.
  - Other clients should see `Waiting for players to exit` during the settling window.
  - After roughly 30 seconds, dog-head lobby status should recover to `No room open` or the current new room state.
  - Server console should include `[Server][U] settled room released reason=settling-timeout ...`.
  - A new room should be creatable without waiting for every old results-screen client to click Return.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Restore Full Doge Count

- Status: Implemented; awaiting Creator Hub/two-client review.
- Reason:
  - The previous `4` total Doge count was a focused multiplayer debug setting.
  - User requested restoring the full game count.
- Implementation notes:
  - Restored authoritative `SERVER_TOTAL_DOGES` from `4` to `12`.
  - Restored local/fallback `DEFAULT_TOTAL_DOGES` from `4` to `12`.
  - Updated UI fallback totals to match a single-player fallback of `11` NPC Doges plus `1` player Doge.
- Review standard:
  - Single-player server match should start with `11` NPC Doges.
  - Two-player server match should start with `10` NPC Doges.
  - Server/client match-start logs should show `players=2 decoys=10` in a two-player match.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Server Room Ready Gate + Room State Refresh

- Status: Implemented; awaiting Creator Hub/two-client review.
- User feedback addressed:
  - Non-host players should not be considered ready immediately after joining.
  - After a player joins, their primary waiting-room action should be `READY`.
  - Host should only be able to start after all non-host players are ready.
  - Room state can lag on other clients after a player leaves; add automatic refresh/recovery.
- Implementation notes:
  - Added `roomHeartbeat` message to the authoritative room protocol.
  - New non-host room players now join with `isReady=false`; host remains implicitly ready.
  - Repeated `joinRoom` refreshes display name/presence but no longer auto-sets ready.
  - Client waiting room now shows `READY` for non-host players and `START` for host.
  - `requestServerRoomReady(true)` sends `setReady` and requests a follow-up snapshot.
  - Host `START` remains gated by server-owned `canHostStart`.
  - Client sends periodic room heartbeat while still in the server room.
  - Server prunes room players after heartbeat timeout and broadcasts a fresh room snapshot.
  - Client auto-refreshes room snapshots every 3 seconds after the first snapshot, so missed broadcasts and lobby labels recover without reopening the UI.
  - `requestServerRoomLeave()` now notifies server whenever the latest snapshot or client status says the local player is in the room, including match/settling states.
  - Server broadcasts a room snapshot when a match starts so lobby text moves to `Game in progress` promptly.
- Review standard:
  - Host creates a room and can start only when all joined non-host players are ready.
  - Non-host joins and sees a `READY` button, not `START`.
  - After non-host clicks `READY`, their row becomes `READY`; host Start becomes enabled once everyone is ready.
  - If a player returns to lobby or leaves, other clients should reflect the updated player list within the normal broadcast path or the 3 second refresh window.
  - If a client disappears without sending `leaveRoom`, server should remove it after heartbeat timeout and log `[Server][P] room heartbeat timeout ...`.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Bonk Speed and Timing Tuning

- Status: Implemented; awaiting play feel review.
- Goal:
  - Make Bonk feel faster without further enlarging the already-expanded hit zone.
- Implementation notes:
  - Increased local player Bonk animation speed from `1.82` to `2.25`.
  - Moved the impact timing earlier from `0.25s` to `0.18s`.
  - Shortened the attack animation window from `1.26s` to `1.02s`.
  - Shortened the attack movement lock from `1.0s` to `0.75s`.
  - Remote player proxy Bonk animation now reuses the exported local attack speed/duration constants so other clients see the faster swing too.
- Review standard:
  - Bonk should feel more responsive locally.
  - Hit/miss resolution should happen earlier in the swing.
  - Other players should see the faster Bonk proxy animation for both hit and missed swing attempts.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Results UI Information Hierarchy

- Status: Implemented; awaiting end-of-round visual review.
- Goal:
  - Make the end-of-round screen clearly answer: did I win, why did the round end, what were my key stats, and which Doges were real players.
- Implementation notes:
  - Added structured server result reveal data for winner, player rows, player Doge identities, player bonks, local-player highlighting, and decoy summary.
  - Reworked the results overlay into three sections:
    - Top outcome: `VICTORY`, `ELIMINATED`, or `ROUND OVER`, plus end reason.
    - Key stats: local status, Bonks, and elapsed time.
    - Final reveal: winner, up to four player rows, and compact decoy eliminated/survived summary.
  - Kept the old string-based reveal lines as fallback only when structured server reveal data is unavailable.
  - Follow-up review fix: result UI no longer exposes `SPECTATING` or `OUT`; player-facing defeat status is `ELIMINATED`.
  - Removed the redundant `Target Doges` summary from results.
  - Fixed `RETURN TO LOBBY` to the bottom of the result panel so player-row count does not push the button around.
- Review standard:
  - At round end, the player should immediately understand their outcome before reading details.
  - In multiplayer results, each real player row should show name/address, Doge identity, Bonks, and final status.
  - Decoy information should stay compact instead of flooding the modal with NPC IDs.
  - The return button should stay anchored at the bottom of the panel.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Lobby Entry Spawn Facing Dog Head

- Status: Implemented; awaiting visual review.
- Goal:
  - Make newly entering players spawn close to the lobby dog-head interaction point and automatically face it.
- Implementation notes:
  - Updated `scene.json` default spawn range from far southwest lobby area to near the dog head:
    - `x: 47..49`
    - `z: 54..56`
    - `y: 1.1`
  - Updated spawn `cameraTarget` to point at the dog-head lobby focal point:
    - `x: 48`
    - `y: 2.2`
    - `z: 48`
  - This aligns initial scene entry with the existing return-to-lobby area near `48,54`.
- Review standard:
  - On scene entry, the player should appear near the dog head rather than far away.
  - The camera should initially face toward the dog-head interaction point.
- Verification:
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Round Settling Label + Player-Elimination Win Condition

- Status: Implemented; awaiting multiplayer review.
- Problems:
  - During the results screen, the lobby dog-head label could show `Room ready 1/4` because the server represented an ended match as a waiting room while players had not exited yet.
  - Server matches could end when all NPC/decoy Doges were eliminated, but the intended multiplayer win condition is final real-player survival.
- Implementation notes:
  - Added server room phase `settling` for ended match / players still in room.
  - Room/lobby UI now shows `Waiting for players to exit` during `settling`, and disables room creation/start until players leave.
  - New players cannot join while an active match is running or while an ended match is settling.
  - Host cannot start a new match during settling; players must exit and recreate/open the room.
  - Removed server-side match end on `targetDogesAlive <= 0`.
  - Client game-over detection no longer ends server matches when NPC/decoy count reaches zero; server `roundOver` is authoritative.
  - Server now records `eliminationOrder` / `eliminatedAtSeconds` when a real player is eliminated.
  - Results reveal sorting now ranks winner first, then active/survived players, then eliminated players by reverse elimination order so earlier eliminations rank lower.
  - Result player rows now show `#rank` for easier review.
- Review standard:
  - Killing all NPCs should not end a server match by itself.
  - A server match should end when only one real active player remains.
  - Results should rank eliminated players by elimination order, with earliest eliminated lowest.
  - During results before everyone exits, dog-head/lobby status should say `Waiting for players to exit`, not `Room ready`.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-04 - Match Server Readiness UX Gate

- Status: Implemented; awaiting cold-start preview review.
- Problem:
  - On scene entry, the authoritative match server may not have registered room handlers yet. If the player clicks Create Room during that window, the old UI could jump into Waiting Room before the server actually accepted the request.
- Implementation notes:
  - Client room state now tracks whether a real `roomSnapshot` has been received. Until then, the match server is not treated as actionable.
  - `requestRoomSnapshot` and `joinRoom` waits now have a `10s` timeout. If no server response arrives, UI enters error state with `Match server is still waking up`.
  - Room entry keeps the player in the entry modal during `CHECKING SERVER`, `CREATING ROOM`, or `JOINING ROOM`.
  - The UI transitions to Waiting Room only after the server returns a snapshot where the local player is actually in the room.
  - Error state exposes `RETRY SERVER`; retry requests a fresh room snapshot instead of attempting to create immediately.
  - Cancel during a pending server request clears the pending join/snapshot flow.
  - Leave/cancel clears the room readiness marker, so the next room entry requires a fresh server snapshot ack.
- Review standard:
  - On a cold start, the room modal should show `Connecting to match server` / `CHECKING SERVER` rather than a normal clickable `CREATE ROOM`.
  - Clicking Create after server readiness should show `CREATING ROOM` and stay in the modal until the server accepts.
  - If the server does not respond within roughly 10 seconds, the UI should show a retryable server-waking message.
  - Waiting Room should only appear after the server confirms membership.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3f Bonk Attempt Action Broadcast

- Status: Implemented; awaiting two-client review.
- User rule clarified:
  - Every Bonk attempt should be visible to other players, whether it hits or misses.
  - Server-authoritative hit resolution remains separate from animation/action presentation.
- Implementation notes:
  - Added `bonkActionRequest` and `bonkActionEvent` messages for lightweight Bonk-start presentation.
  - `combat.ts` now notifies the gameplay resolver as soon as local Bonk input starts, before impact-frame hit detection.
  - The server validates active-player/match state, then broadcasts a Bonk action event without changing score, doge state, or match result.
  - Clients ignore their own echoed event and trigger remote proxy `Bonk` animation for other players.
  - Accepted Bonk results still use the existing `bonkRequest` / `bonkResult` flow for score, elimination, and match state.
- Review standard:
  - In a two-client match, Player A swings at empty space and Player B still sees Player A's Doge proxy play `Bonk`.
  - If the swing hits, the same visible Bonk-start should be followed by the normal server-accepted result/state update.

### 2026-07-03 - Phase W3g Room Status Copy + Non-Overlapping Spawns

- Status: Implemented; awaiting Creator Hub/two-client review.
- Working agreement:
  - Do not default to tiny phase splits going forward.
  - Use larger coherent UX/feature passes unless a hard-to-debug server/runtime issue requires small checkpoints.
- User feedback addressed:
  - `Server room vN` was confusing because `vN` is only the server room snapshot version. It increments on room state updates and is not a unique room or server id.
  - The lobby Doge prompt should show room/game status before the player clicks.
  - The visible `[O4] Client Ready` diagnostic text should be removed.
  - Multiple players should not spawn stacked on the same point.
- Implementation notes:
  - Added `active` to `ServerRoomPhase` so new entrants can see that a match is already in progress.
  - Room entry UI now disables create/join while a match is active and shows `GAME IN PROGRESS`.
  - Player-facing room labels no longer expose `vN`; logs still keep snapshot versions for debugging.
  - The lobby Doge floating label now shows `No room open`, `Room open X/4`, or `Game in progress` near the play prompt.
  - Removed the visible `[O4] Client Ready` TextShape while keeping console diagnostics.
  - Added shared match spawn points and personalized `localSpawnPoint` assignment, so match start moves each player to a distinct arena point.
  - Expanded the initial `scene.json` spawn area from a tight 2x2 region to a wider 10x10 region.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Turn to Rock Visual Height Tuning

- Status: Implemented; awaiting visual review.
- Goal:
  - Lower the Moonstone rock visual by `0.2m` for better appearance.
  - Do not change the real player position, cached return position, or Doge restore position.
- Implementation notes:
  - Local Moonstone visual offset changed from `-0.1` to `-0.3` in `src/skills.ts`.
  - Remote proxy Moonstone visual offset changed from `-0.1` to `-0.3` in `src/client/remotePlayerProxies.ts` so other players see the same height.
  - `disguiseReturnPosition` and `movePlayerTo(returnPosition)` were intentionally left unchanged to avoid reintroducing the earlier return/fall-through issue.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3h Combat Feel + Mobile Animation Review

- Status: Implemented; awaiting gameplay feel review.
- User feedback addressed:
  - BONK hits against both NPCs and real players still felt too hard.
  - Mobile animation behavior needed review because mobile locomotion differs from desktop.
- Implementation notes:
  - Local NPC BONK hit zone increased from `range=2.9 radius=1.92 minForward=0.25` to `range=3.6 radius=2.45 minForward=0.15`.
  - Server real-player BONK hit zone was updated to the same values so NPC and PvP feel stay aligned.
  - Local impact window increased from `0.12s` to `0.16s` to reduce missed impact frames on lower frame rates/mobile.
  - Mobile action review: Bonk and jump remain platform-independent priority animations; desktop local walk/run still uses movement keys plus modifier; mobile local walk/run still uses smoothed planar speed from the player transform.
  - Remote player proxies are platform-agnostic: they follow each remote player's readable `PlayerIdentityData + Transform`, then infer walk/run from planar speed, jump from vertical motion, and Bonk from the server Bonk action event.
  - Remote proxy idle threshold was aligned to local mobile (`0.15`), jump detection was made more tolerant of networked vertical motion, and `[Client][W3h] remote proxy animation ... speed=...` transition logs were added for mobile two-client review.
  - Remote run threshold remains `8`; keep an eye on whether full-speed mobile movement reaches run or only walk.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

  - Scope scan found no Storage / EnvVar usage in `src`.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
- User review evidence:
  - Client logs showed room join, match start, server public ticks, accepted BONK, accepted Turn to Rock, and turn-to-rock end.
  - Server logs showed matching `[Server][S] bonk accepted`, `[Server][S] turnToRock activated`, and `[Server][S] turnToRock ended`.
  - Client/server logs showed `[Client][T] debugMarkOutResult accepted ... status=spectator` and `[Server][T] debugMarkOut accepted ... status=spectator`.
  - After spectator state, client logs showed `[Client][T] bonk input blocked localStatus=spectator` and `[Client][T] turnToRock input blocked localStatus=spectator`.
  - Server logs showed `publicStateSnapshot reason=debug-force-round-end`, then `roundEnd accepted reason=time-up`.
  - Client logs showed Game Over UI, accepted `roundEndResult`, return-to-lobby cleanup, and final `roomSnapshot ... players=0/4`.
  - Known non-blocking Creator Hub console error `RemoteError: Cannot read properties of undefined (reading 'bind')` appeared again, consistent with prior stable previews.
  - 2026-07-02 second user review confirmed the spectator visual follow-up: after `debugMarkOutResult accepted ... status=spectator`, client logs showed `[Client][T] spectator visual hidden`.
  - Second review also reconfirmed out-player input lock, server-owned `debug-force-round-end`, accepted `roundEndResult`, and clean return-to-lobby with `players=0/4`.

### 2026-07-02 - Phase U Compact Hardening Scope

- Status: Implemented; awaiting Creator Hub smoke review.
- Goal:
  - Treat Phase U as the final engineering phase for this week's token budget.
  - Harden the existing authoritative room/match flow without adding a new gameplay feature.
  - Keep real two-player player-target BONK/final-survivor combat as backlog unless explicitly resumed later.
- Planned implementation:
  - Reset active server match state when the room becomes empty.
  - Preserve/reassign host state when a player leaves and mirror that host state into active public player snapshots.
  - Reject brand-new joins while a server match is active, while still allowing an already-present player to refresh/rejoin.
  - Prevent starting a second match while an active match already exists; clear stale ended matches before a fresh start.
  - Mark a leaving active-match player as spectator/out so they cannot keep gameplay influence.
  - Gate temporary debug controls behind one local UI constant so they are easy to hide for release while still available for local smoke review.
- Implementation notes:
  - `joinRoom` now rejects brand-new players while an active match exists, instead of silently adding them to a waiting room during gameplay.
  - Existing room players can still refresh/rejoin while the match is active.
  - `requestStartMatch` now rejects duplicate starts while a match is active.
  - Stale ended active-match state is reset before starting a fresh match.
  - `leaveRoom` now marks an active-match leaver as spectator, clears their skill timers, eliminates their public Doge, and broadcasts a `player-left` public snapshot when other players remain.
  - If the room becomes empty, active match state is reset so the server does not keep ticking stale match state.
  - Host reassignment is mirrored into active public player snapshots.
  - Round-end results now report the requesting player's bonk count rather than always reading player slot 0.
  - Temporary HUD debug controls are gated by `DEBUG_CONTROLS_ENABLED` in `src/uiManager.ts`; it is currently `true` so local smoke review can still use `OUT (DEBUG)` and `END ROUND (DEBUG)`.
- Files changed:
  - `src/server/serverLobby.ts`
  - `src/uiManager.ts`
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Scope scan found no Storage / EnvVar usage.
  - Scope scan found no `syncEntity()`.
  - Scope scan found no `validateBeforeChange()`.
- Smoke review checklist:
  - Single-client: create room -> start match -> OUT DEBUG -> END ROUND DEBUG -> return lobby -> confirm `players=0/4` and server logs include `[Server][U] activeMatch reset reason=room-empty`.
  - Two-client, if feasible: first client creates room, second joins before start, host starts match, one client leaves/returns; remaining client should receive a public snapshot and no stale host/room corruption.
  - Do not require real player-target BONK in this U smoke; server still intentionally rejects player-target BONK as deferred backlog.
- Out of scope for this compact U:
  - Real player-target BONK geometry.
  - Full final-survivor winner rules.
  - Deployment/release polish.
  - Dependency or `scene.json` changes.

### 2026-07-02 - Phase V Real Player BONK + Final Survivor Rules

- Status: Implemented; awaiting deployment/two-client review.
- Goal:
  - Add the missing authoritative rule layer for real player-vs-player BONK.
  - End the match automatically when one active real player remains.
  - Keep this phase code-focused because the current local setup cannot prove a true two-player preview.
- Implementation notes:
  - Server BONK validation now supports real player targets instead of rejecting player public Doge IDs.
  - If the client sends no NPC candidate, the server attempts to resolve a real player target from authoritative `PlayerIdentityData` + `Transform` using the same forward range/radius numbers as local combat.
  - A successful player BONK marks the target player as spectator/out through the existing server spectator path, eliminates that player's public Doge, clears skill timers, increments the attacker's bonk count, and broadcasts a public snapshot.
  - The server now tracks `endReason`, `winnerAddress`, `winnerDisplayName`, and `winnerPublicDogeId` in public match snapshots.
  - When a player BONK or active-match leave leaves exactly one active real player, the server ends the match with `final-survivor` and records the winner.
  - Client game-over/result logic now prefers the server `endReason` and winner fields, so final-survivor results are not mislabeled as time-up.
  - HUD server status now includes active player count, making two-client review easier.
- Review standard:
  - Two real clients join the same room before match start.
  - Host starts match and both clients receive the same public snapshot stream.
  - Player A swings near Player B with no NPC candidate blocking the hit.
  - Server logs `[Server][V] bonk accepted ... kind=player targetPlayer=...`.
  - Player B receives a public snapshot showing local status spectator/out, loses BONK and Turn to Rock ability, and hides the local Doge visual.
  - Player A receives a final-survivor snapshot if only A remains active.
  - Results reveal identities only at final results and show the winner line.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
- Deferred review:
  - Real player BONK cannot be fully proven in the current single-client local workflow.
  - Creator Hub/deployment two-client review is required before marking Phase V fully user-verified.

### 2026-07-02 - Phase V Single-Client Regression Fix: Avatar Restore After Spectator

- Status: Implemented; awaiting Creator Hub visual confirmation.
- Issue:
  - Single-client regression review passed the gameplay flow, but after `OUT (DEBUG)` hid the local `Muscledoge.glb`, returning to lobby did not visibly restore the original Decentraland avatar.
  - Logs confirmed `cleanupPlayerDisguise()` ran, but the runtime avatar modifier needed a stronger cleanup path.
- Fix:
  - Added an explicit `removeAvatarHideModifierArea()` cleanup path in `src/player.ts`.
  - The cleanup now deletes the `AvatarModifierArea` component before removing the modifier entity, then logs `[Player] Avatar visibility modifier removed`.
  - This keeps the spectator doge hiding behavior during gameplay, but makes return-to-lobby avatar restoration explicit.
- Review standard:
  - Start match -> `OUT (DEBUG)` -> local Muscledoge visual hides.
  - `END ROUND (DEBUG)` -> return to lobby.
  - Confirm the original Decentraland avatar is visible again in lobby.
  - Confirm logs include `[Player] Avatar visibility modifier removed` before `[Player] Player disguise cleaned up`.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W1 Deterministic NPC Presentation Sync

- Status: Implemented; awaiting two-client review.
- Goal:
  - Prioritize multiplayer issue #2: clients were seeing independently randomized NPC positions, routes, and actions.
  - Make the same public Doge NPC initialize and behave consistently across clients without taking on the larger risk of full server-authoritative NPC transforms yet.
- Implementation notes:
  - `src/npc.ts` no longer uses `Math.random()` for NPC spawning, waypoints, initial idle duration, jump height, or action selection.
  - Each NPC gets a deterministic seed derived from its `publicDogeId`.
  - `NpcPatrol` now carries `rngState`, so ongoing action choices use a deterministic per-NPC pseudo-random sequence.
  - Because `publicDogeId` comes from the server match seed, all clients should spawn the same public Doge IDs at the same initial positions with the same waypoint lists and action-choice sequence.
- Review standard:
  - In a two-client match, compare the same visible Doge IDs after match start.
  - The same NPC public Doge should appear in the same initial place and follow the same route/action pattern on both clients.
  - When one client server-BONKs an NPC, the other client should receive the public state and present that same public Doge as eliminated.
- Known limitation:
  - This is deterministic client presentation, not full server-authoritative NPC transform streaming.
  - Small drift may still happen over time because each client still runs local movement integration, ground raycasts, and obstacle probes.
  - If W1 is not enough, the next step is W2: server-owned NPC state snapshots with position/yaw/action/alive per public Doge.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
  - Scope scan confirmed `src/npc.ts` no longer uses `Math.random()`.

### 2026-07-03 - Phase W2 Lightweight Server NPC Snapshot Reconciliation

- Status: Implemented; awaiting two-client review.
- Goal:
  - Keep 3-minute multiplayer rounds from drifting after W1 deterministic startup.
  - Avoid full per-frame NPC transform replication; use a lightweight once-per-second correction feed.
- Implementation notes:
  - Added `src/shared/serverNpcSnapshot.ts` with `ServerNpcSnapshotPayload` parsing and deterministic server-side NPC transform estimation.
  - Added `npcStateSnapshot` to `src/shared/messages.ts`.
  - Server now broadcasts `[Server][W2] npcStateSnapshot sent ...` on match start, each 1-second tick, BONK, Turn to Rock, round-end, and debug round-end paths.
  - The snapshot covers decoy NPC public Doges only. Real player Doges remain handled by player transforms/status.
  - Client listens for `npcStateSnapshot` in `src/client/serverPublicStateClient.ts`.
  - Client applies snapshots in `src/npc.ts`: small drift lerps toward server position, large drift snaps, eliminated state immediately starts local elimination presentation.
- Review standard:
  - In a two-client match, server console shows `[Server][W2] npcStateSnapshot sent ... npcs=...` roughly once per second.
  - Clients should keep the same public Doge NPCs in broadly matching positions over a multi-minute round.
  - When one client kills an NPC, other clients should apply eliminated presentation for the same `publicDogeId`.
  - If a client drifts, logs may show `[Client][W2] npcStateSnapshot applied ... corrected=...`.
- Known limitation:
  - W2 is a correction feed, not full server-animated NPC authority.
  - The server estimates NPC positions from deterministic public Doge routes and elapsed time; it does not run the full client obstacle/raycast patrol system.
  - If this still feels inconsistent in live multiplayer, the next escalation is W3: server-owned NPC state machine with authoritative waypoint/action state.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3a Server Player Spatial Audit + Player BONK Priority

- Status: Implemented; awaiting two-client review.
- Goal:
  - Prove whether the authoritative server can read real player positions during BONK.
  - Make real player BONK resolution run on every BONK request, even when the client also sends a local NPC candidate.
- Implementation notes:
  - Server BONK now first audits real player candidates through authoritative `PlayerIdentityData` + `Transform`.
  - Added `[Server][W3a] playerSpatial ...` logs for attacker transform availability, attacker origin/forward vector, candidate transform availability, forward distance, lateral distance, total distance, and in-arc result.
  - If a real active player is inside the server BONK arc, the server now resolves that player target before falling back to a decoy/NPC target.
  - The client still does not report player position; the server only trusts its own ECS player transform data.
- Review standard:
  - In a two-client match, Player A BONKs while near Player B.
  - Server console should show `[Server][W3a] playerSpatial attacker=... attackerTransform=yes ... candidates=1`.
  - Candidate logs should show whether Player B has `transform=yes` and the measured `forward`, `lateral`, `distance`, and `inArc` values.
  - If `inArc=yes`, server should then log `[Server][W3a] playerSpatial selected target=...` followed by `[Server][V] bonk accepted ... kind=player targetPlayer=...`.
  - If `transform=no` or `inArc=no`, the log now gives enough evidence to decide whether the issue is server position visibility or attack geometry.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3b Room UI Host / Non-Host / Existing Room Split

- Status: Implemented; awaiting two-client review.
- Goal:
  - Fix the multiplayer room UX issue where a second player could still see `CREATE ROOM` instead of `JOIN ROOM`.
  - Ensure non-host players can join but cannot start the match.
- Implementation notes:
  - Added a small `requestRoomSnapshot` message so opening the lobby room UI asks the server for the current room state instead of relying on a previous broadcast.
  - Extended `ServerRoomSnapshot` with recipient/local fields: `recipientAddress`, `isLocalPlayerInRoom`, `localPlayerIsHost`, and `localPlayerIsReady`.
  - Server room broadcasts still include a public room view, and room members also receive personalized snapshots that say whether that client is host.
  - Client room status now distinguishes `room-available` from `joined`, so a public existing-room snapshot no longer makes a non-member look joined.
  - Room entry UI now shows `CREATE ROOM`, `JOIN ROOM`, or `OPEN ROOM` based on the latest server snapshot.
  - Waiting room Start is enabled only for the host when `canHostStart` is true. Non-host players see disabled Start plus `Waiting for host to start`.
- Review standard:
  - Client A creates a room and sees itself as host with Start enabled when ready.
  - Client B opens the lobby UI after Client A's room exists and sees `JOIN ROOM`, not `CREATE ROOM`.
  - After Client B joins, Client B sees disabled Start and `Waiting for host to start`.
  - Client A still sees Start enabled and can start the match.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3c Focused Multiplayer Test Doge Count

- Status: Implemented; awaiting Creator Hub/two-client review.
- Reason:
  - User review found two active multiplayer blockers:
    - NPC presentation still appears to refresh/rewind roughly once per second, likely tied to W2 position reconciliation.
    - Other real players are still not visible to the user, even when they trigger Turn to Rock.
  - Before deeper fixes, reduce the field size so the next multiplayer test has less visual noise.
- Implementation notes:
  - Reduced authoritative match total Doges from `12` to `4` via `SERVER_TOTAL_DOGES`.
  - Reduced local/fallback total Doges from `12` to `4` via `DEFAULT_TOTAL_DOGES`.
  - Updated UI fallback totals and the scene comment to match the focused test size.
  - With two real players in a server match, expected decoy NPC count is now `4 - 2 = 2`.
- Review standard:
  - Single player server match should start with `3` decoy NPCs.
  - Two-player server match should start with `2` decoy NPCs.
  - Server/client logs should show `players=2 decoys=2` on match start.
  - NPC rewind and other-player visibility remain separate blockers to diagnose after this smaller test confirms count reduction.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3d NPC State-Only Sync + Remote Player Proxy

- Status: Implemented; awaiting two-client review.
- Problems addressed:
  - NPCs appeared to refresh/rewind roughly once per second. The likely cause was W2 position reconciliation pulling each client's local NPC transform toward a server-estimated transform that did not run the same obstacle/raycast/action state machine.
  - Other real players were not visible. Current gameplay hides native Decentraland avatars in the arena via `AvatarModifierArea`, but did not create remote Doge/Rock proxy visuals for other real players.
- Implementation notes:
  - `applyServerNpcSnapshot()` is now state-only: it no longer applies server snapshot `x/z/yaw` to local NPC `Transform`.
  - NPC snapshots still eliminate the matching `publicDogeId`, so one client killing an NPC should still make the same NPC die on other clients.
  - Added `src/client/remotePlayerProxies.ts`.
  - Remote proxies create local client-side Doge and Rock visuals for non-local real players in the server public snapshot.
  - Remote proxy position follows the current client's readable remote `PlayerIdentityData + Transform`.
  - Remote proxy visual state follows server public Doge state: `doge`, `rock`, or hidden when out/eliminated.
  - Added `[Client][W3d] remote proxy ...` logs for creation, visibility changes, and missing remote transform diagnostics.
- Review standard:
  - In a two-player match, NPCs should no longer snap/rewind once per second from server reconciliation.
  - If Player A kills an NPC, Player B should still see the same `publicDogeId` eliminated.
  - Player A should see Player B's remote Doge proxy if Player B's `PlayerIdentityData + Transform` is available client-side.
  - When Player B uses Turn to Rock, Player A should see Player B's proxy switch from Doge to Moonstone while server public state says `visualState=rock`.
  - If Player A still cannot see Player B, logs should show whether `[Client][W3d] remote proxy missing transform address=...` appears; that would mean the next step is server-broadcast player pose snapshots.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.

### 2026-07-03 - Phase W3e Remote Proxy Animation + Local Rock Visibility

- Status: Implemented; awaiting two-client review.
- User review feedback:
  - NPC state issue appears solved after W3d state-only NPC sync.
  - Remote players are visible, but their actions were not visible: Bonk, jump, run, walk.
  - Turn to Rock is visible to other players, but the local player could not see their own Moonstone.
- Implementation notes:
  - Remote player proxy now includes Doge animation states: `idel`, `walk`, `run`, `jump`, and `Bonk`.
  - Remote walk/run are inferred from the readable remote player `Transform` planar speed.
  - Remote jump is inferred from positive Y movement.
  - Remote Bonk is inferred from the server public player `bonks` count increasing, so it currently shows server-accepted Bonks.
  - Missed Bonk wind-up is still not broadcast to other clients; that would need a separate lightweight player action event.
  - Local Turn to Rock now explicitly creates a hidden Moonstone with `VisibilityComponent`, sets it visible on activation, and keeps it visible at the cached disguise position while disguised.
  - Added `[Client][S] local rock visual shown ...` and `[Client][W3d] remote proxy bonk animation ...` logs for review.
- Review standard:
  - In a two-client match, Player A should see Player B's proxy switch between idle/walk/run based on movement.
  - Jump should briefly play when the remote Transform rises.
  - When Player B lands a server-accepted Bonk, Player A should see `[Client][W3d] remote proxy bonk animation ...` and the Bonk animation.
  - Player B should now see their own Moonstone while Turn to Rock is active, and the other client should still see the remote Moonstone.
- Known limitation:
  - Remote Bonk animation currently follows accepted Bonk results, not every attempted swing.
  - If attempted/missed swings must be visible, add a server-broadcast `playerActionSnapshot` / `playerActionEvent` for `bonk-start`.
- Verification:
  - `node .\node_modules\typescript\bin\tsc --noEmit` passed.
  - `node .\node_modules\@dcl\sdk-commands\dist\index.js build` passed with SDK commands `7.24.3-28199504206.commit-1a6c780`.
