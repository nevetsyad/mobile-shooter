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
- Add directional damage feedback, clearer bomber wind-up, and a visible RFP blast boundary.
- Keep effects readable on phone and avoid obscuring aim.
- Acceptance: players can identify attack direction and danger range without relying on sound.

## Phase 4 — Between-wave progression
- Offer three upgrade choices: magazine capacity, reload speed, RFP blast strength.
- Pause combat while choosing; support mouse and touch; reset upgrades on restart.
- Define caps and escalating enemy balance before tuning.
- Acceptance: each choice changes the advertised stat, applies once, and never blocks wave progression.

## Phase 5 — Arena readability
- Add recognizable office furniture and distinct office zones using existing Three.js geometry/materials.
- Keep navigation, sight lines, collision boxes, and spawn accessibility aligned with visuals.
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
