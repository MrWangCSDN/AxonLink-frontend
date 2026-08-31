# Replay Filter Mock Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic development-only replay issue Mock data and counted header-filter responses that visibly exercise repeated values, empty values, and 150–250 character text.

**Architecture:** Extend the existing Vite Mock middleware rather than adding page-only fixtures or database seed data. The Mock list endpoint, legacy candidate endpoint, and counted candidate endpoint will share the same in-memory rows and filtering function so their totals remain comparable.

**Tech Stack:** JavaScript ES modules, Vite middleware, Vitest, Vue 3 local development server

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md` section “开发 Mock 验证设计（2026-08-30）”

## Global Constraints

- Mock is active only when `VITE_USE_MOCK` is enabled and must never write the backend database or localStorage.
- Do not add a production UI test button or a production API branch.
- Preserve the legacy `/header-filter-options` `List<String>` response.
- Counted options normalize null/blank to `空`, count unique Mock issue IDs, apply other filters, and exclude the active field's own multi-select parameter.
- Keep complete long values; front-end single-line overflow, horizontal scrolling, sticky counts, and resize behavior remain the rendering mechanism.
- Do not commit or clean unrelated workspace changes unless the user explicitly requests it.

---

### Task 1: Lock Mock filtering and counting behavior with tests

**Files:**
- Create: `mock/daoIndexMockServer.spec.js`
- Modify: `mock/daoIndexMockServer.js`

**Interfaces:**
- Consumes: existing `REPLAY_ISSUES`, `replayFilterRows(q)`, `isEmptyFilterValue(value)`.
- Produces: exported test helper `replayHeaderFilterOptionCounts(q): { candidateCount: number, truncated: boolean, items: Array<{ value: string, count: number }> }`.

- [ ] **Step 1: Write failing tests for the four long-text fields**

```js
import { describe, expect, it } from 'vitest'
import { replayHeaderFilterOptionCounts } from './daoIndexMockServer.js'

describe('replay issue counted header filter mock', () => {
  it('returns repeated, empty, and long field-name candidates with counts', () => {
    const result = replayHeaderFilterOptionCounts({ field: 'fieldName' })
    expect(result.items.some(item => item.value === '空' && item.count > 0)).toBe(true)
    expect(result.items.some(item => item.count > 1)).toBe(true)
    expect(result.items.some(item => item.value.length >= 150)).toBe(true)
  })

  it('applies another long-text filter but excludes the active field filter', () => {
    const result = replayHeaderFilterOptionCounts({
      field: 'issueDescription',
      transactionNames: ['账户余额与可用余额组合查询'],
      issueDescriptions: ['该值必须被排除'],
    })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every(item => item.count > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- mock/daoIndexMockServer.spec.js`

Expected: FAIL because `replayHeaderFilterOptionCounts` is not exported and the four fields are not present in the Mock filter map.

- [ ] **Step 3: Add deterministic long-text variants to `REPLAY_ISSUES`**

Use stable modulo-based assignments for `transaction_name`, `field_name`, `issue_description`, and `issue_key`. Each dimension must include one blank variant, at least one repeated short value, and at least one 150–250 character value. Keep the existing 100-row collection so other Mock dashboards and pagination remain representative.

- [ ] **Step 4: Extend shared Mock query filters**

Add the following exact mappings to `replayFilterRows(q)`:

```js
inFilter('transactionNames', 'transaction_name')
inFilter('fieldNames', 'field_name')
inFilter('issueDescriptions', 'issue_description')
inFilter('issueKeys', 'issue_key')
```

Add the corresponding field mappings:

```js
transactionName: 'transaction_name',
fieldName: 'field_name',
issueDescription: 'issue_description',
issueKey: 'issue_key',
```

- [ ] **Step 5: Implement the counted candidate helper**

The helper must clone the query, remove only the active field's own multi-select key, call `replayFilterRows`, normalize blank values to `空`, apply `keyword`, group IDs in `Set`s, sort `空` first and all remaining values lexically, inspect up to 501 candidates, then return the first 500 with counts.

- [ ] **Step 6: Run the new tests and verify GREEN**

Run: `npm test -- mock/daoIndexMockServer.spec.js`

Expected: all new tests pass.

### Task 2: Serve the real counted Mock response and preserve compatibility

**Files:**
- Modify: `mock/daoIndexMockServer.js`
- Test: `mock/daoIndexMockServer.spec.js`

**Interfaces:**
- Consumes: `replayHeaderFilterOptionCounts(q)` from Task 1.
- Produces: Vite middleware response for `GET /api/ai/parallel-replay/issues/header-filter-option-counts`; preserves `GET /header-filter-options` as an array of strings.

- [ ] **Step 1: Add a failing endpoint-order regression test**

Export a small `replayHeaderFilterOptions(q)` helper and verify that counted responses are objects while legacy responses are arrays. This guards against the broad `/issues` handler treating the new path as a list query.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- mock/daoIndexMockServer.spec.js`

Expected: FAIL until the helper and counted route are implemented.

- [ ] **Step 3: Add the counted route before the legacy route**

```js
if (url.includes('/header-filter-option-counts')) {
  return ok(res, replayHeaderFilterOptionCounts(q))
}
if (url.includes('/header-filter-options')) {
  return ok(res, replayHeaderFilterOptions(q))
}
```

- [ ] **Step 4: Reuse the same field map and filtering logic for the legacy helper**

The legacy helper returns `replayHeaderFilterOptionCounts(q).items.map(item => item.value)` and therefore keeps the old response type while sharing candidate semantics.

- [ ] **Step 5: Run the focused test and full frontend suite**

Run: `npm test -- mock/daoIndexMockServer.spec.js`

Expected: focused tests pass.

Run: `npm test`

Expected: all frontend tests pass.

### Task 3: Build and visually verify the local Mock page

**Files:**
- Verify only: `src/components/replay/ReplayIssuePage.vue`
- Verify only: `src/main/resources/static` output in the backend repository

**Interfaces:**
- Consumes: Vite Mock endpoints and existing `ReplayIssuePage` filter overlay.
- Produces: local browser evidence for counted candidates and long-text interaction; production frontend build output.

- [ ] **Step 1: Start the development server in default Mock mode**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a reachable local URL and `VITE_USE_MOCK` defaults to enabled.

- [ ] **Step 2: Open `#replay-issues` and inspect all four filters**

Verify transaction name, field name, issue description, and Issue Key filters each show a candidate total and per-option counts. Verify at least one repeated candidate, one `空（n）`, and one 150+ character candidate.

- [ ] **Step 3: Verify long-text interaction**

Open the field-name filter, confirm the long candidate remains on one line, scroll horizontally to its end, enlarge the window from the lower-right handle, and confirm the count stays visible at the right edge.

- [ ] **Step 4: Verify search and composed filtering**

Search a long-value fragment and verify the candidate total changes. Apply one transaction-name candidate, open issue-description filtering, and verify counts reflect the transaction-name condition rather than the full dataset.

- [ ] **Step 5: Run production build and final diff checks**

Run: `npm run build`

Expected: Vite build succeeds and writes the frontend bundle to `/Users/java/axon-link-server/src/main/resources/static`.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended frontend source/test/plan changes plus pre-existing user changes are present.
