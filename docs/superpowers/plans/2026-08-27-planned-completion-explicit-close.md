# Planned Completion Explicit Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the planned-completion modal close only from its explicit top-right close button.

**Architecture:** Keep the component's existing `close` event contract and remove the backdrop as an event source. Protect the contract with a focused Vue component regression test.

**Tech Stack:** Vue 3, Vue Test Utils, Vitest

**Spec:** User-approved interaction: backdrop and modal content do not close the dialog; only the X button emits `close`.

## Global Constraints

- Preserve all existing timeline, group tab, drawer, and reopen behavior.
- Do not modify backend APIs or data models.

---

### Task 1: Restrict Modal Closing to the X Button

**Files:**
- Modify: `src/components/replay/ReplayPlannedCompletionModal.vue`
- Test: `src/components/replay/ReplayPlannedCompletionModal.spec.js`

**Interfaces:**
- Consumes: `open: Boolean` component prop.
- Produces: `close` event only when `.replay-completion-close` is clicked.

- [x] **Step 1: Write the failing test**

Mount the open modal, click `.replay-completion-mask`, assert that no `close` event exists, then click `.replay-completion-close` and assert exactly one `close` event.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/replay/ReplayPlannedCompletionModal.spec.js`

Expected: FAIL because the mask currently emits `close`.

- [x] **Step 3: Write minimal implementation**

Remove `@click.self="emit('close')"` from `.replay-completion-mask`; retain the close-button handler.

- [x] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- src/components/replay/ReplayPlannedCompletionModal.spec.js
npm test
npm run build
```

Expected: all tests and the production build pass.
