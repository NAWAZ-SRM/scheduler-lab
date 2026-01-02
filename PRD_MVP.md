# Scheduling Theory Workbench — MVP Product Requirements Document

**Version:** 2.0.0 (MVP Edition)  
**Status:** Ready for Development  
**Target:** Developer / AI Coding Agents  
**Scope:** Authentication + Pre-built Algorithms + Load Builder + Play Area + Custom Scheduler  

---

## What This Document Is

This is the complete specification for building the **MVP version** of the Scheduling Theory Workbench. It is intentionally scoped down from the full vision to what one developer can realistically build and ship. Every feature described here is in scope. Everything else is not.

A coding agent should be able to read this document top-to-bottom and have 100% of the context needed to implement the project without asking any clarifying questions.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Flow (End-to-End)](#2-user-flow-end-to-end)
3. [Feature 1 — Authentication](#3-feature-1--authentication)
4. [Feature 2 — Load Builder (Workload Input)](#4-feature-2--load-builder-workload-input)
5. [Feature 3 — Pre-built Algorithm Selector](#5-feature-3--pre-built-algorithm-selector)
6. [Feature 4 — Play Area (Parameter Sliders)](#6-feature-4--play-area-parameter-sliders)
7. [Feature 5 — Custom Scheduler Editor](#7-feature-5--custom-scheduler-editor)
8. [Feature 6 — Output & Visualization](#8-feature-6--output--visualization)
9. [Technical Architecture](#9-technical-architecture)
10. [Database Schema](#10-database-schema)
11. [API Specification](#11-api-specification)
12. [Frontend Component Architecture](#12-frontend-component-architecture)
13. [Simulation Engine](#13-simulation-engine)
14. [Repository Structure](#14-repository-structure)
15. [Environment Variables](#15-environment-variables)
16. [Development Roadmap](#16-development-roadmap)
17. [Glossary](#17-glossary)

---

## 1. Product Overview

### What It Is

A browser-based tool where engineers and students can:

1. Describe a workload (a stream of incoming tasks/jobs) using a visual form
2. Pick from 6 pre-built scheduling algorithms and tweak their parameters via sliders
3. Write their own custom scheduler in JavaScript (20–50 lines)
4. Run a simulation and instantly see how the scheduler performed via a Gantt chart and live metrics

### What It Is NOT (MVP scope exclusions)

- No leaderboard
- No community template sharing
- No Kubernetes / systemd export
- No genetic optimizer
- No real-time streaming (simulation completes, then results render all at once)
- No Redis, no Celery — simulations run synchronously in FastAPI

### Core Value Proposition

> "I want to know if SRPT with a small priority boost for GPU jobs would reduce my p95 latency. Let me test it in 30 seconds without writing a simulator."

### Tech Stack Summary

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| State | Zustand |
| Charts | Recharts (metrics) + custom SVG/Canvas (Gantt) |
| Code Editor | Monaco Editor (lazy-loaded) |
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.x (async) + Alembic |
| Auth | JWT (email + password) — no OAuth for MVP |
| Deployment | Docker + Docker Compose |

---

## 2. User Flow (End-to-End)

This is the single golden path every feature must support:

```
[Landing Page]
      |
      v
[Sign Up / Log In]  <- email + password, JWT issued
      |
      v
[Dashboard]  <- list of past simulation runs + "New Simulation" button
      |
      v
[Workbench Page]  <- the core of the app, 3 panels:
  |
  |-- LEFT PANEL: Load Builder
  |     User describes their workload using a form
  |     (presets + sliders + optional JSON override)
  |
  |-- CENTER PANEL: Algorithm Selector + Play Area
  |     Pick one pre-built algorithm OR open custom editor
  |     Tweak parameters via sliders
  |
  +-- RIGHT PANEL: Output
        Empty until simulation is run
        After clicking "Run": Gantt chart + metrics appear
        User can compare up to 3 algorithm runs side-by-side
```

---

## 3. Feature 1 — Authentication

### 3.1 Scope

Simple email + password authentication with JWT. No OAuth for MVP. No social login. Users must be authenticated to run simulations (so they can access their history). The workbench page itself and the pre-built algorithm descriptions are publicly viewable but "Run" is gated behind auth.

### 3.2 Pages

#### `/` — Landing Page
- Hero: name, one-line description, animated preview of Gantt chart (static image/GIF)
- "Get Started" button -> `/signup`
- "Log In" button -> `/login`
- Brief feature list: Load Builder, 6 Algorithms, Custom Scheduler, Gantt output

#### `/signup` — Registration
- Fields: `username` (3-20 chars, alphanumeric + underscore), `email`, `password` (min 8 chars), `confirm password`
- Validation errors shown inline
- On success: JWT issued, user redirected to `/dashboard`

#### `/login` — Login
- Fields: `email`, `password`
- On success: JWT issued (stored in `localStorage` as `auth_token`), redirect to `/dashboard`
- "Forgot password?" link -> show message "Password reset is not available in this version."

#### `/dashboard` — User Home
- Header: username + "New Simulation" button
- List of past simulation runs in a table:
  - Columns: Run Name, Algorithm Used, Workload Preset, p95 Latency, Throughput, Fairness, Date, Actions (View / Delete)
  - "View" -> loads that simulation's results in `/workbench/:runId`
  - Empty state: "No simulations yet. Start one ->"

### 3.3 Auth Flow Details

- JWT issued on login/signup, stored in `localStorage` key `auth_token`
- JWT payload: `{ user_id, username, email, exp }`
- JWT expiry: 30 days
- All API endpoints that require auth check `Authorization: Bearer <token>` header
- On 401 response anywhere: clear `localStorage`, redirect to `/login`
- Axios interceptor adds the token to all requests automatically

### 3.4 Backend Auth Endpoints

```
POST /api/auth/signup    -> { access_token, user: { id, username, email } }
POST /api/auth/login     -> { access_token, user: { id, username, email } }
GET  /api/auth/me        -> { id, username, email, created_at }
```

### 3.5 Password Storage

Passwords hashed with **bcrypt** (cost factor 12). Never stored in plain text. Never logged.

---

## 4. Feature 2 — Load Builder (Workload Input)

### 4.1 Design Philosophy

The load builder is the most important UX decision in this product. The user needs to describe "the kind of work that arrives at my system." This is inherently abstract.

**Our solution: a two-layer input system.**

- **Layer 1 (default):** A form with preset scenarios and parameter sliders that generates a workload automatically. 80% of users stop here.
- **Layer 2 (advanced):** A JSON editor where power users can paste exact job definitions. This overrides the form.

### 4.2 Layer 1 — Scenario Builder Form

The form has three sections: a **Scenario Preset** picker, **Arrival Settings**, and **Job Shape Settings**.

#### Section A: Scenario Preset (pick one)

Clicking a preset fills in all sliders with sensible defaults. Users can then adjust sliders after picking a preset.

| Preset Name | Description | What It Sets |
|-------------|-------------|--------------|
| **Web API Server** | Many short requests, occasional slow ones | 200 jobs, Poisson arrivals lambda=20/s, duration: Pareto heavy-tail (mostly 10-100ms, occasional 2s+), no deadlines, no GPU |
| **ML Training Queue** | Periodic batch jobs with long runtimes | 30 jobs, periodic every 60s, duration: Normal(1800s, 300s), no deadlines, 70% need GPU |
| **Video Transcoding** | Bursty traffic, medium-duration jobs with soft deadlines | 80 jobs, bursty arrivals, duration: LogNormal(u=120s, sigma=0.8), 60% have deadlines, no GPU |
| **Mixed Workload** | Realistic blend: short web + long batch + bursty video | 150 jobs, mixed arrivals, mixed durations, 30% deadlines, 20% GPU |
| **Stress Test** | High concurrency, tight deadlines | 500 jobs, Poisson lambda=50/s, duration: Exponential(mean=200ms), 80% have tight deadlines |
| **Custom** | All sliders at neutral defaults, user configures everything | 50 jobs, Poisson lambda=10/s, Uniform duration 100-500ms, no deadlines, no GPU |

#### Section B: Arrival Settings

| Slider / Input | Label Shown | Range | Default (Custom preset) | What It Controls |
|---------------|-------------|-------|------------------------|-----------------|
| Total Jobs | "Number of Jobs" | 10 - 500 | 50 | Total jobs generated for the simulation |
| Arrival Pattern | Dropdown (not slider) | Poisson, Bursty, Periodic, Uniform | Poisson | Shape of the arrival time distribution |
| Arrival Rate | "Avg Arrivals/sec" (lambda) | 1 - 100 | 10 | Mean arrival rate for Poisson; peak rate for Bursty |
| Simulation Window | "Simulate for (seconds)" | 10 - 600 | 120 | Total simulated time before the run ends |

**Arrival pattern details (used by the simulation engine):**
- **Poisson:** inter-arrival times ~ Exponential(1/lambda). Standard memoryless model for web traffic.
- **Bursty:** Alternates between high-load bursts (lambda x 5, duration 10s) and quiet periods (lambda x 0.2, duration 30s). Models video streaming / flash sales.
- **Periodic:** One job arrives every (1/lambda) seconds, exactly. Models cron jobs and ML training pipelines.
- **Uniform:** Jobs spread evenly across the simulation window. Models theoretical baselines.

#### Section C: Job Shape Settings

| Slider | Label Shown | Range | Default | What It Controls |
|--------|-------------|-------|---------|-----------------|
| Job Duration — Min | "Min Job Duration (ms)" | 10ms - 10,000ms | 100ms | Lower bound of duration distribution |
| Job Duration — Max | "Max Job Duration (ms)" | 100ms - 600,000ms | 500ms | Upper bound of duration distribution |
| Duration Spread | "Duration Variance" | 1 (tight) - 10 (wild) | 3 | Controls how spread out durations are. Higher = more outliers. Implemented as the shape parameter of a Pareto distribution when > 5, otherwise Log-Normal sigma. |
| % Jobs with Deadlines | "Jobs with Deadlines (%)" | 0% - 100% | 0% | What fraction of jobs have a hard deadline |
| Deadline Tightness | "Deadline Window" | 1.2x - 5x expected duration | 2x | Deadline = arrival_time + (duration * tightness). Only visible if Deadline % > 0. |
| % GPU Jobs | "GPU-Dependent Jobs (%)" | 0% - 100% | 0% | What fraction of jobs require a GPU slot. Only relevant if cluster has GPUs. |
| Priority Spread | "Priority Diversity" | 1 (all equal) - 5 (wide spread) | 1 | Controls how varied priorities are. 1 = all priority 0.5. 5 = full range 0.0-1.0 uniform. |

#### Section D: Cluster Size

| Input | Label | Range | Default |
|-------|-------|-------|---------|
| CPU Slots | "CPU Cores" | 1 - 64 | 8 |
| GPU Slots | "GPU Units" | 0 - 8 | 0 |
| Max Concurrent Jobs | "Max Parallel Jobs" | 1 - 64 | 8 |

> **Implementation note:** The simulation engine models slots, not fine-grained CPU fractions. A job occupies 1 slot while running. GPU jobs occupy 1 GPU slot AND 1 regular slot. This is simple to implement and still produces meaningful scheduling insights.

### 4.3 Layer 2 — JSON Override (Advanced Mode)

A toggle button **"Advanced: Paste custom jobs"** expands a Monaco editor containing a JSON array. When the user pastes custom JSON and clicks "Use This Workload", the form sliders are hidden and the JSON takes priority.

**JSON Format for custom jobs:**

```json
[
  {
    "id": "job-1",
    "arrival_time": 0,
    "duration": 200,
    "priority": 0.8,
    "requires_gpu": false,
    "deadline": null
  },
  {
    "id": "job-2",
    "arrival_time": 50,
    "duration": 1500,
    "priority": 0.3,
    "requires_gpu": true,
    "deadline": 3000
  }
]
```

**Field definitions for custom JSON:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique identifier for this job |
| arrival_time | number (ms) | Yes | When this job arrives in the simulation |
| duration | number (ms) | Yes | How long this job takes to complete if given resources |
| priority | number 0.0-1.0 | No (default: 0.5) | Higher = more urgent |
| requires_gpu | boolean | No (default: false) | Whether this job needs a GPU slot |
| deadline | number (ms) or null | No (default: null) | Absolute deadline ms from simulation start. Null = no deadline. |
| owner | string | No (default: "default") | Team/user label for CFS fairness grouping |

**Validation rules:**
- Must be a valid JSON array
- Each item must have `id`, `arrival_time`, `duration`
- `id` values must be unique
- `arrival_time` >= 0, `duration` >= 1
- `priority` if present: 0.0 to 1.0
- Maximum 500 jobs
- If validation fails: show error inline with specific field and job index

### 4.4 Workload Preview

After the user configures the load builder, a **"Preview"** section below the form shows:

- **Estimated total jobs:** N
- **Estimated simulation duration:** X seconds
- **Expected arrival pattern:** a small sparkline chart (50px tall, 200px wide) showing approximate arrival rate over time (lightweight client-side preview, not a real simulation)
- **Resource warnings:** e.g., "8 jobs need a GPU slot — your cluster has 0 GPUs. GPU jobs will queue until slots free up."

This preview updates reactively as sliders change (debounced 300ms). It does NOT run the actual simulation.

---

## 5. Feature 3 — Pre-built Algorithm Selector

### 5.1 Overview

The user picks one algorithm to run. They can also pick up to 2 additional algorithms to compare. All selected algorithms run against the same workload, and results are shown side-by-side.

Algorithms are displayed as **cards**. Each card has:
- Algorithm name + one-sentence description
- Strength tag + weakness tag
- A "Select" button (toggles selection, max 3)
- A "Learn More" link that expands an inline description panel

### 5.2 The 6 Built-in Algorithms

---

#### FCFS — First Come, First Served

> **One sentence:** Jobs are processed in the exact order they arrive — simple, but short jobs get stuck behind long ones.

**How it works:** The ready queue is sorted by `arrival_time` ascending. The scheduler always picks the front — earliest arrival. Non-preemptive: once a job starts, it runs to completion.

**Strength:** `Simple` `No starvation` `Fair by arrival time`  
**Weakness:** `Convoy effect` `High avg latency` `Short jobs stuck behind long ones`

**The convoy effect:** A 10ms job arriving 1ms after a 10-second job waits 10 seconds. FCFS has no way to see this is wasteful.

**No configurable parameters.**

---

#### SJF — Shortest Job First

> **One sentence:** Always pick the shortest job available — minimizes average wait time, but long jobs can starve.

**How it works:** Ready queue sorted by `duration` ascending. Always picks smallest job. Non-preemptive.

**Strength:** `Minimizes avg wait time` `Good p50 latency`  
**Weakness:** `Long jobs can starve` `Requires duration estimates`

**No configurable parameters.**

---

#### SRPT — Shortest Remaining Processing Time

> **One sentence:** Preemptive SJF — interrupts running jobs when a shorter one arrives, giving optimal average completion time.

**How it works:** At every job arrival and completion, the scheduler asks: "Is there a job with less remaining work than what's running?" If yes, it preempts the running job and starts the shorter one. The preempted job goes back to the ready queue with its updated `remaining_time`.

**Strength:** `Optimal avg flow time` `Excellent p95 latency` `Great for mixed workloads`  
**Weakness:** `Long jobs can starve` `High preemption overhead`

**Configurable parameters (Play Area sliders):**

| Slider | Label | Range | Default | Effect |
|--------|-------|-------|---------|--------|
| Starvation Guard | "Max wait before priority boost (seconds)" | 0 (off) - 60s | 0 (off) | If a job waits longer than this, its effective remaining_time is halved for scheduling purposes |

---

#### EDF — Earliest Deadline First

> **One sentence:** Always run the job with the nearest deadline — provably optimal for meeting deadlines when the system isn't overloaded.

**How it works:** Ready queue sorted by `deadline` ascending. Always picks the job whose deadline is soonest. Preemptive. Jobs without deadlines are treated as if `deadline = +Infinity`.

**Important:** EDF degrades badly when overloaded. Missing one deadline causes others to miss too (domino effect). The slack parameter mitigates this.

**Strength:** `Optimal deadline adherence` `Real-time systems`  
**Weakness:** `Degrades catastrophically when overloaded` `Needs deadlines on jobs`

**Configurable parameters:**

| Slider | Label | Range | Default | Effect |
|--------|-------|-------|---------|--------|
| Slack Threshold | "Min slack to accept job (%)" | 0% - 80% | 0% | If a job's remaining time > remaining slack x threshold, deprioritize it to prevent overload cascades |
| Non-deadline Weight | "Priority of jobs without deadlines" | 0.0 - 1.0 | 0.5 | Scales priority of no-deadline jobs so they aren't completely blocked |

---

#### Round Robin (RR)

> **One sentence:** Every job gets a fixed time slice in rotation — fair and starvation-free, but inefficient for mixed job sizes.

**How it works:** Jobs are in a circular queue. Each runs for a fixed time quantum (e.g., 50ms). When the quantum expires, the job is preempted to the back of the queue.

**Strength:** `Perfect starvation prevention` `Predictable` `Fair by design`  
**Weakness:** `Poor p95 for large jobs` `Bad throughput for mixed sizes` `High context-switch overhead`

**Configurable parameters:**

| Slider | Label | Range | Default | Effect |
|--------|-------|-------|---------|--------|
| Time Quantum | "Time Slice (ms)" | 10ms - 1,000ms | 50ms | Duration each job gets before being preempted |
| Priority Boost | "Priority multiplier for high-priority jobs" | 1x - 3x | 1x | High-priority jobs (priority > 0.7) get this many quantum lengths per turn |

---

#### CFS — Completely Fair Scheduler (simplified)

> **One sentence:** Tracks how much CPU time each "owner" has received and always runs the one who has received the least — near-perfect fairness over time.

**How it works:** Each job belongs to an `owner`. The scheduler tracks `virtual_runtime` per owner (time run, weighted by priority). Always picks the job belonging to the owner with the smallest `virtual_runtime`. If a new owner joins, they start at the current minimum `virtual_runtime` to avoid backlog advantage.

**Strength:** `Excellent long-run fairness` `Multi-user fairness` `Linux default`  
**Weakness:** `Higher avg latency than SRPT` `Needs owner info in workload`

**Note:** CFS only shows interesting behavior when jobs have different `owner` values. Use the JSON override with an `owner` field on each job to test multi-owner workloads.

**Configurable parameters:**

| Slider | Label | Range | Default | Effect |
|--------|-------|-------|---------|--------|
| Min Granularity | "Min run time before preemption (ms)" | 1ms - 100ms | 4ms | Won't preempt a job that has run less than this. Reduces context-switch overhead. |
| Latency Target | "Target scheduling latency (ms)" | 10ms - 500ms | 48ms | CFS tries to give every runnable job one turn within this window. |

---

### 5.3 Algorithm Card UI

```
+------------------------------------------+
|  [o]  SRPT                  [Selected v] |
|  Shortest Remaining Processing Time      |
|                                          |
|  Best for: mixed workloads, p95 latency  |
|  Watch out: long jobs can starve         |
|                                          |
|  [v Learn More]    [Select / Deselect]   |
+------------------------------------------+
```

When "Learn More" is expanded, the card shows the full description from Section 5.2, rendered as formatted text.

### 5.4 Algorithm Selection Rules

- Minimum 1 algorithm selected at all times
- Maximum 3 algorithms selected simultaneously
- First selected algorithm is the "primary" (shown prominently in results)
- Additional algorithms are "comparison" (secondary color in results)
- If user tries to deselect all algorithms: show inline warning, keep last one selected

---

## 6. Feature 4 — Play Area (Parameter Sliders)

### 6.1 What the Play Area Is

A section directly below the algorithm selector showing **sliders that modify the selected algorithm's behavior**. When FCFS or SJF is selected (no parameters), the Play Area shows: "This algorithm has no configurable parameters."

Each algorithm's sliders are defined in Section 5.2 above.

### 6.2 Slider Behavior

- Slider updates the parameter value instantly
- Current value shown numerically beside the slider (e.g., `Time Quantum: 50ms`)
- A **"Reset to defaults"** button per algorithm restores all its sliders to defaults
- Slider values are preserved in session state — switching away and back restores values
- Slider values are saved when a run is saved, and restored when loading a past run

### 6.3 Global Sliders (apply to all algorithms)

| Slider | Label | Range | Default | Effect |
|--------|-------|-------|---------|--------|
| Starvation Threshold | "Flag jobs waiting longer than (seconds)" | 1s - 120s | 30s | Jobs waiting longer than this are flagged as "starving" and highlighted in the Gantt output |
| Preemption Cost | "Context switch overhead (ms)" | 0ms - 10ms | 0ms | Added to every preemption event as overhead. Models real OS scheduling costs. |

---

## 7. Feature 5 — Custom Scheduler Editor

### 7.1 What It Is

A Monaco code editor (VS Code in browser, loaded lazily) that lets users write their own scheduling algorithm in JavaScript. It appears when the user clicks **"+ Custom Scheduler"** in the algorithm area.

A custom scheduler is treated as a 7th algorithm option. It can be selected alongside pre-built algorithms for comparison.

### 7.2 The Scheduler Contract

Every custom scheduler must define a function named exactly `schedule`:

```javascript
/**
 * @param {Job[]} readyJobs     - Jobs that have arrived and are waiting to run
 * @param {Job[]} runningJobs   - Jobs currently executing
 * @param {Cluster} cluster     - Current cluster resource state
 * @param {number} now          - Current simulation time in milliseconds
 * @returns {Job | null}        - The job to run next, or null to run nothing
 */
function schedule(readyJobs, runningJobs, cluster, now) {
  // Write your logic here
  return readyJobs[0] ?? null;
}
```

The function is called by the simulation engine every time:
- A new job arrives
- A running job completes
- A preemption check fires (if `schedule.preemptive = true`)

### 7.3 Job Object Available in Custom Scheduler

```typescript
interface Job {
  id: string;
  arrivalTime: number;       // ms -- when this job arrived
  duration: number;          // ms -- total duration if never preempted
  remainingTime: number;     // ms -- how much work is left
  priority: number;          // 0.0-1.0, higher = more urgent
  requiresGpu: boolean;      // whether this job needs a GPU slot
  deadline: number | null;   // absolute deadline in ms, or null
  owner: string;             // team/user label for fairness grouping
  waitTime: number;          // ms -- how long this job has been waiting
  startTime: number | null;  // ms -- when it first started running
  preemptCount: number;      // how many times it has been preempted
}
```

### 7.4 Cluster Object Available in Custom Scheduler

```typescript
interface Cluster {
  totalSlots: number;
  freeSlots: number;
  totalGpuSlots: number;
  freeGpuSlots: number;
}
```

### 7.5 Declaring Preemption

```javascript
function schedule(readyJobs, runningJobs, cluster, now) {
  // ... your logic ...
}
schedule.preemptive = true;  // Add this line to enable preemption checks
```

When `schedule.preemptive = true`, the engine also calls your function at every job arrival to check if a running job should be preempted. If the function returns a job that is NOT currently running, the engine preempts the currently-running job with the most remaining time.

### 7.6 Sandbox Security

User code is executed in a PyMiniRacer (V8 embedded in Python) sandbox. The following are blocked via AST analysis (esprima) BEFORE execution:

- `eval()`, `Function()`, `new Function()`
- `while (true)`, `for (;;)` — unbounded loops
- `fetch()`, `XMLHttpRequest`, `WebSocket`
- `require()`, `import()`
- `setTimeout`, `setInterval`
- Access to `window`, `document`, `process`, `global`

**Execution limits:**
- Hard timeout: 50ms wall-clock per `schedule()` call
- Fresh execution context per simulation (no shared state between simulations)

If any limit is hit: simulation stops early and shows an error in the output panel.

### 7.7 Editor Features

- **TypeScript IntelliSense:** `Job` and `Cluster` type definitions pre-loaded. Auto-complete works.
- **Starter template:** Editor opens pre-filled with a simple priority-based example
- **Validate button:** Runs AST security check and reports errors without running the full simulation
- **Error display:** Errors shown as red squiggles in the editor AND as a message below
- **Name your scheduler:** Text input above editor for a display name (used in results)
- **Save:** "Save Scheduler" button saves code + name to database under user's account
- **My Saved Schedulers:** Dropdown below editor lists all previously saved schedulers — selecting one loads it

### 7.8 Starter Template (pre-filled in editor)

```javascript
function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;
  
  // Example: pick the job with highest priority
  return readyJobs.reduce((best, job) =>
    job.priority > best.priority ? job : best
  );
}
```

### 7.9 Examples Section (collapsible, below editor)

Three copy-paste examples shown in a collapsible panel:

**Example 1 — Strict Priority:**
```javascript
function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;
  return readyJobs.reduce((best, job) =>
    job.priority > best.priority ? job : best
  );
}
```

**Example 2 — Deadline + SRPT Hybrid:**
```javascript
function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;

  const DEADLINE_WEIGHT = 2.0;
  const SRPT_WEIGHT = 1.0;

  function score(job) {
    const deadlineUrgency = job.deadline
      ? DEADLINE_WEIGHT / Math.max(1, job.deadline - now)
      : 0;
    const remainingUrgency = SRPT_WEIGHT / Math.max(1, job.remainingTime);
    return deadlineUrgency + remainingUrgency;
  }

  return readyJobs.reduce((best, job) =>
    score(job) > score(best) ? job : best
  );
}
schedule.preemptive = true;
```

**Example 3 — Anti-Starvation SRPT:**
```javascript
function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;

  const STARVATION_THRESHOLD_MS = 10000; // 10 seconds

  function effectiveRemaining(job) {
    if (job.waitTime > STARVATION_THRESHOLD_MS) {
      return job.remainingTime * 0.5; // boost starving jobs
    }
    return job.remainingTime;
  }

  return readyJobs.reduce((best, job) =>
    effectiveRemaining(job) < effectiveRemaining(best) ? job : best
  );
}
schedule.preemptive = true;
```

---

## 8. Feature 6 — Output & Visualization

### 8.1 When Output Appears

The output panel (right side) is empty until the user clicks **"Run Simulation"**. During simulation:
- Button shows spinner, labeled "Simulating..."
- A progress bar (0-100%) streams from backend via SSE
- Progress messages shown: "Generating workload...", "Running SRPT...", "Computing metrics..."

When complete:
- Results appear in the output panel
- A success toast: "Simulation complete — 3,241 events processed in 1.8s"
- A "Save Run" form appears

### 8.2 Output Structure

```
+-----------------------------------------------------------+
|  Section A: Metrics Summary Cards (top row)              |
|  [p95 Latency]  [Throughput]  [Fairness]  [Deadline Miss%]|
+-----------------------------------------------------------+
|  Section B: Gantt Chart (largest section)                 |
|  Job execution timeline with color coding                 |
+-----------------------------------------------------------+
|  Section C: Supporting Charts (bottom, tabbed)            |
|  [Queue Depth]  [Latency CDF]  [Utilization]              |
+-----------------------------------------------------------+
```

### 8.3 Section A — Metrics Summary Cards

Four cards displayed in a horizontal row. If multiple algorithms were selected, each card shows all algorithms side-by-side with color coding.

**Card 1: p95 Latency**
- Value: 95th percentile of (completion_time - arrival_time), in ms
- Format: `142 ms`
- Color: Green if < 500ms, Yellow if 500ms-2s, Red if > 2s
- Tooltip: "95% of jobs completed within this time."
- Multi-algo: horizontal bar mini-comparison below primary value

**Card 2: Throughput**
- Value: total_completed_jobs / simulation_duration_seconds
- Format: `14.7 jobs/sec`
- Tooltip: "How many jobs the scheduler completed per second on average."

**Card 3: Jain's Fairness Index**
- Formula: `J = (sum(xi))^2 / (n * sum(xi^2))` where xi = CPU time fraction received by owner i
- Range 0.0-1.0, displayed as percentage: `87%`
- Color: Green if > 80%, Yellow if 50-80%, Red if < 50%
- If all jobs have the same owner: show "N/A — single owner workload"

**Card 4: Deadline Miss Rate**
- Value: missed_deadlines / total_jobs_with_deadlines, as percentage
- Format: `12.5% missed` or `0 missed (all met)`
- Color: Green if 0%, Yellow if 1-20%, Red if > 20%
- If no jobs have deadlines: "No deadlines in workload"

### 8.4 Section B — Gantt Chart

The Gantt chart is the primary output. Custom SVG/Canvas visualization of job execution.

**Axes:**
- **X-axis:** Time (ms), from simulation start to end. Labeled with time markers.
- **Y-axis:** Execution slots (rows). One row per parallel slot (e.g., 4 slots = 4 rows).

**What each job bar shows:**
- Rectangle from first_start_time to completion_time
- If preempted: bar has visible gaps showing periods when job was paused and another job ran
- Color coding: see below

**Additional markers:**
- Small downward triangle above timeline on arrival time of each job
- Vertical red dashed line at each job's deadline (if it has one)
- Orange outline on bars for jobs that exceeded the starvation threshold

**Color Coding:**
Jobs are colored by their `owner` field. If all jobs share `"default"` owner (most form-based workloads), fall back to coloring by arrival quartile:
- Q1 (first 25% to arrive): Blue
- Q2: Green
- Q3: Amber
- Q4 (last 25%): Purple

If the JSON override specifies multiple `owner` values, each owner gets a distinct color (8-color palette, repeats beyond 8).

**Interactivity:**
- **Hover over a job bar:** Shows tooltip:
  ```
  Job ID: job-42
  Owner: team-alpha
  Arrived: 1,200ms | Started: 1,350ms | Completed: 1,900ms
  Wait time: 150ms | Run time: 550ms
  Preempted: 2 times
  Priority: 0.8
  Deadline: 2,000ms [Met]
  ```
- **Click a job bar:** "Pins" the tooltip (stays visible when mouse moves). Click again to unpin.
- **Scroll wheel:** Zoom in/out on the time axis.
- **Click and drag:** Pan left/right on the time axis.
- **Double-click:** Reset to full view.

**Multi-algorithm Gantt (stacked view):**

When multiple algorithms are selected, the Gantt switches to a stacked layout:
```
-- SRPT  [p95: 142ms] ------------------------------------------
  [slot 1] XXXXXX  XXXX  XXXXXXXXXX  XXX
  [slot 2] XXXXXXXX    XXXXXXXX  XXXXXXXXXX

-- FCFS  [p95: 891ms] ------------------------------------------
  [slot 1] XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  [slot 2] XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Each algorithm section is collapsible (click the algorithm name header to collapse).

**Implementation notes:**
- Render as SVG for <= 500 total job bars. Render as Canvas for > 500.
- SVG: use `<rect>` elements, D3 for x-axis scale
- Canvas: `requestAnimationFrame` render loop with manual hit-testing for hover
- Minimum bar width: 2px even if actual duration would render smaller at current zoom
- Maximum bars before viewport culling kicks in: 2000

### 8.5 Section C — Supporting Charts (Tabbed)

Three charts accessible via tabs.

**Tab 1: Queue Depth Over Time**
- Type: Recharts `LineChart`
- X-axis: Simulation time (ms)
- Y-axis: Number of jobs in the ready queue
- Shows spikes indicating periods where the scheduler can't keep up with arrivals
- Multi-algo: each algorithm as a separate colored line

**Tab 2: Latency CDF (Cumulative Distribution Function)**
- Type: Recharts `LineChart`
- X-axis: Latency in ms (log scale)
- Y-axis: Percentage of jobs (0%-100%)
- At latency value X: "X% of jobs completed within X ms"
- Vertical dashed markers at p50, p95, p99
- Multi-algo: each algorithm as a separate colored line

**Tab 3: Resource Utilization Over Time**
- Type: Recharts `AreaChart` (stacked)
- X-axis: Simulation time (ms)
- Y-axis: Number of slots in use (0 to Max Parallel Jobs)
- Areas: dark blue = CPU slots in use; orange = GPU slots in use; light gray = idle slots
- Multi-algo: separate chart per algorithm, stacked vertically

### 8.6 Save & Name Run

After results appear, a form at top of output panel:
```
Run name: [SRPT * Web API Server * 2025-07-15]  [Save to Dashboard]
```
- Default name auto-generated from algorithm + preset + date
- On save: stores complete run config + results to database
- Saved runs appear in `/dashboard`

### 8.7 Share Run

A "Share" button (next to Save) copies to clipboard: `http://host/share/<share_token>`

This URL:
- Shows the full output in read-only mode
- Requires no authentication to view
- Shows workload config, algorithm selection, slider values, and full output
- Has a "Try this config yourself" button that deep-links to `/workbench?from=<run_id>` and pre-fills all settings

---

## 9. Technical Architecture

### 9.1 Overview

```
[React Frontend]  <---- REST API + SSE ---->  [FastAPI Backend]
                                                      |
                                               [Simulation Engine]
                                               (pure Python, sync)
                                                      |
                                               [PostgreSQL Database]
```

No Redis. No Celery. No message queues. Simulations run synchronously inside a FastAPI route using `asyncio.run_in_executor` (to avoid blocking the event loop) and stream progress via Server-Sent Events (SSE).

### 9.2 Why SSE Instead of WebSocket

**Server-Sent Events (SSE)** is used for streaming simulation progress:
- Simpler than WebSocket (standard HTTP, no handshake)
- Unidirectional server-to-client — exactly what we need
- Natively re-connectable
- Visible in browser DevTools as standard HTTP requests

The simulation runs in a thread pool executor. It calls a `progress_callback(percent, message)` function at key milestones, which puts messages on an `asyncio.Queue`. The SSE endpoint reads from that queue and streams to the client.

### 9.3 Simulation Performance Expectations

With synchronous Python (no parallelism):
- 50 jobs, 120s sim: < 200ms real time
- 200 jobs, 300s sim: < 1s real time
- 500 jobs, 600s sim: < 5s real time

Acceptable for MVP. The simulation engine is a tight event loop with no I/O.

### 9.4 JS Sandbox for Custom Schedulers

Custom scheduler JS code executed using **PyMiniRacer** (V8 embedded in Python).

Before execution, code is parsed by **esprima** (Python AST parser for JS, available on PyPI) to check for security violations. If esprima detects any blocked patterns, the code is rejected without execution.

The sandbox call happens once per simulation event (job arrival or completion). With at most 500 jobs and bounded events, overhead is manageable.

### 9.5 FastAPI Structure

- SQLAlchemy async with `asyncpg` driver
- Pydantic v2 for all request/response schemas
- Dependency injection for DB sessions and current user
- CORS allowing `http://localhost:5173` in development
- All routes prefixed with `/api`
- OpenAPI docs at `/api/docs`

---

## 10. Database Schema

### Table: users

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: custom_schedulers

```sql
CREATE TABLE custom_schedulers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  code          TEXT NOT NULL,
  is_preemptive BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_schedulers_user ON custom_schedulers(user_id, updated_at DESC);
```

### Table: simulation_runs

```sql
CREATE TABLE simulation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(200),

  -- Full workload config snapshot
  workload_config   JSONB NOT NULL,

  -- Which algorithms were run with which slider values
  -- e.g. [{"algo": "srpt", "params": {"starvation_guard": 0}}, {"algo": "custom", "custom_scheduler_id": "uuid"}]
  algorithms_config JSONB NOT NULL,

  -- Full results per algorithm (metrics + gantt data + chart series)
  results           JSONB NOT NULL,

  -- Token for public sharing (no auth needed to read with this token)
  share_token       VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_simulation_runs_user ON simulation_runs(user_id, created_at DESC);
CREATE INDEX idx_simulation_runs_share ON simulation_runs(share_token);
```

### JSONB Structure: workload_config

```json
{
  "source": "form",
  "preset": "web_api_server",
  "total_jobs": 200,
  "arrival_pattern": "poisson",
  "arrival_rate": 20,
  "simulation_window": 120,
  "duration_min": 10,
  "duration_max": 2000,
  "duration_variance": 7,
  "pct_with_deadlines": 0,
  "deadline_tightness": 2.0,
  "pct_gpu_jobs": 0,
  "priority_spread": 2,
  "cluster_slots": 8,
  "cluster_gpu_slots": 0,
  "custom_jobs": null
}
```

When `source = "json"`, `custom_jobs` contains the full user-defined jobs array.

### JSONB Structure: results (one entry per algorithm)

```json
{
  "algo": "srpt",
  "algo_name": "SRPT",
  "params": { "starvation_guard": 0 },
  "metrics": {
    "p50_latency": 45.2,
    "p95_latency": 142.7,
    "p99_latency": 891.3,
    "throughput": 14.7,
    "fairness_index": 0.87,
    "deadline_miss_rate": 0.05,
    "total_jobs": 200,
    "completed_jobs": 197,
    "starved_jobs": 3,
    "total_preemptions": 412,
    "avg_queue_depth": 4.2
  },
  "gantt_data": {
    "slots": 8,
    "simulation_duration": 120000,
    "jobs": [
      {
        "id": "job-1",
        "owner": "default",
        "priority": 0.5,
        "arrival_time": 50,
        "deadline": null,
        "segments": [
          { "start": 120, "end": 320, "slot": 0 },
          { "start": 500, "end": 620, "slot": 2 }
        ],
        "completed_at": 620,
        "missed_deadline": false,
        "was_starving": false
      }
    ]
  },
  "queue_depth_series": [
    { "time": 0, "depth": 0 },
    { "time": 1000, "depth": 3 }
  ],
  "utilization_series": [
    { "time": 0, "slots_used": 0, "gpu_used": 0 },
    { "time": 1000, "slots_used": 5, "gpu_used": 0 }
  ]
}
```

---

## 11. API Specification

All endpoints prefixed `/api`. FastAPI generates OpenAPI docs at `/api/docs`.

### 11.1 Auth Endpoints

#### POST /api/auth/signup
**Request:**
```json
{
  "username": "priya_sharma",
  "email": "priya@example.com",
  "password": "securepassword123"
}
```
**Response 200:**
```json
{
  "access_token": "eyJ...",
  "user": { "id": "uuid", "username": "priya_sharma", "email": "priya@example.com" }
}
```
**Errors:** 400 username taken | 400 email registered | 422 validation error

---

#### POST /api/auth/login
**Request:** `{ "email": "...", "password": "..." }`  
**Response 200:** Same as signup.  
**Errors:** 401 invalid credentials (same message for wrong email OR wrong password)

---

#### GET /api/auth/me
**Headers:** `Authorization: Bearer <token>`  
**Response 200:** `{ "id", "username", "email", "created_at" }`

---

### 11.2 Simulation Endpoints

#### POST /api/simulations/run
**Auth:** Required  
**Description:** Validate the request and return a `run_token`. Client uses token to open SSE stream.

**Request:**
```json
{
  "workload": {
    "source": "form",
    "preset": "web_api_server",
    "total_jobs": 200,
    "arrival_pattern": "poisson",
    "arrival_rate": 20,
    "simulation_window": 120,
    "duration_min": 10,
    "duration_max": 2000,
    "duration_variance": 7,
    "pct_with_deadlines": 0,
    "deadline_tightness": 2.0,
    "pct_gpu_jobs": 0,
    "priority_spread": 2,
    "cluster_slots": 8,
    "cluster_gpu_slots": 0,
    "custom_jobs": null
  },
  "algorithms": [
    { "id": "srpt", "params": { "starvation_guard": 0 } },
    { "id": "fcfs", "params": {} }
  ],
  "global_params": {
    "starvation_threshold": 30,
    "preemption_cost": 0
  }
}
```
**Response 200:** `{ "run_token": "tmp_abc123" }`  
The run_token is short-lived (TTL: 5 minutes) and single-use.

---

#### GET /api/simulations/stream/{run_token}
**Auth:** Not required (token is the auth)  
**Description:** SSE stream for simulation progress. Connect immediately after POST /run.

**SSE events:**
```
event: progress
data: {"percent": 10, "message": "Generating workload..."}

event: progress
data: {"percent": 40, "message": "Running SRPT (156 events processed)..."}

event: progress
data: {"percent": 70, "message": "Running FCFS (156 events processed)..."}

event: progress
data: {"percent": 90, "message": "Computing metrics and building Gantt..."}

event: complete
data: { <full results array -- same structure as simulation_runs.results JSONB> }

event: error
data: {"message": "Custom scheduler error: Unbounded loop detected on line 4"}
```

---

#### POST /api/simulations/save
**Auth:** Required  
**Request:** `{ "name": "My Run", "run_token": "tmp_abc123" }`  
**Response 200:** `{ "id": "uuid", "share_token": "abc123..." }`

---

#### GET /api/simulations
**Auth:** Required  
**Query params:** `page` (default 1), `limit` (default 20)  
**Response 200:**
```json
{
  "runs": [
    {
      "id": "uuid",
      "name": "SRPT vs FCFS",
      "algorithms": ["SRPT", "FCFS"],
      "preset": "web_api_server",
      "primary_p95": 142.7,
      "primary_throughput": 14.7,
      "created_at": "2025-07-15T14:32:00Z",
      "share_token": "abc123..."
    }
  ],
  "total": 12,
  "page": 1,
  "pages": 1
}
```

---

#### GET /api/simulations/{run_id}
**Auth:** Required (must be owner)  
**Response 200:** Full simulation_runs record including all JSONB fields.

---

#### DELETE /api/simulations/{run_id}
**Auth:** Required (must be owner)  
**Response 204:** No content.

---

#### GET /api/simulations/shared/{share_token}
**Auth:** Not required  
**Response 200:** Full simulation record (same as GET /{run_id}).  
**Response 404:** Not found.

---

### 11.3 Custom Scheduler Endpoints

#### GET /api/schedulers
**Auth:** Required  
**Response 200:** `{ "schedulers": [{ "id", "name", "is_preemptive", "created_at", "updated_at" }] }`

---

#### POST /api/schedulers
**Auth:** Required  
**Request:** `{ "name": "My Hybrid", "code": "function schedule(...) {...}", "is_preemptive": true }`  
**Response 201:** `{ "id": "uuid", "name": "My Hybrid" }`  
**Errors:** 400 code fails security validation (includes `{ "error": "...", "line": 4 }`)

---

#### PUT /api/schedulers/{scheduler_id}
**Auth:** Required (must be owner). Same request body as POST. **Response 200.**

---

#### DELETE /api/schedulers/{scheduler_id}
**Auth:** Required (must be owner). **Response 204.**

---

#### POST /api/schedulers/validate
**Auth:** Not required  
**Request:** `{ "code": "function schedule(...) {...}" }`  
**Response 200:**
```json
{ "valid": true, "errors": [] }
```
or
```json
{ "valid": false, "errors": [{ "message": "Unbounded loop detected", "line": 4 }] }
```

---

## 12. Frontend Component Architecture

### 12.1 Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| / | LandingPage | Hero, features, CTA buttons |
| /signup | SignupPage | Registration form |
| /login | LoginPage | Login form |
| /dashboard | DashboardPage | Past runs table + new simulation button |
| /workbench | WorkbenchPage | Main 3-panel workbench |
| /workbench/:runId | WorkbenchPage | Load a past run (pre-fills config + shows results) |
| /share/:shareToken | SharedRunPage | Read-only shared result view |

### 12.2 WorkbenchPage Layout

```
+--------------------------------------------------------------+
|  [Logo]   [Dashboard]   [username v]   [Log Out]            |
+----------------+------------------+-------------------------+
|                |                  |                         |
|  LEFT PANEL   |  CENTER PANEL    |   RIGHT PANEL           |
|  (360px wide) |  (400px wide)    |   (flex: 1)             |
|               |                  |                         |
|  Load Builder |  Algorithm       |   Output Panel          |
|               |  Selector        |                         |
|  Preset cards |                  |   [Empty state          |
|  Sliders      |  Play Area       |    until run]           |
|  Workload     |  (param sliders) |                         |
|  Preview      |                  |   OR after run:         |
|               |  [+ Custom]      |                         |
|  [v Advanced] |  Editor panel    |   [Metric Cards]        |
|  JSON editor  |  (when toggled)  |   [Gantt Chart]         |
|               |                  |   [Supporting Charts]   |
|               |  [Run Sim >]     |   [Save/Share]          |
|               |                  |                         |
+----------------+------------------+-------------------------+
```

CSS Grid: `grid-template-columns: 360px 400px 1fr`. Panels stack vertically on screens < 1200px. Each panel scrolls independently.

### 12.3 Zustand Stores

**`useWorkloadStore`**
```typescript
interface WorkloadStore {
  preset: string;
  totalJobs: number;
  arrivalPattern: 'poisson' | 'bursty' | 'periodic' | 'uniform';
  arrivalRate: number;
  simulationWindow: number;
  durationMin: number;
  durationMax: number;
  durationVariance: number;
  pctWithDeadlines: number;
  deadlineTightness: number;
  pctGpuJobs: number;
  prioritySpread: number;
  clusterSlots: number;
  clusterGpuSlots: number;
  useCustomJson: boolean;
  customJsonText: string;
  customJsonError: string | null;
  setPreset: (preset: string) => void;
  setField: (field: string, value: number | string) => void;
  setCustomJson: (json: string) => void;
  toggleCustomJson: () => void;
  buildWorkloadConfig: () => WorkloadConfig;
}
```

**`useAlgorithmStore`**
```typescript
interface AlgorithmStore {
  selected: AlgorithmSelection[];  // max 3, AlgorithmSelection = { id, params }
  customScheduler: {
    code: string;
    name: string;
    isPreemptive: boolean;
    savedId: string | null;
    validationErrors: ValidationError[];
  };
  selectAlgorithm: (id: string) => void;
  deselectAlgorithm: (id: string) => void;
  setParam: (algoId: string, param: string, value: number) => void;
  resetParams: (algoId: string) => void;
  setCustomCode: (code: string) => void;
  setCustomName: (name: string) => void;
}
```

**`useSimulationStore`**
```typescript
interface SimulationStore {
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number;
  progressMessage: string;
  results: SimulationResult[] | null;
  error: string | null;
  currentRunToken: string | null;
  startSimulation: (workload: WorkloadConfig, algorithms: AlgorithmSelection[]) => Promise<void>;
  saveRun: (name: string) => Promise<string>;
  loadRun: (runId: string) => Promise<void>;
  resetSimulation: () => void;
}
```

**`useAuthStore`**
```typescript
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromToken: () => void;  // Called on app init; reads localStorage
}
```

### 12.4 SSE Client Implementation

```typescript
// src/api/simulations.ts
export function streamSimulation(runToken: string, handlers: {
  onProgress: (pct: number, msg: string) => void;
  onComplete: (results: SimulationResult[]) => void;
  onError: (msg: string) => void;
}) {
  const source = new EventSource(`${import.meta.env.VITE_API_URL}/api/simulations/stream/${runToken}`);
  
  source.addEventListener('progress', (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    handlers.onProgress(data.percent, data.message);
  });
  
  source.addEventListener('complete', (e: MessageEvent) => {
    handlers.onComplete(JSON.parse(e.data));
    source.close();
  });
  
  source.addEventListener('error', (e: MessageEvent) => {
    const data = (e as MessageEvent).data;
    handlers.onError(data ? JSON.parse(data)?.message : 'Connection lost');
    source.close();
  });
  
  return () => source.close();  // cleanup function — call on component unmount
}
```

### 12.5 Axios Client Setup

```typescript
// src/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api'
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

---

## 13. Simulation Engine

### 13.1 Location

All simulation code in `backend/app/simulation/`. Pure Python, no I/O. Receives config dict, returns results dict. No knowledge of FastAPI or databases.

### 13.2 Entry Point

```python
# backend/app/simulation/runner.py

def run_simulation(
    workload_config: dict,
    algorithm_configs: list[dict],
    global_params: dict,
    progress_callback: Callable[[int, str], None]
) -> list[dict]:
    """
    Run a simulation for each algorithm in algorithm_configs against the same workload.
    progress_callback(percent, message) is called at key milestones.
    Returns list of result dicts (one per algorithm).
    """
    progress_callback(10, "Generating workload...")
    jobs = generate_workload(workload_config)
    
    results = []
    for i, algo_config in enumerate(algorithm_configs):
        pct_start = 20 + (i * 60 // len(algorithm_configs))
        pct_end = 20 + ((i + 1) * 60 // len(algorithm_configs))
        
        progress_callback(pct_start, f"Running {algo_config['id'].upper()}...")
        
        # Get scheduler function
        scheduler_fn = get_scheduler(algo_config, global_params)
        
        # Run simulation (fresh copy of jobs for each algorithm)
        import copy
        jobs_copy = copy.deepcopy(jobs)
        sim = Simulator(jobs_copy, scheduler_fn, global_params)
        sim_result = sim.run(on_event=lambda n: progress_callback(
            pct_start + int((n / (len(jobs) * 3)) * (pct_end - pct_start)),
            f"Running {algo_config['id'].upper()} ({n} events)..."
        ))
        
        results.append(sim_result)
    
    progress_callback(90, "Computing metrics and building Gantt...")
    return results
```

### 13.3 Job Dataclass

```python
# backend/app/simulation/job.py
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Job:
    id: str
    arrival_time: float       # ms
    duration: float           # ms total
    remaining_time: float     # ms remaining (decreases as job runs)
    priority: float           # 0.0-1.0
    requires_gpu: bool
    deadline: Optional[float] # ms absolute, None if no deadline
    owner: str

    # Set by simulator at runtime
    start_time: Optional[float] = None
    completion_time: Optional[float] = None
    preempt_count: int = 0
    wait_time: float = 0.0
    last_wait_update: Optional[float] = None

    @property
    def latency(self) -> Optional[float]:
        if self.completion_time is None:
            return None
        return self.completion_time - self.arrival_time

    @property
    def missed_deadline(self) -> bool:
        if self.deadline is None or self.completion_time is None:
            return False
        return self.completion_time > self.deadline
```

### 13.4 Workload Generator

```python
# backend/app/simulation/workload.py
import numpy as np
from .job import Job

def generate_workload(config: dict) -> list[Job]:
    if config['source'] == 'json':
        return _parse_custom_jobs(config['custom_jobs'])
    return _generate_from_form(config)

def _generate_from_form(config: dict) -> list[Job]:
    n = config['total_jobs']
    window = config['simulation_window'] * 1000  # convert to ms
    
    # 1. Generate arrival times
    arrival_times = _generate_arrivals(
        pattern=config['arrival_pattern'],
        n=n,
        rate=config['arrival_rate'],
        window=window
    )
    
    # 2. Generate durations
    durations = _generate_durations(
        n=n,
        min_ms=config['duration_min'],
        max_ms=config['duration_max'],
        variance=config['duration_variance']
    )
    
    # 3. Assign priorities
    priorities = _generate_priorities(n, config['priority_spread'])
    
    # 4. Assign GPU requirements
    gpu_mask = np.random.rand(n) < (config['pct_gpu_jobs'] / 100)
    
    # 5. Assign deadlines
    deadline_mask = np.random.rand(n) < (config['pct_with_deadlines'] / 100)
    tightness = config['deadline_tightness']
    
    jobs = []
    for i in range(n):
        deadline = None
        if deadline_mask[i]:
            deadline = arrival_times[i] + durations[i] * tightness
        
        jobs.append(Job(
            id=f"job-{i+1}",
            arrival_time=float(arrival_times[i]),
            duration=float(durations[i]),
            remaining_time=float(durations[i]),
            priority=float(priorities[i]),
            requires_gpu=bool(gpu_mask[i]),
            deadline=float(deadline) if deadline is not None else None,
            owner="default"
        ))
    
    return jobs

def _generate_arrivals(pattern, n, rate, window):
    if pattern == 'poisson':
        inter_arrivals = np.random.exponential(1000 / rate, n)
        return np.cumsum(inter_arrivals)
    elif pattern == 'periodic':
        interval = 1000 / rate
        return np.arange(n) * interval
    elif pattern == 'uniform':
        return np.linspace(0, window, n)
    elif pattern == 'bursty':
        times = []
        t = 0
        burst_duration = 10000  # 10s burst
        quiet_duration = 30000  # 30s quiet
        while len(times) < n:
            # Burst phase
            burst_end = t + burst_duration
            while t < burst_end and len(times) < n:
                t += np.random.exponential(1000 / (rate * 5))
                times.append(t)
            # Quiet phase
            quiet_end = t + quiet_duration
            while t < quiet_end and len(times) < n:
                t += np.random.exponential(1000 / max(rate * 0.2, 0.1))
                times.append(t)
        return np.array(times[:n])

def _generate_durations(n, min_ms, max_ms, variance):
    if variance > 5:
        # Pareto heavy tail
        alpha = 1.0 + (10 - variance) * 0.3  # lower variance = higher alpha = lighter tail
        samples = (np.random.pareto(alpha, n) + 1) * min_ms
    else:
        # Log-Normal
        mean = (min_ms + max_ms) / 2
        sigma = variance * 0.3
        samples = np.random.lognormal(np.log(mean), sigma, n)
    
    return np.clip(samples, min_ms, max_ms)

def _generate_priorities(n, spread):
    if spread == 1:
        return np.full(n, 0.5)
    a = 5.0 / spread  # Beta distribution shape narrows toward 0.5 as spread decreases
    return np.random.beta(a, a, n)
```

### 13.5 Discrete Event Simulator

```python
# backend/app/simulation/simulator.py
import heapq
from dataclasses import dataclass, field
from typing import Callable, Optional
from .job import Job
from .cluster import Cluster, RunningJob

@dataclass(order=True)
class Event:
    time: float
    type: str = field(compare=False)   # 'arrival' | 'complete'
    job: Optional[Job] = field(default=None, compare=False)

class Simulator:
    def __init__(self, jobs: list[Job], scheduler_fn, global_params: dict):
        self.jobs = sorted(jobs, key=lambda j: j.arrival_time)
        self.scheduler_fn = scheduler_fn
        self.global_params = global_params
        self.starvation_threshold = global_params.get('starvation_threshold', 30) * 1000
        self.preemption_cost = global_params.get('preemption_cost', 0)
        
        cluster_slots = global_params.get('cluster_slots', 8)
        cluster_gpu_slots = global_params.get('cluster_gpu_slots', 0)
        self.cluster = Cluster(total_slots=cluster_slots, total_gpu_slots=cluster_gpu_slots)
        
        self.ready_queue: list[Job] = []
        self.running: list[RunningJob] = []  # RunningJob = { job, slot, gpu_slot, started_at }
        self.completed: list[Job] = []
        self.event_queue: list[Event] = []
        self.time: float = 0.0
        
        # For chart data
        self.queue_depth_series = []
        self.utilization_series = []
        self.snapshot_interval = 1000  # ms
        self.last_snapshot = 0.0
        self.event_count = 0
    
    def run(self, on_event: Callable = None) -> dict:
        # Seed arrival events
        for job in self.jobs:
            heapq.heappush(self.event_queue, Event(job.arrival_time, 'arrival', job))
        
        while self.event_queue:
            event = heapq.heappop(self.event_queue)
            self.time = event.time
            self.event_count += 1
            
            if on_event and self.event_count % 50 == 0:
                on_event(self.event_count)
            
            # Update wait times for queued jobs
            for q_job in self.ready_queue:
                elapsed = self.time - (q_job.last_wait_update or q_job.arrival_time)
                q_job.wait_time += elapsed
                q_job.last_wait_update = self.time
            
            if event.type == 'arrival':
                self.ready_queue.append(event.job)
                self._try_schedule()
                if getattr(self.scheduler_fn, 'preemptive', False):
                    self._try_preempt()
            
            elif event.type == 'complete':
                self._handle_completion(event.job)
            
            self._maybe_snapshot()
        
        return self._build_result()
    
    def _handle_completion(self, job: Job):
        entry = next((r for r in self.running if r.job.id == job.id), None)
        if entry is None:
            return
        self.running.remove(entry)
        self.cluster.release(entry)
        job.completion_time = self.time
        self.completed.append(job)
        self._try_schedule()
    
    def _try_schedule(self):
        while self.cluster.has_free_slot():
            eligible = [j for j in self.ready_queue
                       if not (j.requires_gpu and self.cluster.free_gpu_slots == 0)]
            if not eligible:
                break
            
            cluster_snap = self.cluster.snapshot()
            chosen = self.scheduler_fn(
                eligible,
                [r.job for r in self.running],
                cluster_snap,
                self.time
            )
            if chosen is None or chosen not in self.ready_queue:
                break
            
            self.ready_queue.remove(chosen)
            if chosen.start_time is None:
                chosen.start_time = self.time
            
            entry = self.cluster.allocate(chosen)
            self.running.append(entry)
            
            completion_time = self.time + chosen.remaining_time
            heapq.heappush(self.event_queue, Event(completion_time, 'complete', chosen))
    
    def _try_preempt(self):
        if not self.ready_queue or not self.running:
            return
        
        cluster_snap = self.cluster.snapshot()
        all_ready = [j for j in self.ready_queue
                    if not (j.requires_gpu and self.cluster.free_gpu_slots == 0)]
        if not all_ready:
            return
        
        chosen = self.scheduler_fn(
            all_ready,
            [r.job for r in self.running],
            cluster_snap,
            self.time
        )
        
        if chosen is None or chosen not in self.ready_queue:
            return
        
        # Find worst running job to preempt (most remaining time)
        preempt_entry = max(self.running, key=lambda r: r.job.remaining_time - (self.time - r.started_at))
        current_remaining = preempt_entry.job.remaining_time - (self.time - preempt_entry.started_at)
        
        # 5% threshold to avoid thrashing
        if current_remaining <= chosen.remaining_time * 1.05:
            return
        
        # Preempt
        preempt_entry.job.remaining_time = current_remaining
        preempt_entry.job.preempt_count += 1
        
        # Apply preemption cost
        if self.preemption_cost > 0:
            preempt_entry.job.remaining_time += self.preemption_cost
        
        # Remove the old completion event
        self.event_queue = [e for e in self.event_queue
                           if not (e.type == 'complete' and e.job.id == preempt_entry.job.id)]
        heapq.heapify(self.event_queue)
        
        self.cluster.release(preempt_entry)
        self.running.remove(preempt_entry)
        self.ready_queue.append(preempt_entry.job)
        
        self._try_schedule()
    
    def _maybe_snapshot(self):
        if self.time - self.last_snapshot >= self.snapshot_interval:
            self.queue_depth_series.append({
                "time": int(self.time),
                "depth": len(self.ready_queue)
            })
            self.utilization_series.append({
                "time": int(self.time),
                "slots_used": len(self.running),
                "gpu_used": sum(1 for r in self.running if r.job.requires_gpu)
            })
            self.last_snapshot = self.time
    
    def _build_result(self) -> dict:
        from .metrics import compute_metrics
        from .gantt import build_gantt_data
        
        metrics = compute_metrics(self.completed, self.jobs, self.time)
        metrics['avg_queue_depth'] = (
            sum(s['depth'] for s in self.queue_depth_series) / len(self.queue_depth_series)
            if self.queue_depth_series else 0
        )
        
        return {
            "metrics": metrics,
            "gantt_data": build_gantt_data(self.completed, self.cluster.total_slots, self.time,
                                           self.starvation_threshold),
            "queue_depth_series": self.queue_depth_series,
            "utilization_series": self.utilization_series,
        }
```

### 13.6 Built-in Scheduler Implementations

```python
# backend/app/simulation/schedulers/fcfs.py
def schedule(ready_jobs, running_jobs, cluster, now):
    if not ready_jobs: return None
    return min(ready_jobs, key=lambda j: j.arrival_time)
schedule.preemptive = False

# backend/app/simulation/schedulers/sjf.py
def schedule(ready_jobs, running_jobs, cluster, now):
    if not ready_jobs: return None
    return min(ready_jobs, key=lambda j: j.duration)
schedule.preemptive = False

# backend/app/simulation/schedulers/srpt.py
def make_srpt(params):
    starvation_guard_ms = params.get('starvation_guard', 0) * 1000
    def schedule(ready_jobs, running_jobs, cluster, now):
        if not ready_jobs: return None
        def eff(job):
            if starvation_guard_ms > 0 and job.wait_time > starvation_guard_ms:
                return job.remaining_time * 0.5
            return job.remaining_time
        return min(ready_jobs, key=eff)
    schedule.preemptive = True
    return schedule

# backend/app/simulation/schedulers/edf.py
def make_edf(params):
    slack_threshold = params.get('slack_threshold', 0) / 100
    no_dl_weight = params.get('non_deadline_weight', 0.5)
    def schedule(ready_jobs, running_jobs, cluster, now):
        if not ready_jobs: return None
        def urgency(job):
            if job.deadline is None:
                return float('inf') * (2 - no_dl_weight)
            ttd = job.deadline - now
            if slack_threshold > 0:
                slack_ratio = (ttd - job.remaining_time) / max(ttd, 1)
                if slack_ratio < slack_threshold:
                    return float('inf')
            return ttd
        return min(ready_jobs, key=urgency)
    schedule.preemptive = True
    return schedule

# backend/app/simulation/schedulers/rr.py
def make_rr(params):
    quantum = params.get('time_quantum', 50)
    priority_boost = params.get('priority_boost', 1)
    rr_order = []  # Maintains circular order
    def schedule(ready_jobs, running_jobs, cluster, now):
        nonlocal rr_order
        current_ids = {j.id for j in ready_jobs}
        rr_order = [j for j in rr_order if j.id in current_ids]
        for job in ready_jobs:
            if not any(j.id == job.id for j in rr_order):
                rr_order.append(job)
        if not rr_order: return None
        return rr_order[0]
    schedule.preemptive = False
    schedule.time_quantum = quantum
    return schedule

# backend/app/simulation/schedulers/cfs.py
def make_cfs(params):
    min_gran = params.get('min_granularity', 4)
    vruntime = {}  # owner -> accumulated virtual runtime
    def schedule(ready_jobs, running_jobs, cluster, now):
        for rj in running_jobs:
            elapsed = now - (getattr(rj, 'last_cfs_update', now))
            w = max(rj.priority, 0.01)
            vruntime[rj.owner] = vruntime.get(rj.owner, 0) + elapsed / w
            rj.last_cfs_update = now
        min_vt = min(vruntime.values()) if vruntime else 0
        for job in ready_jobs:
            if job.owner not in vruntime:
                vruntime[job.owner] = min_vt
        if not ready_jobs: return None
        return min(ready_jobs, key=lambda j: vruntime[j.owner])
    schedule.preemptive = True
    return schedule
```

### 13.7 Scheduler Factory

```python
# backend/app/simulation/schedulers/__init__.py
from .fcfs import schedule as fcfs_schedule
from .sjf import schedule as sjf_schedule
from .srpt import make_srpt
from .edf import make_edf
from .rr import make_rr
from .cfs import make_cfs
from ..js_sandbox import make_js_scheduler

def get_scheduler(algo_config: dict, global_params: dict):
    algo_id = algo_config['id']
    params = algo_config.get('params', {})
    
    dispatch = {
        'fcfs': lambda: fcfs_schedule,
        'sjf':  lambda: sjf_schedule,
        'srpt': lambda: make_srpt(params),
        'edf':  lambda: make_edf(params),
        'rr':   lambda: make_rr(params),
        'cfs':  lambda: make_cfs(params),
    }
    
    if algo_id in dispatch:
        return dispatch[algo_id]()
    
    if algo_id == 'custom':
        code = algo_config.get('code', '')
        return make_js_scheduler(code, params)
    
    raise ValueError(f"Unknown algorithm: {algo_id}")
```

### 13.8 Metrics Computation

```python
# backend/app/simulation/metrics.py

def compute_metrics(completed: list, all_jobs: list, sim_duration: float) -> dict:
    latencies = sorted([j.latency for j in completed if j.latency is not None])
    jobs_with_deadlines = [j for j in completed if j.deadline is not None]
    missed = [j for j in jobs_with_deadlines if j.missed_deadline]
    
    # Jain's Fairness Index by owner
    owner_cpu = {}
    for job in completed:
        run_time = job.duration - job.remaining_time
        owner_cpu[job.owner] = owner_cpu.get(job.owner, 0) + run_time
    
    if len(owner_cpu) > 1:
        vals = list(owner_cpu.values())
        n = len(vals)
        fairness = (sum(vals) ** 2) / (n * sum(v**2 for v in vals))
    else:
        fairness = 1.0
    
    def pct(data, p):
        if not data: return 0
        idx = max(0, min(int(len(data) * p / 100), len(data) - 1))
        return round(data[idx], 2)
    
    return {
        "p50_latency": pct(latencies, 50),
        "p95_latency": pct(latencies, 95),
        "p99_latency": pct(latencies, 99),
        "throughput": round(len(completed) / max(sim_duration / 1000, 0.001), 2),
        "fairness_index": round(fairness, 4),
        "deadline_miss_rate": round(len(missed) / len(jobs_with_deadlines), 4) if jobs_with_deadlines else None,
        "total_jobs": len(all_jobs),
        "completed_jobs": len(completed),
        "starved_jobs": sum(1 for j in completed if j.wait_time > 30000),
        "total_preemptions": sum(j.preempt_count for j in completed),
    }
```

### 13.9 Gantt Data Builder

```python
# backend/app/simulation/gantt.py

def build_gantt_data(completed: list, total_slots: int, sim_duration: float,
                     starvation_threshold: float) -> dict:
    """
    Build the gantt_data structure from completed jobs.
    Each job's execution is represented as a list of segments
    (start, end, slot) — gaps between segments are preemption periods.
    """
    # Reconstruct segments from job history
    # NOTE: The simulator needs to record segments during execution.
    # This function expects jobs to have a .segments list attached.
    
    jobs_data = []
    for job in completed:
        jobs_data.append({
            "id": job.id,
            "owner": job.owner,
            "priority": round(job.priority, 2),
            "arrival_time": int(job.arrival_time),
            "deadline": int(job.deadline) if job.deadline else None,
            "segments": getattr(job, 'segments', []),
            "completed_at": int(job.completion_time),
            "missed_deadline": job.missed_deadline,
            "was_starving": job.wait_time > starvation_threshold
        })
    
    return {
        "slots": total_slots,
        "simulation_duration": int(sim_duration),
        "jobs": jobs_data
    }
```

> **Implementation note for segments:** The Simulator needs to track job segments. Add a `segments: list` field to Job (default empty list). In `_try_schedule`, when a job starts or resumes, append `{"start": self.time, "end": None, "slot": slot_index}`. In `_handle_completion`, set the last segment's `"end"` to `self.time`. In `_try_preempt`, set the last segment's `"end"` to `self.time` when preempting.

---

## 14. Repository Structure

```
scheduling-workbench/
|-- README.md
|-- docker-compose.yml
|
|-- backend/
|   |-- Dockerfile
|   |-- requirements.txt
|   |-- alembic.ini
|   |-- alembic/
|   |   |-- env.py
|   |   +-- versions/
|   |       +-- 001_initial_schema.py
|   +-- app/
|       |-- main.py              # FastAPI app, CORS, router registration
|       |-- config.py            # Settings (pydantic-settings)
|       |-- database.py          # SQLAlchemy async engine + session dependency
|       |-- auth.py              # JWT creation + verification utilities
|       |-- models/
|       |   |-- user.py
|       |   |-- custom_scheduler.py
|       |   +-- simulation_run.py
|       |-- schemas/
|       |   |-- auth.py          # SignupRequest, LoginRequest, TokenResponse
|       |   |-- simulation.py    # RunRequest, RunResponse, SaveRunRequest
|       |   +-- scheduler.py     # SaveSchedulerRequest, ValidateRequest
|       |-- routers/
|       |   |-- auth.py          # /api/auth/* routes
|       |   |-- simulations.py   # /api/simulations/* routes + SSE handler
|       |   +-- schedulers.py    # /api/schedulers/* routes
|       +-- simulation/
|           |-- runner.py        # run_simulation() entry point
|           |-- workload.py      # generate_workload()
|           |-- simulator.py     # DiscreteEventSimulator
|           |-- job.py           # Job dataclass
|           |-- cluster.py       # Cluster + RunningJob dataclasses
|           |-- metrics.py       # compute_metrics()
|           |-- gantt.py         # build_gantt_data()
|           |-- js_sandbox.py    # PyMiniRacer wrapper + esprima AST check
|           +-- schedulers/
|               |-- __init__.py  # get_scheduler() factory
|               |-- fcfs.py
|               |-- sjf.py
|               |-- srpt.py
|               |-- edf.py
|               |-- rr.py
|               +-- cfs.py
|
+-- frontend/
    |-- Dockerfile
    |-- package.json
    |-- vite.config.ts
    |-- tsconfig.json
    |-- tailwind.config.ts
    |-- index.html
    +-- src/
        |-- main.tsx
        |-- App.tsx              # React Router setup + ProtectedRoute wrapper
        |-- pages/
        |   |-- LandingPage.tsx
        |   |-- SignupPage.tsx
        |   |-- LoginPage.tsx
        |   |-- DashboardPage.tsx
        |   |-- WorkbenchPage.tsx
        |   +-- SharedRunPage.tsx
        |-- components/
        |   |-- layout/
        |   |   |-- Navbar.tsx
        |   |   +-- WorkbenchLayout.tsx
        |   |-- load-builder/
        |   |   |-- LoadBuilderPanel.tsx
        |   |   |-- PresetSelector.tsx
        |   |   |-- ArrivalSliders.tsx
        |   |   |-- JobShapeSliders.tsx
        |   |   |-- ClusterConfig.tsx
        |   |   |-- WorkloadPreview.tsx
        |   |   +-- JsonOverrideEditor.tsx
        |   |-- algorithms/
        |   |   |-- AlgorithmPanel.tsx
        |   |   |-- AlgorithmCard.tsx
        |   |   |-- AlgorithmLearnMore.tsx
        |   |   |-- PlayArea.tsx
        |   |   |-- SrptSliders.tsx
        |   |   |-- EdfSliders.tsx
        |   |   |-- RoundRobinSliders.tsx
        |   |   |-- CfsSliders.tsx
        |   |   |-- GlobalSliders.tsx
        |   |   +-- RunButton.tsx
        |   |-- custom-scheduler/
        |   |   |-- CustomSchedulerToggle.tsx
        |   |   |-- CustomSchedulerEditor.tsx
        |   |   |-- MonacoEditorWrapper.tsx
        |   |   |-- SchedulerExamples.tsx
        |   |   +-- SavedSchedulerPicker.tsx
        |   |-- output/
        |   |   |-- OutputPanel.tsx
        |   |   |-- EmptyOutputState.tsx
        |   |   |-- RunProgress.tsx
        |   |   |-- MetricsCards.tsx
        |   |   |-- MetricCard.tsx
        |   |   |-- GanttChart.tsx
        |   |   |-- GanttJobBar.tsx
        |   |   |-- GanttTooltip.tsx
        |   |   |-- GanttAxis.tsx
        |   |   |-- SupportingCharts.tsx
        |   |   |-- QueueDepthChart.tsx
        |   |   |-- LatencyCdfChart.tsx
        |   |   |-- UtilizationChart.tsx
        |   |   |-- SaveRunForm.tsx
        |   |   +-- ShareButton.tsx
        |   +-- ui/
        |       |-- Slider.tsx
        |       |-- Toggle.tsx
        |       |-- Tooltip.tsx
        |       |-- Toast.tsx
        |       |-- Spinner.tsx
        |       +-- EmptyState.tsx
        |-- stores/
        |   |-- useWorkloadStore.ts
        |   |-- useAlgorithmStore.ts
        |   |-- useSimulationStore.ts
        |   +-- useAuthStore.ts
        |-- api/
        |   |-- client.ts        # Axios instance + interceptors
        |   |-- auth.ts
        |   |-- simulations.ts   # includes streamSimulation() with EventSource
        |   +-- schedulers.ts
        |-- types/
        |   |-- job.ts           # Job, Cluster TypeScript interfaces
        |   |-- simulation.ts    # SimulationResult, GanttData, MetricsData
        |   +-- workload.ts      # WorkloadConfig, AlgorithmSelection
        +-- lib/
            |-- workloadPreview.ts   # Client-side preview generator
            +-- ganttRenderer.ts     # Gantt SVG/Canvas rendering logic
```

---

## 15. Environment Variables

### Backend (`backend/.env`)

```bash
APP_ENV=development
SECRET_KEY=your-super-secret-key-minimum-32-characters

DATABASE_URL=postgresql+asyncpg://workbench:workbench@postgres:5432/workbench_db

JWT_SECRET_KEY=your-jwt-secret-key-minimum-32-characters
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=30

FRONTEND_URL=http://localhost:5173

MAX_CUSTOM_JOBS=500
JS_SANDBOX_TIMEOUT_MS=50
MAX_CONCURRENT_SIMULATIONS=5
```

### Frontend (`frontend/.env`)

```bash
VITE_API_URL=http://localhost:8000
```

### Docker Compose (`docker-compose.yml`)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: workbench
      POSTGRES_PASSWORD: workbench
      POSTGRES_DB: workbench_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
    env_file: ./backend/.env
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    command: npm run dev -- --host
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000

volumes:
  postgres_data:
```

### Quick Start

```bash
git clone https://github.com/your-username/scheduling-workbench
cd scheduling-workbench
cp backend/.env.example backend/.env   # defaults work for local dev

docker-compose up --build

# In a separate terminal:
docker-compose exec backend alembic upgrade head

# Frontend: http://localhost:5173
# API docs: http://localhost:8000/api/docs
```

---

## 16. Development Roadmap

### Week 1: Backend Foundation

Goals: complete backend is runnable and all core simulation functionality works.

- [ ] FastAPI project scaffold: config.py, database.py, main.py
- [ ] SQLAlchemy models: users, custom_schedulers, simulation_runs
- [ ] Alembic migration: 001_initial_schema.py
- [ ] Auth routes: /api/auth/signup, /login, /me with bcrypt + JWT
- [ ] Job dataclass + Cluster dataclass
- [ ] Workload generator: all 4 arrival patterns + duration distributions
- [ ] DiscreteEventSimulator (event loop, _try_schedule, _try_preempt)
- [ ] All 6 built-in scheduler implementations
- [ ] Gantt segment tracking (segments list on Job)
- [ ] compute_metrics() and build_gantt_data()
- [ ] run_simulation() runner
- [ ] POST /api/simulations/run (returns run_token) + GET /api/simulations/stream/{token} (SSE)
- [ ] Simulation save/list/get/delete/share endpoints
- [ ] Custom scheduler endpoints (CRUD + validate)

**Milestone:** POST to /api/simulations/run streams full results. Verifiable via curl.

---

### Week 2: JS Sandbox

- [ ] PyMiniRacer integration in js_sandbox.py
- [ ] Esprima AST security validation (all blocked patterns)
- [ ] make_js_scheduler() wraps custom code into callable Python function
- [ ] Custom workload JSON parsing and validation
- [ ] Unit tests: all 6 schedulers (ordering correctness)
- [ ] Unit tests: workload generator (distribution statistics)
- [ ] Integration test: full simulation round-trip via API for each built-in algorithm
- [ ] Security tests: all blocked JS patterns are rejected

**Milestone:** Full backend functionally complete and tested.

---

### Week 3: Frontend Shell + Auth

- [ ] Vite + React + TypeScript + Tailwind project setup
- [ ] React Router with all 6 routes + ProtectedRoute wrapper
- [ ] Axios client with JWT interceptor (auth.ts, client.ts)
- [ ] All 4 Zustand stores scaffolded (can be mostly empty stubs)
- [ ] LandingPage (static)
- [ ] SignupPage + LoginPage with inline validation
- [ ] DashboardPage (table, loads from /api/simulations)
- [ ] WorkbenchPage 3-panel CSS Grid shell (no functionality yet)
- [ ] Navbar with auth state
- [ ] Route protection + redirect logic

**Milestone:** Can sign up, log in, see dashboard, navigate to workbench layout.

---

### Week 4: Load Builder + Algorithm Selector + Play Area

- [ ] PresetSelector (6 preset cards, fills sliders on click)
- [ ] ArrivalSliders, JobShapeSliders, ClusterConfig components
- [ ] WorkloadPreview (reactive sparkline + warnings, no real simulation)
- [ ] JsonOverrideEditor (lazy Monaco, validation feedback)
- [ ] AlgorithmCard for each of 6 algorithms
- [ ] AlgorithmLearnMore (expandable descriptions)
- [ ] Algorithm selection state (max 3, min 1)
- [ ] PlayArea with all per-algorithm sliders (SRPT, EDF, RR, CFS)
- [ ] GlobalSliders (starvation threshold, preemption cost)
- [ ] RunButton connected to useSimulationStore.startSimulation()
- [ ] RunProgress (progress bar consuming SSE events)

**Milestone:** User can fully configure workload + algorithms. Clicking Run fires the API and shows progress.

---

### Week 5: Output Visualizations

- [ ] MetricsCards component (4 cards with color coding)
- [ ] GanttChart SVG renderer (<= 500 jobs)
  - Job bars with gap visualization for preemptions
  - Arrival triangles
  - Deadline dashed lines
  - Starvation outlines
  - Owner/quartile color coding
  - Hover tooltip
  - Click to pin tooltip
- [ ] GanttChart Canvas renderer (> 500 jobs) with hit-testing
- [ ] Zoom + pan on Gantt time axis
- [ ] Multi-algorithm stacked Gantt view
- [ ] QueueDepthChart (Recharts)
- [ ] LatencyCdfChart (Recharts, with p50/p95/p99 markers)
- [ ] UtilizationChart (Recharts stacked area)
- [ ] Supporting charts tabs
- [ ] SaveRunForm + ShareButton
- [ ] SharedRunPage (/share/:shareToken)
- [ ] Load past run at /workbench/:runId

**Milestone:** Complete end-to-end flow: configure -> run -> see Gantt + metrics -> save -> share.

---

### Week 6: Custom Scheduler Editor + Polish

- [ ] CustomSchedulerEditor with lazy-loaded Monaco
- [ ] TypeScript type definitions (Job, Cluster) injected into Monaco
- [ ] 3 starter examples in collapsible panel
- [ ] Validate button with inline error display
- [ ] Save/load saved schedulers (connected to API)
- [ ] SavedSchedulerPicker dropdown
- [ ] Custom scheduler as a selectable algorithm (treated as 7th option)
- [ ] Responsive layout (panels stack vertically at < 1200px)
- [ ] Loading states on all async operations
- [ ] Error handling: API errors show as toasts
- [ ] Empty states on dashboard and output panel
- [ ] README with setup instructions

**Milestone:** Fully functional application. Custom schedulers work. Everything is wired up.

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| FCFS | First-Come First-Served. Processes jobs in arrival order. Simplest algorithm, worst avg latency. |
| SJF | Shortest Job First. Picks the job with the smallest total duration. Minimizes avg wait time but can starve long jobs. |
| SRPT | Shortest Remaining Processing Time. Preemptive SJF. Always picks the job with the least remaining work. Optimal for avg flow time. |
| EDF | Earliest Deadline First. Always runs the job whose deadline is soonest. Optimal for meeting deadlines on non-overloaded systems. |
| Round Robin (RR) | Cycles through all jobs giving each a fixed time quantum. Ensures no starvation. |
| CFS | Completely Fair Scheduler (Linux default). Tracks virtual runtime per owner and always picks the one with the least accumulated CPU time. |
| Preemption | Interrupting a running job to start a more urgent one. The preempted job resumes later. |
| Time Quantum | The fixed time slice Round Robin gives each job before rotating to the next. |
| Jain's Fairness Index | J = (sum xi)^2 / (n * sum xi^2). 1.0 = perfect equality. Lower = some owners got disproportionately more. |
| p95 Latency | 95th percentile of (completion_time - arrival_time). 95% of jobs complete faster than this value. |
| Discrete Event Simulation | Simulation that jumps between significant events (arrivals, completions) rather than advancing in fixed time steps. Much faster for sparse workloads. |
| Pareto Distribution | Heavy-tailed distribution used to model web traffic: most requests fast, a few take very long. |
| Poisson Arrival Process | Random arrivals where inter-arrival times follow an exponential distribution. Standard model for web servers. |
| Starvation | A job waiting indefinitely because higher-priority jobs always arrive before it gets to run. |
| Virtual Runtime (vruntime) | CFS's counter per owner tracking accumulated CPU time adjusted by weight. CFS picks the owner with the smallest vruntime. |
| Convoy Effect | FCFS pathology: many short jobs stuck behind one long job, inflating everyone's wait time. |
| Slot | A unit of parallel execution capacity. If cluster has 8 slots, 8 jobs can run simultaneously. |
| Gantt Chart | Visual timeline showing when each job ran on which slot. Makes scheduling decisions visible. |
| SSE (Server-Sent Events) | Standard HTTP protocol for server-to-client streaming. Used here to push simulation progress updates. |
| AST (Abstract Syntax Tree) | Tree representation of source code structure. Used to analyze user JS for security violations before execution. |
| PyMiniRacer | Python library embedding the V8 JavaScript engine. Used to safely execute user-submitted scheduler code. |

---

*End of PRD -- Scheduling Theory Workbench MVP v2.0.0*  
*This document is self-contained. No external context is needed to build the project from this specification.*
