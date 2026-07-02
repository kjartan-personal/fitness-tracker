# Personal Hypertrophy App — Spec v1

A single-user Progressive Web App (PWA) for building muscle mass through
prescribed strength training and lightweight protein tracking. Built for personal
use only — no App Store submission, no multi-user support, no accounts.

---

## 1. Goals & Constraints

**Primary goal:** Build muscle mass via prescribed, progressively overloaded
strength training, supported by adequate protein intake.

**Hard constraints:**
- **Platform:** PWA (installable to iOS home screen). No native app, no App Store.
- **Single user:** the app's owner. No login, no sync server required for v1.
- **Time budget:** 45-minute sessions, every other day (~3–4 sessions/week).
- **Equipment:** full commercial gym (barbells, dumbbells, machines, cables).
- **Units:** metric (kg).

**Known PWA limitations (accepted):**
- No HealthKit access → bodyweight is entered manually.
- Push notifications on iOS are unreliable → no reliance on them for core flow.

---

## 2. Training Engine

### 2.1 Split & schedule
- **Upper/Lower split**, alternated each session.
- Every-other-day cadence → each muscle group trained ~2x/week.
- Sessions sized to fit **45 minutes** (≈ 5–6 exercises, rest included).

### 2.2 Mesocycle structure (fixed blocks)
- One mesocycle = **5 weeks**: 4 accumulation weeks + 1 deload week.
- **Accumulation:** volume/intensity climb week over week.
- **Deload (week 5):** reduced load and sets to dissipate fatigue.
- At the end of a block, the app **auto-starts a new mesocycle** with **rotated
  accessory exercises** (primary compounds stay; accessories swap) to avoid
  staleness and stagnation.

### 2.3 Progression model (double progression)
- Each exercise has a target **rep range** (e.g. 8–12) and a **set count**.
- When the user hits the **top of the rep range on all prescribed sets**, the app
  **auto-suggests a weight increase** next session and resets reps to the bottom
  of the range.
- Between those points, the user is pushed to **add reps** session over session.
- Increments are exercise-aware (smaller jumps for isolation, larger for compounds).
- **All suggestions are overridable** — the user logs what they actually did.

### 2.4 Workout prescription flow
- App opens to **"Today's Workout"** showing the prescribed session.
- Each exercise lists: name, target sets × rep range, suggested working weight
  (from last performance + progression logic), and last-session reference.
- User logs actual weight + reps per set; app validates against progression rules.
- Optional rest timer between sets.
- On finish, session is saved and next session's prescription updates.

### 2.4b Rest periods & session timing

To keep every session inside the **45-minute budget**, the app assigns a default
rest period per exercise type and runs an auto-starting rest timer between sets.

| Exercise type | Default rest | Rationale |
|---|---|---|
| Heavy compound anchors (bench, OHP, squat, RDL, barbell row) | **2:00–2:30** | Needs full recovery for strength/overload |
| Secondary compounds (incline press, hack squat, leg press, pulldown) | **1:30–2:00** | Moderate fatigue, balance recovery vs. time |
| Isolation / accessories (lateral raises, curls, extensions, leg curls, calves) | **0:45–1:15** | Smaller muscles recover fast; keeps pace up |

**Timekeeping logic:**
- App estimates total session time = (sets × rest) + working-set time, and shows a
  **projected duration** when the workout loads.
- If projected time exceeds ~45 min, the app **flags it** and can auto-trim — e.g.
  drop an accessory set or shorten an accessory rest — with the user's confirmation.
- Rest timer auto-starts when a set is logged; a subtle alert fires at the end.
- Rest defaults are **user-adjustable** per exercise if they prefer more/less.

### 2.5 Exercise library & rotation

The app **selects exercises automatically**; the user supplies a starting weight
for each prescribed exercise (see 2.6). Every movement pattern has one **anchor**
(kept across all blocks for progression continuity) plus a pool of **variations**
and **accessories** that **rotate each new mesocycle**.

**Rotation rule:** at each new block, anchors stay; the specific variation for each
pattern advances to the next option in its pool, and accessory exercises swap.
This delivers novelty without losing progression on the core lifts.

#### Upper day pool (~6 exercises/session)

| Pattern | Anchor (kept) | Rotating variations / accessories |
|---|---|---|
| Horizontal push | Barbell bench press | Incline DB press, machine chest press, flat DB press |
| Vertical push | Overhead press (barbell) | Seated DB shoulder press, machine shoulder press |
| Horizontal pull | Barbell row | Chest-supported row, seated cable row, machine row |
| Vertical pull | Pull-up / lat pulldown | Wide-grip pulldown, neutral-grip pulldown |
| Side delts (accessory) | — | DB lateral raise, cable lateral raise |
| Arms (accessory) | — | Biceps: DB curl / cable curl / EZ-bar curl; Triceps: rope pushdown / overhead extension / dips |

#### Lower day pool (~5–6 exercises/session)

| Pattern | Anchor (kept) | Rotating variations / accessories |
|---|---|---|
| Squat | Back squat | Hack squat, leg press, front squat |
| Hinge | Romanian deadlift | Conventional deadlift, hip thrust |
| Single-leg (accessory) | — | Bulgarian split squat, walking lunge, leg press (single) |
| Quad isolation (accessory) | — | Leg extension |
| Hamstring isolation (accessory) | — | Seated leg curl, lying leg curl |
| Calves (accessory) | — | Standing calf raise, seated calf raise |

> Pools are seed defaults — the user can swap or disable any exercise (e.g. skip a
> lift their gym lacks or they dislike), and the rotation respects those choices.

### 2.6 Starting weights & onboarding

- On first run, the app generates **Block 1** (the first set of upper/lower exercises).
- For each prescribed exercise, the user **enters a starting working weight**.
- Subsequent sessions and blocks derive weights automatically from logged
  performance + progression logic — no further manual setup needed.
- When a **new exercise enters** via rotation, the app asks for its starting weight
  once (or estimates from a related lift, user-confirmable).

---

## 3. Nutrition Module (lightweight)

### 3.1 Protein target
- Calculated from bodyweight: **default 1.8 g/kg/day** (adjustable 1.6–2.2 g/kg).
- At 75 kg default → **~135 g protein/day**.
- Recalculates when bodyweight is updated.

### 3.2 Calorie guidance (optional, light)
- Modest surplus target derived from bodyweight + activity for lean muscle gain.
- Displayed as guidance; **calorie logging is optional**, protein is the
  primary tracked metric.

### 3.3 Daily logging
- **Quick protein log:** running tally toward the daily target (add grams as you go).
- **"Ate well today" check:** simple daily yes/no for diet quality.
- Daily view shows protein progress ring + the diet-quality check.

---

## 4. Data & Metrics

### 4.1 Tracked data
- Workout history (per exercise: weight, reps, sets, date).
- Bodyweight log (manual, weekly cadence suggested).
- Daily protein totals + diet-quality checks.
- Current mesocycle position (block #, week, session).

### 4.2 Progress views
- **Per-exercise trend:** estimated 1RM / volume over time.
- **Bodyweight trend.**
- **Protein adherence:** % of days hitting target over time.
- **Mesocycle overview:** where you are in the current block.

### 4.3 Storage & backup
- All data stored **locally on-device** (e.g. IndexedDB).
- **Export/import** (JSON) for manual backup so history is never lost.

---

## 5. Screens (v1)

1. **Today** — prescribed workout + logging, OR rest-day view with protein tally.
2. **Log Workout** — active session screen (sets, reps, weight, rest timer).
3. **Nutrition** — protein tally, diet check, targets.
4. **Progress** — exercise trends, bodyweight, protein adherence, mesocycle status.
5. **Settings** — bodyweight, protein g/kg, units, export/import, reset block.

---

## 6. Out of Scope (v1)

- Multi-user / accounts / cloud sync.
- Full macro tracking (carbs/fats), barcode scanning, food database.
- Cardio / running / mobility tracking.
- HealthKit / wearable integration.
- Social, sharing, coaching AI.

---

## 7. Open Questions / Future Ideas

- Optional cloud backup later (e.g. to a personal file/Drive) if local-only
  feels risky.
- Exercise library could later include form notes / video links per movement.
- Possible "estimate from related lift" helper when a rotated-in exercise has no
  history (e.g. infer incline DB press start from flat bench).
