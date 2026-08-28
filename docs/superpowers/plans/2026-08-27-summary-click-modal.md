# Replay Summary Click Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hover-only group and developer summary overlays with click-opened modal dialogs that close only from their X button.

**Architecture:** Keep the two existing on-demand API calls and table models. Replace hover/focus state with one `activeSummaryModal` discriminator and render a shared modal shell whose title, columns, rows, loading state, error state, and width depend on the selected summary type.

**Tech Stack:** Vue 3, Vue Test Utils, Vitest

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md`

## Global Constraints

- Clicking an entry loads only its corresponding API.
- Backdrop and modal-content clicks never close the modal.
- Only the top-right X closes the modal.
- Preserve copy-as-TSV, large-table scrolling, loading/error states, and list filter state.

---

### Task 1: Define the Click-Only Modal Contract

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.spec.js`

- [x] Write failing tests proving hover does not open, click opens the correct table, backdrop does not close, X closes, and the second entry uses its own API/data.
- [x] Run `npm test -- src/components/replay/ReplayIssuePage.spec.js` and verify the new tests fail for the missing click-modal behavior.

### Task 2: Implement the Shared Summary Modal

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.vue`

- [x] Convert both summary entries to buttons with click handlers.
- [x] Replace hover positioning/leave logic with a shared modal discriminator and explicit close function.
- [x] Render one modal mask and dynamic table without a mask click-close handler.
- [x] Preserve the copy action and responsive width differences.
- [x] Run the focused test file until green.

### Task 3: Verify and Package Frontend Assets

**Files:**
- Generated: `/Users/java/axon-link-server/src/main/resources/static/**`

- [x] Run `npm test`.
- [x] Run `npm run build` to synchronize the frontend into backend static resources.
- [x] Run `git diff --check` in frontend, backend, and Obsidian worktrees.
- [x] Verify both entry interactions in the local browser.
