# Shooter improvement plan

## Phase 1 — Projectile collision correctness
- [x] Use swept, first-contact collision for staples and enemy projectiles.
- [x] Resolve the nearest enemy regardless of array order; cover wins ties.
- [x] Keep RFP wall/floor collision active during arming, including the launch offset.
- [x] Place impact effects at contact rather than at the frame endpoint.
- [x] Add automated collision regression checks.
- [ ] Browser playtest on desktop and phone before publishing.

## Phase 2 — Input and game-state reliability
- [x] Clear held keys, fire, and touch state on blur/visibility loss; pause safely.
- [x] Reacquire pointer lock on an explicit desktop resume gesture.
- [x] Advance reloads using gameplay time so pause freezes them.
- [x] Prevent final-bomber death from advancing waves or restoring health.
- [x] Guarantee one accessible RFP spawn each wave; remove the silent six-pickup cap and use validated fallback positions.
- [x] Preserve analog joystick magnitude while limiting diagonal speed.
- Acceptance: focus changes cannot stick inputs; pause freezes reload; lethal final kills remain game over; every wave adds one pickup; small stick movement is slower.

## Phase 3 — Combat readability
- [x] Add directional damage feedback, a 0.9-second stationary bomber wind-up with a radius warning, and visible RFP blast/self-damage boundaries.
- [x] Use a compact pointer-events-free direction marker and thin world-space rings to keep aim/touch controls clear.
- [ ] Verify combat readability on desktop and physical phone.
- Acceptance: players can identify attack direction and danger range without relying on sound.

## Phase 4 — Between-wave progression
- [x] Offer three upgrade choices: magazine capacity, reload speed, RFP blast strength.
- [x] Pause combat while choosing; support mouse, keyboard, and touch; reset upgrades on restart.
- [x] Caps before tuning: magazine 54, reload 0.7s, blast damage 90 / radius 6.8. Each taken rank adds 6% enemy health.
- [x] A maxed choice cannot be selected again. If every choice is maxed, the next wave starts without a picker.
- [ ] Verify the picker on desktop and phone.
- Acceptance: each choice changes the advertised stat, applies once, and never blocks wave progression.

## Phase 5 — Arena readability
- [x] Dress the existing cover grid as desks, a counter, a conference table, cabinets, partitions, and banded pillars.
- [x] Mark reception, filing, conference, and cubicles with floor rugs. Rugs are visual only.
- [x] Keep furniture details inside the old collision boxes so cover, paths, and spawns stay aligned.
- [ ] Verify the landmarks read clearly on desktop and phone.
- Acceptance: landmarks aid orientation and no new props trap players or enemies.

## Phase 6 — Performance polish
- Replace per-pickup point lights with shared glow sprites.
- Profile before pooling projectiles/particles; pool only measured allocation hotspots.
- Compare frame times and resource counts during long sessions on desktop and phone.
- Acceptance: bounded resources after restart and no visual/gameplay regressions.

## Delivery policy
Implement and validate each phase separately. Keep publication separate from local implementation; verify the live build when publishing is requested. No new dependency is needed for Phase 1: bounded segment/sphere and slab/AABB tests fit the existing Three.js game. Reassess existing libraries/assets before later phases if complexity warrants them.

## Validation — 2026-09-26
- Phase 1 + 2: all 11 automated regression tests pass; JavaScript syntax and diff checks pass.
- Local browser smoke test blocked by browser navigation policy; desktop and physical-phone playtesting remain outstanding.

## Phase 3 validation — 2026-09-26
- All 14 automated regressions pass, including damage bearing, bomber fuse timing, and transient-effect disposal. Syntax and diff checks pass.
- Implemented locally; not published. Visual/playtest acceptance remains outstanding; the previous local browser attempt was blocked by navigation policy.
- No dependency added: existing Three.js rings/materials and CSS suffice.

## Phase 4 validation — 2026-09-26
- Upgrade picker pauses combat, applies one choice, resets on restart, and skips itself when every choice is maxed.
- Caps: magazine 54, reload 0.7s, blast damage 90 and radius 6.8. Each rank adds 6% enemy health.
- Automated regressions pass after the collision fixture learned the new upgrade gate. Syntax and diff checks pass.
- Implemented locally; not published. Desktop and phone picker playtest remains outstanding.

## Phase 5 validation — 2026-09-26
- Furniture uses the previous 12-prop cover grid. Rugs are not collision objects.
- Layout test checks a clear spawn, a 1.6 walk gap, and all four office zones. Full suite: 21 passing.
- Implemented locally; not published. Visual read on desktop and phone remains outstanding.
