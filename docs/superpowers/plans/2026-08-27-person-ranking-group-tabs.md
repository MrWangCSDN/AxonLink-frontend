# Person Ranking Group Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the developer ranking modal into four group tabs and restrict table display and clipboard copy to the selected group.

**Architecture:** Keep the existing all-group ranking API response in memory. Add a modal-local selected group, derive visible person rows by exact `groupName`, and make both rendering and TSV copy consume that same derived row set.

**Tech Stack:** Vue 3, Vue Test Utils, Vitest

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md`

## Global Constraints

- Tab order is `存款组`, `贷款组`, `公共组`, `结算组`.
- Every modal open defaults to `存款组`.
- Switching tabs performs no API request.
- Person ranking table and copy action contain only the selected group.
- Group summary modal behavior remains unchanged.

---

### Task 1: Protect Group Selection and Copy Semantics

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.spec.js`

- [x] Add a failing test that opens person ranking, asserts the four tabs and deposit default, switches to loan, observes only loan rows, closes, and observes deposit after reopening.
- [x] Add a failing clipboard test proving the copied TSV contains the selected group's rows and excludes all other groups.
- [x] Run `npm test -- src/components/replay/ReplayIssuePage.spec.js` and confirm failures are caused by the missing tabs/filtering.

### Task 2: Implement Modal-Local Group Filtering

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.vue`

- [x] Add the fixed group list and `activePersonRankingGroup` state.
- [x] Reset the state to `存款组` whenever the person modal opens.
- [x] Derive visible person rows by exact group and render four tab buttons only in the person modal.
- [x] Change person TSV copying to use the derived visible rows.
- [x] Add compact tab styles and run the focused test file until green.

### Task 3: Verify and Synchronize Assets

**Files:**
- Generated: `/Users/java/axon-link-server/src/main/resources/static/**`

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `git diff --check` in frontend, backend, and Obsidian worktrees.
- [x] Verify default deposit, group switching, and close/reopen reset in the local browser.
