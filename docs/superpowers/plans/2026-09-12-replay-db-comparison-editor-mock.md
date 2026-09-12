# Replay Database Comparison Editor Mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive large-modal Mock for adding and editing replay database comparison registrations, including table lookup, automatic edit switching, primary-key-aware field transfer, custom ordering, and delete-on-empty confirmation.

**Architecture:** Keep the existing list page responsible for rows, filters, paging, and opening the editor. Add a focused editor component for modal state and interactions, backed by a deterministic metadata catalog module that can later be replaced by real API calls without changing the component contract.

**Tech Stack:** Vue 3 Composition API, Vitest, Vue Test Utils, Lucide Vue icons, Vite.

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/回放数据库比对字段登记-系统设计.md`

## Global Constraints

- Work only in `/Users/java/axon-link-frontend/.worktrees/replay-db-comparison-fields` on branch `codex/replay-db-comparison-fields`.
- Follow TDD: add one failing behavior test, verify the expected failure, then add minimal implementation.
- Keep the page on the existing `replay-database-comparison-fields` route; editor opens as a 92vw × 88vh modal.
- Clicking the backdrop must not close the editor; only Cancel, Save/Delete, or the top-right Close button may close it.
- Preserve existing list filter and paging behavior.
- The editor exposes only `领域` and searchable `小组负责人`; it must not expose editable 登记人、登记日期或备注 controls.
- The list keeps `负责人` and `登记日期` as audit columns and renames `归属小组` to `小组负责人`.
- Mock interactions must use real component state; no static placeholder buttons.

---

### Task 1: Deterministic BASE Metadata Mock Catalog

**Files:**
- Create: `src/components/replay/replayDatabaseComparisonMock.js`
- Create: `src/components/replay/replayDatabaseComparisonMock.spec.js`

**Interfaces:**
- Produces: `searchMockTables(keyword, registrations)` returning table metadata with `registrationStatus`, `registrationId`, and `registrationVersion`.
- Produces: `getMockColumns(tableName)` returning ordered `{ columnName, columnComment, dataType, ordinalPosition, primaryKey }` items.

- [ ] **Step 1: Write the failing catalog tests**

```js
expect(searchMockTables('冻结', registrations)[0]).toMatchObject({
  tableName: 'kdpa_cb_acct_fzn_cntl_inf',
  registrationStatus: 'ACTIVE',
})
expect(getMockColumns('kdpa_cb_acct_fzn_cntl_inf')).toContainEqual(expect.objectContaining({
  columnName: 'fzn_cntl_id',
  primaryKey: true,
}))
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/components/replay/replayDatabaseComparisonMock.spec.js`

Expected: FAIL because `replayDatabaseComparisonMock.js` does not exist.

- [ ] **Step 3: Implement six searchable mock tables and 12–30 fields per table**

The catalog must include the existing `kdpa_cb_acct_fzn_cntl_inf` registration and at least one unregistered table. Search must match English table name or Chinese table comment and return an empty array for blank input.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- --run src/components/replay/replayDatabaseComparisonMock.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/replay/replayDatabaseComparisonMock.js src/components/replay/replayDatabaseComparisonMock.spec.js
git commit -m "test(replay): add comparison metadata mock catalog"
```

### Task 2: Editor Modal and Automatic Add/Edit Switching

**Files:**
- Create: `src/components/replay/ReplayDatabaseComparisonEditor.vue`
- Create: `src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

**Interfaces:**
- Props: `registrations: Array`, `initialRegistration: Object | null`.
- Emits: `close`, `save`, `delete`.
- Consumes: `searchMockTables()` and `getMockColumns()` from Task 1.

- [ ] **Step 1: Write failing modal and table-search tests**

```js
expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
await wrapper.get('[data-testid="table-search-input"]').setValue('冻结')
expect(wrapper.findAll('[data-testid="table-search-result"]')).toHaveLength(0)
await wrapper.get('[data-testid="table-search-button"]').trigger('click')
expect(wrapper.findAll('[data-testid="table-search-result"]').length).toBeGreaterThan(0)
```

Add a second test that selects an `ACTIVE` result and expects the title `编辑登记`, existing fields selected, and the table selector locked.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the modal shell and table lookup**

Use a fixed backdrop, 92vw × 88vh dialog, fixed header/footer, independently scrolling body, and no backdrop click handler. Search executes only from the search button. Selecting an unregistered result loads columns in add mode; selecting an active result clones its current fields and table-level data into edit mode.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js
git commit -m "feat(replay): add comparison registration editor shell"
```

### Task 3: Primary-Key-Aware Field Transfer and Ordering

**Files:**
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

**Interfaces:**
- Maintains: `availableColumns`, `selectedColumns`, `availableSelection`, `selectedSelection`.
- Produces ordered `fieldNames` from `selectedColumns.map(column => column.columnName)`.

- [ ] **Step 1: Write failing transfer and ordering tests**

```js
expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('主键')
await wrapper.get('[data-testid="available-field-customer_no"]').setValue(true)
await wrapper.get('[data-testid="move-fields-right"]').trigger('click')
expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('customer_no')
await wrapper.get('[data-testid="move-selected-up-customer_no"]').trigger('click')
expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].text()).toContain('customer_no')
```

Cover name/comment search and `ALL` / `PRIMARY_KEY` / `NON_PRIMARY_KEY` filtering in the same spec.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: FAIL because transfer controls and order actions are missing.

- [ ] **Step 3: Implement dual lists and ordering**

Left rows display English name, Chinese comment, data type, and a green `主键` tag. The center has right/left batch buttons. Right rows display 1-based order, a drag handle, and explicit up/down buttons. Implement drag reordering plus up/down actions; disable invalid first-up and last-down actions.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js
git commit -m "feat(replay): add ordered comparison field transfer"
```

### Task 4: Parent Integration, Save, and Delete-on-Empty Confirmation

**Files:**
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.spec.js`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

**Interfaces:**
- Parent opens editor from `新增登记` or a row `编辑` action.
- Editor emits `save` with `{ mode, id, tableName, fieldNames, domain, owner, group, date, remark, version }`.
- Editor emits `delete` with `{ id, version, deleteWhenNoFields: true, reason: '全部比对字段已移除' }`.

- [ ] **Step 1: Write failing parent integration tests**

```js
await wrapper.get('[data-testid="add-registration"]').trigger('click')
expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(true)
await wrapper.get('[data-testid="edit-registration-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
expect(wrapper.get('[role="dialog"]').text()).toContain('编辑登记')
```

Add editor tests asserting: add mode with no fields cannot save; edit mode with no fields changes the main action to `删除登记`; clicking it opens an internal confirmation dialog; only confirming emits `delete`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: FAIL because integration and delete confirmation are missing.

- [ ] **Step 3: Implement parent state and editor form actions**

Change `rows` from a constant array to `ref`. Mock saves update or insert the visible list row while preserving active filters and page. Mock deletes remove the active row only after the internal confirmation. Clicking the editor backdrop must leave the dialog open.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/replay/ReplayDatabaseComparisonPage.vue src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js
git commit -m "feat(replay): integrate comparison registration editor mock"
```

### Task 5: Full Regression and Browser Review

**Files:**
- Modify only files required by issues found during verification.

**Interfaces:**
- Verifies all interfaces from Tasks 1–4 without changing their contracts.

- [ ] **Step 1: Run full frontend tests**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run a production build outside the configured backend output directory**

Run: `BUILD_DIR=$(mktemp -d /tmp/axon-link-frontend-build-check.XXXXXX) && npx vite build --outDir "$BUILD_DIR" --emptyOutDir`

Expected: build exits 0.

- [ ] **Step 3: Verify the live page in a browser**

Open `http://127.0.0.1:5176/#replay-database-comparison-fields`, test add search, existing-table edit switch, field transfer, ordering, and delete confirmation at desktop width. Capture a screenshot for user review.

- [ ] **Step 4: Check the patch**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only planned files changed.

- [ ] **Step 5: Commit verification refinements**

```bash
git add src/components/replay/ReplayDatabaseComparisonPage.vue src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js src/components/replay/replayDatabaseComparisonMock.js src/components/replay/replayDatabaseComparisonMock.spec.js
git commit -m "fix(replay): refine comparison editor mock"
```

Skip this step when browser review requires no code changes.

### Task 6: Automatic Audit Fields and Searchable Group Owner

**Files:**
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.spec.js`
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.spec.js`

**Interfaces:**
- Editor prop: `searchUsers: Function`, defaulting to the existing `searchReplayIssueUsers` API function.
- Editor form state: `{ domain, groupOwnerUsername, groupOwnerDisplay }`.
- Editor emits `save` with `{ domain, groupOwnerUsername, groupOwnerName }`; it does not emit owner, date, or remark.
- Parent Mock adds `owner` from the current Mock login and `date` from the current system date when creating or updating a row.

- [x] **Step 1: Write failing editor and list tests**

```js
expect(wrapper.text()).not.toContain('登记日期 *')
expect(wrapper.text()).not.toContain('备注')
await wrapper.get('[data-testid="group-owner-search"]').setValue('孙')
expect(searchUsers).toHaveBeenCalledWith('孙')
await wrapper.get('[data-testid="group-owner-option-sunhy1"]').trigger('click')
expect(wrapper.get('[data-testid="group-owner-search"]').element.value).toContain('孙海英')
```

Also assert that the list header contains `小组负责人`, does not contain `归属小组`, and still contains `负责人` and `登记日期`.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/replay/ReplayDatabaseComparisonEditor.spec.js src/components/replay/ReplayDatabaseComparisonPage.spec.js`

Expected: FAIL because the old owner, group, date, and remark controls still render and no searchable group-owner picker exists.

- [x] **Step 3: Implement the minimal form and Mock audit behavior**

Replace the registration form with a two-column `领域` + `小组负责人` layout. Reuse the problem-list collaborator picker behavior: search on input, show matching display names, store the selected username separately, clear stale selections when text changes, and require a selected username before saving. Rename list row `group` data to `groupOwner`, preserve `owner` and `date` only in the parent Mock, and use the current Mock login name plus `new Date().toISOString().slice(0, 10)` for saved audit values.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/components/replay/ReplayDatabaseComparisonEditor.spec.js src/components/replay/ReplayDatabaseComparisonPage.spec.js`

Expected: PASS.

- [x] **Step 5: Run full regression and build**

Run: `npm test && npm run build -- --outDir /tmp/axon-link-replay-db-comparison-build && git diff --check`

Expected: all tests pass, production build exits 0, and the patch has no whitespace errors.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-09-12-replay-db-comparison-editor-mock.md src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js src/components/replay/ReplayDatabaseComparisonPage.vue src/components/replay/ReplayDatabaseComparisonPage.spec.js
git commit -m "feat(replay): add searchable comparison group owner"
```

### Task 7: Dense List Actions and High-Capacity Field Picker

**Files:**
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonPage.spec.js`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.vue`
- Modify: `src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

**Interfaces:**
- List actions: `openRegistrationDetail(row)`, `openEditEditor(row)`, `requestDeleteRegistration(row)`, `openRegistrationAudit(row)`.
- Compact-copy state: `copiedCellKey` and `copyCellValue(row, field, value)`.
- Editor computed collection: `filteredSelectedColumns` preserving each column's original index for ordering.
- Editor selection actions: `selectAllAvailable`, `invertAvailableSelection`, `selectAllSelected`, `invertSelectedSelection`.

- [x] **Step 1: Write failing list interaction tests**

Assert each row renders bordered `查看、编辑、删除、审计` buttons. Verify 查看 opens a read-only detail dialog, 审计 opens a history dialog, 删除 requires confirmation before removing the row, and compact audit columns expose full-value titles plus copy controls. Expand a field row and assert the row receives a wrapping-state class.

- [x] **Step 2: Write failing editor interaction tests**

Assert the domain options are exactly `存款组、贷款组、公共组、结算组、平台组`; the selected-field panel has a fuzzy search; both panels expose 全选 and 反选; clicking a selected row toggles its checkbox; and primary-key markers in both panels use the red marker class.

- [x] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: FAIL because the four boxed actions, compact copy cells, dialogs, right-side search, dual selection controls, five group domains, enlarged row selection, and red primary-key markers do not exist.

- [x] **Step 4: Implement list actions and compact wrapping cells**

Replace text links with four outlined buttons. Add page-level read-only detail, audit timeline, and delete-confirmation dialogs. Reduce owner, group-owner, and date widths; render ellipsis by default, full values through `title`, and a copy button that writes the complete value. Add a row class when comparison fields are expanded so compact cells wrap within their fixed widths.

- [x] **Step 5: Implement the expanded field picker**

Increase the transfer area and list viewport heights. Add right-side fuzzy search without changing persisted order. Add 全选/反选 controls to both filtered lists, enlarge checkboxes to 18px, and make selected rows toggle on row click while action buttons stop propagation. Use a red `主键` marker in both panels and neutral panel background so unused space is not rendered as a separate white placeholder box.

- [x] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.spec.js`

Expected: PASS.

- [x] **Step 7: Run full regression, production build, and browser verification**

Run: `npm test && npm run build -- --outDir /tmp/axon-link-replay-db-comparison-build && git diff --check`

Then verify `http://127.0.0.1:5176/#replay-database-comparison-fields` in Playwright and capture the list plus editor screenshots.

- [x] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-09-12-replay-db-comparison-editor-mock.md src/components/replay/ReplayDatabaseComparisonPage.vue src/components/replay/ReplayDatabaseComparisonPage.spec.js src/components/replay/ReplayDatabaseComparisonEditor.vue src/components/replay/ReplayDatabaseComparisonEditor.spec.js
git commit -m "feat(replay): refine comparison registration interactions"
```
