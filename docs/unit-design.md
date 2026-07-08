# Unit Design and Balance Guide

Use this guide when adding or revising units. The goal is not to make every unit interchangeable; it is to give each unit a clear battlefield purpose, a readable role, and a cost that reflects how reliably it performs that purpose.

## General philosophy

- Start with a tactical job, not a bundle of stats. A unit should answer a specific roster need and should have at least one meaningful weakness.
- Prefer legible strengths over small advantages spread across many systems. Players should be able to understand why a unit succeeded or failed by watching the battle.
- Cost is the main balancing lever, but do not use cost to excuse a unit that violates its role identity or has no practical counterplay.
- Avoid strict upgrades. A more expensive unit should usually trade flexibility, speed, durability, targeting freedom, or availability for its stronger effect.
- Balance against mixed armies and mission objectives, not only mirrored duels. Support and specialist units may be weak alone while still creating strong contribution or objective-pressure scores.
- Keep campaign availability in mind. Early units should be broadly useful and easy to read; later units may ask for more deliberate positioning or roster construction.

## Role identity

### Melee

Melee units are front-line fighters, blockers, and brawlers. They always have range 1. Do not classify a unit as melee merely because it is durable or usually deployed near the front.

Melee units normally establish the durability and direct-damage baseline for the roster. Exceptional mobility or control effects should require a clear stat or cost tradeoff.

### Ranged

Ranged units attack from beyond adjacent range. In general, they should have less health and less direct attack power than comparable melee units because range creates extra uptime and safety.

High single-shot damage is acceptable when constrained by reload time, narrow targeting, setup requirements, low durability, or high cost. Ranged units should not also be the best front-line option.

### Support

Support units primarily improve allies or hinder enemies rather than dealing direct damage. Their value should be assessed through mixed-army contribution scenarios, not duel results alone.

Support effects should have explicit ranges and stacking rules. Their health and cost should reflect how easily the opponent can reach them and how much value they generate while protected.

### Flying

Every unit with flying movement must use the Flying role. Flying is a complete chassis identity, not a secondary role modifier, even when the unit also has a narrow job such as bombing, salvo fire, or back-line pressure.

Flying units continuously advance through occupied cells and may attack while moving. That mobility and access are powerful, so flying units should have less health than comparable ground units and pay for reliable cross-formation access through cost, damage, range, or targeting constraints.

### Specialist

Specialists are ground units whose primary value comes from a narrow tactical niche rather than ordinary lane fighting. Examples include dedicated anti-air platforms, displacement units, evasive flankers, stealth infiltrators, and ground units designed to bypass conventional combat rules.

A specialist should be meaningfully better than general-purpose units at its intended job and meaningfully worse outside that job. Avoid labeling a broadly useful unit as a specialist just because it has one secondary tag.

### Structure

Structures are stationary enemy tools used to shape missions and formations. Every structure must be AI-only. The unit factory automatically adds both `stationary` and `ai-only` tags to Structure-role units; do not bypass that path.

Structures should have substantially more health than mobile units. Their lack of movement and player availability should be reflected in a separate durability tier, normally well above even heavy front-line units, while their cost and offensive output account for their positional reliability.

## Ability-specific rules

- Flying bomb units use the Flying role and combine the Flying, Bomb, and area-damage tags as needed.
- Bomb units should have very high attack values because they normally attack once and sacrifice themselves. Their cost, health, delivery reliability, area of effect, and ability to detonate on destruction are the balancing constraints.
- Dedicated anti-air ground units should usually be Specialists. A general-purpose ranged unit may carry anti-air as a secondary capability only when it remains useful against ground targets and pays for that flexibility.
- Units designed to dodge, infiltrate, or push enemies should usually be Specialists unless the effect is clearly secondary to a conventional melee or ranged identity.
- Area damage, swivel targeting, salvo attacks, and persistent auras multiply the value of raw stats. Tune their cost and base attack conservatively.

## Balancing workflow

1. Write the intended battlefield job and counterplay before changing numbers.
2. Choose the role that describes the primary tactical identity, then add tags for mechanics.
3. Compare health, attack, range, and cost with the closest existing units in that role.
4. Run `npm test` and `npm run balance`.
5. Review mirrored win rate, surviving/base margin, marginal mixed-army contribution, objective pressure, and timeout rate separately.
6. Inspect matchup outliers rather than relying only on the aggregate rating. Confirm that strong and weak matchups make thematic sense.
7. Play or inspect representative mixed formations, especially for support, flying, and specialist units.
8. After an intentional and understood balance change, update the regression envelope with `npm run balance:accept` and commit it with the unit changes.

The automated ratings are guardrails, not a substitute for judgment. A healthy unit may have a mediocre duel score when its contribution and objective-pressure scores demonstrate that it fulfills a useful niche.
