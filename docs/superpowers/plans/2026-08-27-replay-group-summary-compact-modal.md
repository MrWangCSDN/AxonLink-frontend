# Replay Group Summary Compact Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit the group-summary modal to the four supported groups and size it to its four-row content while preserving the developer-ranking modal's long-list scrolling.

**Architecture:** Keep the shared modal component but derive group rows through the existing `summaryGroups` whitelist and order. Split CSS height behavior by the existing `replay-summary-modal-group` and `replay-summary-modal-person` classes so only the group modal becomes content-sized.

**Tech Stack:** Vue 3, Vite 8, Vitest 4, Vue Test Utils.

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md`

## Global Constraints

- Supported group rows are exactly 公共组、存款组、贷款组、结算组 in that order.
- The group modal uses content height with a viewport max-height fallback.
- The person-ranking modal retains its current fixed 70vh/640px height and internal scrolling.
- Mask clicks continue to be ignored; only the explicit X closes either modal.
- Production frontend output is rebuilt directly into the backend `src/main/resources/static` directory.

---

### Task 1: Lock the four-group projection and modal variants

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.spec.js`
- Modify: `src/components/replay/ReplayIssuePage.vue`

**Interfaces:**
- Consumes: `getReplayIssueGroupSummaries(): Promise<ReplayIssueGroupSummary[]>`.
- Produces: `filteredGroupSummaryRows`, containing only the four supported groups in `summaryGroups` order.

- [x] **Step 1: Replace the 30-group regression fixture with four supported groups plus one unexpected row**

Assert that the rendered group table contains exactly four rows in the order 公共组、存款组、贷款组、结算组 and excludes the unexpected row. Keep the person-ranking fixture at 30 developers and assert the person modal still renders all 30 rows.

- [x] **Step 2: Run the focused test and verify RED**

Run `npm test -- src/components/replay/ReplayIssuePage.spec.js -t "renders the compact four-group summary"`.

Expected: FAIL because `filteredGroupSummaryRows` currently returns every API row.

- [x] **Step 3: Implement the ordered whitelist projection**

Build a `Map` from `groupSummaryRows` by `groupName`, then return `summaryGroups.map(...)` with missing groups omitted. Do not change person ranking filtering.

- [x] **Step 4: Split group and person modal height rules**

Remove fixed height from `.replay-summary-modal`; set `.replay-summary-modal-group` to content height and `.replay-summary-modal-person` to `height: min(70vh, 640px)`. Apply the same distinction inside the narrow-screen media rule while retaining max-height and overflow safeguards.

- [x] **Step 5: Run the focused test and verify GREEN**

Run the Step 2 command again and expect PASS.

### Task 2: Regression, production build, and backend source delivery

**Files:**
- Verify: `src/components/replay/ReplayIssuePage.vue`
- Verify: `src/components/replay/ReplayIssuePage.spec.js`
- Generate: `/Users/java/axon-link-server/src/main/resources/static/**`
- Generate: `/Users/java/axon-link-server/axon-link-server-source-20260827-batch-date-static-final.zip`

**Interfaces:**
- Consumes: frontend Vite build output configuration.
- Produces: backend static resources, Java 17 JAR, and backend source ZIP.

- [x] **Step 1: Run the ReplayIssuePage regression suite**

Run `npm test -- src/components/replay/ReplayIssuePage.spec.js` and expect zero failures.

- [x] **Step 2: Build frontend into backend static resources**

Run `npm run build` in `/Users/java/axon-link-frontend` and verify `src/main/resources/static/index.html` references assets that exist.

- [x] **Step 3: Package the backend with Java 17**

Run `mvn -q -DskipTests package` with the configured JDK 17 and verify `target/axon-link-server-1.0.0.jar` exists.

- [x] **Step 4: Create and inspect the backend source ZIP**

Archive `src`, `docs`, `specs`, `scripts`, `pom.xml`, and root build/start/stop scripts. Exclude `.git`, `target`, historical ZIP files, IDE state, virtual environments, output, and intranet test copies. Verify the archive contains the new `static/index.html`, its referenced JS/CSS assets, and the batch-date merge implementation.
