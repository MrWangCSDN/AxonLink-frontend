# Replay Summary Large Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore large, readable group summary and developer ranking overlays after the query-panel collapse feature, and verify both with 30 mock rows.

**Architecture:** Keep the existing lazy-loaded summary APIs and hover entry points. Change only the overlay presentation to viewport-fixed centered panels with independent scrolling, and expand development mock responses without affecting production data.

**Tech Stack:** Vue 3, Vitest, Vite mock middleware, CSS, Playwright/browser inspection.

## Global Constraints

- Preserve existing summary query semantics and copy behavior.
- The overlay must not be clipped by `.replay-query-panel` or affected by table horizontal scrolling.
- Desktop group summary uses up to 80vw; developer ranking uses up to 90vw; both use up to 70vh.
- Mock summary endpoints return 30 rows each for local visual verification only.

---

### Task 1: Add overlay regression coverage

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.spec.js`

**Interfaces:**
- Consumes: existing `ReplayIssuePage` hover summary entries.
- Produces: assertions for viewport-fixed overlay classes and 30-row rendering.

- [ ] **Step 1: Write a failing test**

Add a test that opens each summary and asserts the rendered panel carries the large fixed-overlay modifier and accepts 30 rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/replay/ReplayIssuePage.spec.js`

Expected: FAIL because the large fixed-overlay class is absent.

- [ ] **Step 3: Keep the test focused on observable DOM behavior**

Do not assert browser layout pixels in jsdom; reserve pixel and clipping checks for the browser verification task.

### Task 2: Implement fixed large overlays and mock data

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.vue`
- Modify: `mock/daoIndexMockServer.js`

**Interfaces:**
- Consumes: `activeHoverSummary`, existing summary row arrays, existing mock HTTP paths.
- Produces: centered fixed overlays and 30 rows from `/stats/groups` and `/stats/person-rankings` mock endpoints.

- [ ] **Step 1: Add the fixed-overlay modifier to both summary panels**

Use one shared class for fixed positioning, with separate group/person width modifiers.

- [ ] **Step 2: Implement viewport-safe sizing and scrolling**

Center with fixed inset/transform, set 80vw/90vw widths, 70vh maximum height, and retain independent table scrolling with sticky headers.

- [ ] **Step 3: Generate deterministic 30-row mock responses**

Return 30 group summary rows and 30 developer ranking rows through the existing endpoints. Keep production API code unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test -- --run src/components/replay/ReplayIssuePage.spec.js`

Expected: all ReplayIssuePage tests pass.

### Task 3: Build and browser verification

**Files:**
- Build output: `/Users/java/axon-link-server/src/main/resources/static`

**Interfaces:**
- Consumes: local Vite mock server.
- Produces: verified desktop UI at normal and reduced browser zoom/viewport conditions.

- [ ] **Step 1: Build the frontend**

Run: `npm run build`

Expected: Vite build exits successfully and writes assets to the backend static directory.

- [ ] **Step 2: Start the local mock application**

Run the existing Vite development command on an available port.

- [ ] **Step 3: Inspect both overlays in a real browser**

Verify each overlay displays 30 rows, remains centered above the table, keeps a sticky header, and scrolls internally at desktop and compact viewport sizes.

- [ ] **Step 4: Run final focused verification**

Run: `npm run test -- --run src/components/replay/ReplayIssuePage.spec.js && npm run build`

Expected: zero test failures and successful production build.
