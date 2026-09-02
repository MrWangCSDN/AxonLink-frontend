# Replay Statistics Modal Minimize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give “各组问题数”“各组开发负责人问题排名”“计划完成情况” independent minimize/restore sessions with source-button status, bidirectional motion, outer-filter isolation, and X-only reset.

**Architecture:** `ReplayIssuePage.vue` remains the single window coordinator and guarantees that at most one statistics window is open. Group and person summaries receive separate in-page session records; `ReplayPlannedCompletionModal.vue` remains mounted and distinguishes `closed`, `open`, and `minimized` so its date, group, split layout, drawer, and scroll state survive minimization. A focused motion helper calculates source-button transforms and waits for CSS animation completion without coupling window state to DOM geometry.

**Tech Stack:** Vue 3 Composition API, Vitest, Vue Test Utils, Lucide Vue Next, CSS keyframes, Vite.

**Spec:** `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md` — section “三个统计模态框的最小化与状态隔离（2026-09-02）”.

## Global Constraints

- Window IDs are exactly `group`, `person`, and `completion`; statuses are exactly `closed`, `open`, and `minimized`.
- At most one statistics window may be `open`; switching windows minimizes the current one before restoring or initializing the target.
- A minimized window never inherits later outer replay-type, grouping, header-filter, priority-task, or sort changes.
- X clears only the current window session; minimize and restore preserve its internal filters, group, dates, split ratio, collapsed state, drawer, and scroll positions.
- Restore re-fetches current data with the saved internal conditions; a failed refresh keeps the last successful rows and conditions visible.
- State is page-session-only and is not written to browser storage or the backend.
- Backdrop clicks and Escape do not close any of the three windows.
- Motion lasts 300ms, backdrop fade lasts 220ms, and `prefers-reduced-motion: reduce` switches state without spatial animation.
- No backend API, database, YAML, or Excel contract changes are part of this feature.

---

### Task 1: Add deterministic window-motion geometry and completion helpers

**Files:**
- Create: `src/components/replay/replayModalMotion.js`
- Create: `src/components/replay/replayModalMotion.spec.js`

**Interfaces:**
- Consumes: browser `DOMRect`-shaped objects and an optional `matchMedia` function.
- Produces: `REPLAY_MODAL_MOTION_MS`, `REPLAY_MODAL_BACKDROP_MS`, `replayModalMotionVariables(dialogRect, targetRect)`, `replayModalMotionReduced(matchMedia)`, and `waitForReplayModalMotion(element, duration)`.

- [ ] **Step 1: Write failing geometry, reduced-motion, and completion tests**

```js
import { describe, expect, it, vi } from 'vitest'
import {
  REPLAY_MODAL_MOTION_MS,
  replayModalMotionReduced,
  replayModalMotionVariables,
  waitForReplayModalMotion,
} from './replayModalMotion.js'

describe('replay modal motion', () => {
  it('maps the dialog center and size to the source button', () => {
    expect(replayModalMotionVariables(
      { left: 100, top: 80, width: 800, height: 400 },
      { left: 40, top: 20, width: 160, height: 40 },
    )).toEqual({
      '--replay-window-x': '-380px',
      '--replay-window-y': '-240px',
      '--replay-window-scale-x': '0.2',
      '--replay-window-scale-y': '0.1',
    })
  })

  it('honors reduced motion', () => {
    expect(replayModalMotionReduced(() => ({ matches: true }))).toBe(true)
    expect(replayModalMotionReduced(() => ({ matches: false }))).toBe(false)
  })

  it('finishes from animationend without waiting for the fallback', async () => {
    vi.useFakeTimers()
    const element = document.createElement('div')
    const finished = waitForReplayModalMotion(element, REPLAY_MODAL_MOTION_MS)
    element.dispatchEvent(new Event('animationend'))
    await expect(finished).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- src/components/replay/replayModalMotion.spec.js`

Expected: FAIL because `./replayModalMotion.js` does not exist.

- [ ] **Step 3: Implement the motion helper**

```js
export const REPLAY_MODAL_MOTION_MS = 300
export const REPLAY_MODAL_BACKDROP_MS = 220

export function replayModalMotionVariables(dialogRect, targetRect) {
  const dialogCenterX = dialogRect.left + dialogRect.width / 2
  const dialogCenterY = dialogRect.top + dialogRect.height / 2
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2
  return {
    '--replay-window-x': `${targetCenterX - dialogCenterX}px`,
    '--replay-window-y': `${targetCenterY - dialogCenterY}px`,
    '--replay-window-scale-x': `${targetRect.width / dialogRect.width}`,
    '--replay-window-scale-y': `${targetRect.height / dialogRect.height}`,
  }
}

export function replayModalMotionReduced(matchMedia = globalThis.matchMedia) {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function waitForReplayModalMotion(element, duration = REPLAY_MODAL_MOTION_MS) {
  if (!element || replayModalMotionReduced()) return Promise.resolve()
  return new Promise((resolve) => {
    let finished = false
    const complete = () => {
      if (finished) return
      finished = true
      element.removeEventListener('animationend', complete)
      clearTimeout(fallback)
      resolve()
    }
    const fallback = setTimeout(complete, duration + 80)
    element.addEventListener('animationend', complete, { once: true })
  })
}
```

- [ ] **Step 4: Run the focused test and confirm all helper cases pass**

Run: `npm test -- src/components/replay/replayModalMotion.spec.js`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the helper and test**

```bash
git add src/components/replay/replayModalMotion.js src/components/replay/replayModalMotion.spec.js
git commit -m "feat: add replay modal window motion helpers"
```

---

### Task 2: Give group and person summaries independent window sessions

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.vue`
- Modify: `src/components/replay/ReplayIssuePage.spec.js`
- Consume: `src/components/replay/replayModalMotion.js`

**Interfaces:**
- Consumes: `replayModalMotionVariables()`, `waitForReplayModalMotion()`, and the existing summary APIs.
- Produces: per-window session records with `{ status, groupBy, replayType, rows, loading, refreshing, error, activeGroup, scrollTop, requestVersion }`; entry test IDs remain `group-summary-entry` and `person-ranking-entry`.

- [ ] **Step 1: Add failing tests for independent minimized state and outer-filter isolation**

Add these cases to `ReplayIssuePage.spec.js`:

```js
it('minimizes both summary windows independently and ignores later toolbar changes', async () => {
  const wrapper = mount(ReplayIssuePage)
  await flushPromises()

  await wrapper.get('[data-testid="group-summary-entry"]').trigger('click')
  await flushPromises()
  await wrapper.get('[data-testid="replay-type-dz-modal"]').trigger('click')
  await flushPromises()
  await wrapper.get('[data-testid="minimize-summary-modal"]').trigger('click')
  await flushPromises()

  expect(wrapper.get('[data-testid="group-summary-entry"]').attributes('data-window-state')).toBe('minimized')
  expect(wrapper.find('[data-testid="summary-modal-mask"]').exists()).toBe(false)

  await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
  await flushPromises()
  await wrapper.findAll('[data-testid="person-ranking-group-tab"]')[1].trigger('click')
  await wrapper.get('[data-testid="minimize-summary-modal"]').trigger('click')
  await wrapper.get('[data-testid="replay-type-query-toolbar"]').trigger('click')
  await flushPromises()

  await wrapper.get('[data-testid="group-summary-entry"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[data-testid="replay-type-dz-modal"]').attributes('aria-pressed')).toBe('true')

  await wrapper.get('[data-testid="minimize-summary-modal"]').trigger('click')
  await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
  await flushPromises()
  expect(wrapper.findAll('[data-testid="person-ranking-group-tab"]')[1].attributes('data-active')).toBe('true')
})
```

Mock `Element.prototype.getBoundingClientRect` with non-zero dialog and entry rectangles and dispatch `animationend` in the test helper so the tests do not wait for timers.

- [ ] **Step 2: Run the focused tests and confirm missing minimize controls/state attributes**

Run: `npm test -- src/components/replay/ReplayIssuePage.spec.js -t "minimizes both summary windows"`

Expected: FAIL because `minimize-summary-modal` and `data-window-state` do not exist.

- [ ] **Step 3: Replace shared summary session refs with two explicit session records**

Use this exact record shape inside `ReplayIssuePage.vue`:

```js
function createSummaryWindowSession() {
  return reactive({
    status: 'closed',
    groupBy: 'issueDomain',
    replayType: 'ALL',
    rows: [],
    loading: false,
    refreshing: false,
    error: '',
    activeGroup: '存款组',
    scrollTop: 0,
    requestVersion: 0,
  })
}

const summaryWindowSessions = {
  group: createSummaryWindowSession(),
  person: createSummaryWindowSession(),
}
const activeSummaryModal = ref('')
const activeSummarySession = computed(() => summaryWindowSessions[activeSummaryModal.value] || null)

function personRankingGroupsFor(groupBy) {
  return groupBy === 'issueDomain' ? issueDomainPersonRankingGroups : domainPersonRankingGroups
}
```

Derive modal replay type, grouping, rows, loading, error, and person active group from `activeSummarySession`. Remove `summaryModalGroupBy`, `summaryModalReplayType`, `groupSummaryRows`, `personRankingRows`, `groupSummaryLoading`, `personRankingLoading`, `groupSummaryError`, `personRankingError`, and the shared `activePersonRankingGroup`.

- [ ] **Step 4: Implement initialize, refresh-preserving, minimize, and X-reset semantics**

The summary loader must keep prior rows on refresh failure and ignore responses received after X:

```js
async function loadSummaryRows(type, { refresh = false } = {}) {
  const session = summaryWindowSessions[type]
  if (session.loading || session.refreshing) return
  const requestVersion = ++session.requestVersion
  session[refresh ? 'refreshing' : 'loading'] = true
  session.error = ''
  try {
    const loader = type === 'group' ? getReplayIssueGroupSummaries : getReplayIssuePersonRankings
    const rows = await loader({ groupBy: session.groupBy, replayType: session.replayType }) || []
    if (requestVersion !== session.requestVersion || session.status === 'closed') return
    session.rows = rows
    if (type === 'person' && !personRankingGroupsFor(session.groupBy).includes(session.activeGroup)) {
      session.activeGroup = '存款组'
    }
  } catch (cause) {
    if (requestVersion === session.requestVersion && session.status !== 'closed') {
      session.error = `数据刷新失败，请稍后重试：${cause?.message || cause}`
    }
  } finally {
    if (requestVersion === session.requestVersion) {
      session.loading = false
      session.refreshing = false
    }
  }
}
```

`openSummaryModal(type)` initializes from `statisticsGroupBy`/`statisticsReplayType` only when `status === 'closed'`; restoring a minimized session leaves those values unchanged and invokes `loadSummaryRows(type, { refresh: true })`. `closeSummaryModal()` increments `requestVersion` and replaces every mutable session field with its default. `minimizeSummaryModal()` records `.replay-summary-table-wrap.scrollTop`, runs the minimize motion, sets `status = 'minimized'`, and clears `activeSummaryModal` without resetting the record.

- [ ] **Step 5: Add the minimize button and three entry visual states**

Import `Minus` from `lucide-vue-next`. Add the title-bar button before X:

```vue
<button
  class="replay-icon-button"
  type="button"
  data-testid="minimize-summary-modal"
  title="最小化"
  aria-label="最小化"
  :disabled="statisticsWindowTransitioning"
  @click="minimizeSummaryModal"
>
  <Minus :size="18" aria-hidden="true" />
</button>
```

Each source button gets `:data-window-state="summaryWindowSessions.group.status"` or `person.status`, `:aria-label` that includes “窗口已最小化，点击恢复” when minimized, and classes `is-window-open` / `is-window-minimized`. Use solid blue for open and light-blue border plus an orange pseudo-element and visible minus mark for minimized.

- [ ] **Step 6: Run the summary-window tests**

Run: `npm test -- src/components/replay/ReplayIssuePage.spec.js -t "summary|ranking|minimiz|window"`

Expected: PASS; existing X-only-close tests continue to pass after their assertions are expanded to verify that backdrop and Escape do nothing.

- [ ] **Step 7: Commit independent summary sessions**

```bash
git add src/components/replay/ReplayIssuePage.vue src/components/replay/ReplayIssuePage.spec.js
git commit -m "feat: preserve minimized replay summary sessions"
```

---

### Task 3: Preserve the complete plan-completion session across minimization

**Files:**
- Modify: `src/components/replay/ReplayPlannedCompletionModal.vue`
- Modify: `src/components/replay/ReplayPlannedCompletionModal.spec.js`
- Modify: `src/components/replay/ReplayIssuePage.vue`
- Modify: `src/components/replay/ReplayIssuePage.spec.js`

**Interfaces:**
- `ReplayPlannedCompletionModal` replaces Boolean `open` with `windowState: 'closed' | 'open' | 'minimized'`.
- Emits: `minimize`, `close`, `update:groupBy`, and `update:replayType`.
- Exposes: `getWindowElement(): HTMLElement | null` for parent motion measurement.

- [ ] **Step 1: Write failing component tests for minimize preservation and X reset**

Add these tests to `ReplayPlannedCompletionModal.spec.js`:

```js
it('preserves dates group split state drawer and scroll when minimized then refreshes on restore', async () => {
  const wrapper = mount(ReplayPlannedCompletionModal, {
    props: { windowState: 'open', groupBy: 'issueDomain', replayType: 'DZ' },
  })
  await flushPromises()

  await wrapper.get('[data-testid="completion-start-date"]').setValue('2026-08-22')
  await wrapper.get('[data-testid="completion-end-date"]').setValue('2026-08-27')
  await wrapper.get('[data-testid="apply-completion-range"]').trigger('click')
  await flushPromises()
  await wrapper.findAll('[data-testid="completion-group-tab"]')[3].trigger('click')
  await wrapper.get('[data-testid="completion-collapse-upper"]').trigger('click')
  wrapper.get('.replay-completion-timeline-scroll').element.scrollLeft = 137

  await wrapper.get('[data-testid="minimize-completion-modal"]').trigger('click')
  expect(wrapper.emitted('minimize')).toHaveLength(1)
  await wrapper.setProps({ windowState: 'minimized' })
  await wrapper.setProps({ windowState: 'open' })
  await flushPromises()

  expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-22')
  expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-27')
  expect(wrapper.findAll('[data-testid="completion-group-tab"]')[3].attributes('data-active')).toBe('true')
  expect(wrapper.get('[data-testid="completion-split-layout"]').classes()).toContain('is-upper-collapsed')
  expect(wrapper.get('.replay-completion-timeline-scroll').element.scrollLeft).toBe(137)
  expect(getReplayCompletionDatePoints).toHaveBeenCalledTimes(1)
  expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
    startDate: '2026-08-22', endDate: '2026-08-27', groupBy: 'issueDomain', replayType: 'DZ',
  })
})

it('resets the saved plan-completion session only after closed', async () => {
  const wrapper = mount(ReplayPlannedCompletionModal, { props: { windowState: 'open' } })
  await flushPromises()
  await wrapper.findAll('[data-testid="completion-group-tab"]')[2].trigger('click')
  await wrapper.setProps({ windowState: 'closed' })
  await wrapper.setProps({ windowState: 'open' })
  await flushPromises()
  expect(wrapper.findAll('[data-testid="completion-group-tab"]')[0].attributes('data-active')).toBe('true')
  expect(getReplayCompletionDatePoints).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run focused planned-completion tests and confirm the prop/control failures**

Run: `npm test -- src/components/replay/ReplayPlannedCompletionModal.spec.js -t "minimized|closed"`

Expected: FAIL because `windowState` and `minimize-completion-modal` are absent.

- [ ] **Step 3: Convert the component lifecycle to closed/open/minimized**

Use this public contract:

```js
const props = defineProps({
  windowState: {
    type: String,
    default: 'closed',
    validator: value => ['closed', 'open', 'minimized'].includes(value),
  },
  groupBy: { type: String, default: 'domain' },
  replayType: { type: String, default: 'ALL' },
})
const emit = defineEmits(['minimize', 'close', 'update:groupBy', 'update:replayType'])
const windowElementRef = ref(null)
const initialized = ref(false)
defineExpose({ getWindowElement: () => windowElementRef.value })
```

Keep the mask and modal DOM mounted with `v-show="windowState === 'open'"`, so native scroll positions survive minimization. Update every existing component test mount from `props: { open: true }` to `props: { windowState: 'open' }`. The new watcher behavior is:

```js
watch(() => props.windowState, async (state, previousState) => {
  if (state === 'closed') {
    disposeSplitLayout()
    resetSession()
    initialized.value = false
    return
  }
  if (state === 'minimized') {
    disposeSplitLayout()
    return
  }
  if (!initialized.value || previousState === 'closed') {
    await initialize()
    initialized.value = true
    return
  }
  await refreshPreservedSession()
}, { immediate: true })
```

`resetSession()` clears dates, indices, dashboard, active group, drawer, split layout, snapshot feedback, and errors. `refreshPreservedSession()` calls `loadDashboard(startDateInput.value, endDateInput.value, { closeDrawer: false })`, keeps the current dashboard on failure, reattaches observers, and restores timeline/lower-pane scroll positions after `nextTick()`.

- [ ] **Step 4: Add a minimize title-bar control without changing X semantics**

Import `Minus`; add `data-testid="minimize-completion-modal"` before the existing X. Its click emits `minimize`. Backdrop clicks and Escape remain inert. Set `ref="windowElementRef"` on `.replay-completion-modal`.

- [ ] **Step 5: Integrate the completion session into the parent window registry**

Replace `plannedCompletionOpen` with:

```js
const completionWindow = reactive({ status: 'closed' })
const plannedCompletionRef = ref(null)
```

Pass `:window-state="completionWindow.status"`, `ref="plannedCompletionRef"`, `@minimize="minimizeStatisticsWindow('completion')"`, and `@close="closeStatisticsWindow('completion')"`. Initialize `plannedCompletionGroupBy` and `plannedCompletionReplayType` from the outer toolbar only when completion status is `closed`; restoring from minimized does not assign either value.

- [ ] **Step 6: Run the planned component and parent integration tests**

Run: `npm test -- src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/ReplayIssuePage.spec.js -t "completion|minimiz|closed"`

Expected: PASS with preserved internal conditions and X-only reset.

- [ ] **Step 7: Commit the planned-completion session lifecycle**

```bash
git add src/components/replay/ReplayPlannedCompletionModal.vue src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/ReplayIssuePage.vue src/components/replay/ReplayIssuePage.spec.js
git commit -m "feat: preserve minimized replay completion state"
```

---

### Task 4: Coordinate three-window switching and bidirectional motion

**Files:**
- Modify: `src/components/replay/ReplayIssuePage.vue`
- Modify: `src/components/replay/ReplayIssuePage.spec.js`
- Modify: `src/components/replay/ReplayPlannedCompletionModal.vue`
- Modify: `src/components/replay/ReplayPlannedCompletionModal.spec.js`
- Consume: `src/components/replay/replayModalMotion.js`

**Interfaces:**
- Produces parent methods `openStatisticsWindow(id)`, `minimizeStatisticsWindow(id)`, `closeStatisticsWindow(id)`, `runStatisticsWindowMotion(id, direction)`.
- Motion direction is exactly `minimize` or `restore`; the three source buttons provide stable element refs.

- [ ] **Step 1: Write failing tests for sequential switching, three minimized indicators, and stale responses**

Add a parent test that opens group, clicks person while group is open, and verifies the group reaches `minimized` before person reaches `open`. Continue by minimizing person and completion, then assert:

```js
expect(wrapper.get('[data-testid="group-summary-entry"]').attributes('data-window-state')).toBe('minimized')
expect(wrapper.get('[data-testid="person-ranking-entry"]').attributes('data-window-state')).toBe('minimized')
expect(wrapper.get('[data-testid="planned-completion-entry"]').attributes('data-window-state')).toBe('minimized')
expect(wrapper.findAll('[aria-modal="true"]')).toHaveLength(0)
```

Add a second test with a deferred group API promise: close with X before resolving, resolve the promise, reopen, and verify the stale rows never appear and a new API call supplies the reopened rows.

- [ ] **Step 2: Run focused tests and confirm switching/state failures**

Run: `npm test -- src/components/replay/ReplayIssuePage.spec.js -t "three minimized|switches statistics windows|stale"`

Expected: FAIL until the coordinator and request version guards are complete.

- [ ] **Step 3: Implement the parent coordinator**

Use one transition lock and these exact registry helpers:

```js
const statisticsWindowTransitioning = ref(false)

function statisticsWindowRecord(id) {
  if (id === 'completion') return completionWindow
  const record = summaryWindowSessions[id]
  if (!record) throw new Error('未知统计窗口')
  return record
}

function statisticsWindowStatus(id) {
  return statisticsWindowRecord(id).status
}

function setStatisticsWindowStatus(id, status) {
  statisticsWindowRecord(id).status = status
  if (id === 'completion') return
  activeSummaryModal.value = status === 'open' ? id : activeSummaryModal.value === id ? '' : activeSummaryModal.value
}

function currentOpenStatisticsWindow() {
  return ['group', 'person', 'completion']
    .find(id => statisticsWindowStatus(id) === 'open') || ''
}

function prepareStatisticsWindow(id, previousStatus) {
  if (previousStatus !== 'closed') return
  if (id === 'completion') {
    plannedCompletionGroupBy.value = statisticsGroupBy.value
    plannedCompletionReplayType.value = statisticsReplayType.value
    return
  }
  const session = summaryWindowSessions[id]
  session.groupBy = statisticsGroupBy.value
  session.replayType = statisticsReplayType.value
  session.activeGroup = '存款组'
}

async function refreshStatisticsWindow(id, previousStatus) {
  if (id === 'completion') return
  await loadSummaryRows(id, { refresh: previousStatus === 'minimized' })
}

async function openStatisticsWindow(id) {
  if (statisticsWindowTransitioning.value) return
  statisticsWindowTransitioning.value = true
  try {
    const currentId = currentOpenStatisticsWindow()
    if (currentId && currentId !== id) await minimizeStatisticsWindow(currentId, { coordinated: true })
    const previousStatus = statisticsWindowStatus(id)
    prepareStatisticsWindow(id, previousStatus)
    setStatisticsWindowStatus(id, 'open')
    await nextTick()
    await runStatisticsWindowMotion(id, 'restore')
    await refreshStatisticsWindow(id, previousStatus)
  } finally {
    statisticsWindowTransitioning.value = false
  }
}

function resetSummaryWindowSession(id) {
  const session = summaryWindowSessions[id]
  const nextVersion = session.requestVersion + 1
  Object.assign(session, {
    status: 'closed',
    groupBy: 'issueDomain',
    replayType: 'ALL',
    rows: [],
    loading: false,
    refreshing: false,
    error: '',
    activeGroup: '存款组',
    scrollTop: 0,
    requestVersion: nextVersion,
  })
}

function closeStatisticsWindow(id) {
  if (statisticsWindowTransitioning.value) return
  if (id === 'completion') {
    completionWindow.status = 'closed'
    return
  }
  resetSummaryWindowSession(id)
  if (activeSummaryModal.value === id) activeSummaryModal.value = ''
}
```

`minimizeStatisticsWindow(id, { coordinated = false } = {})` captures scroll state, applies `replayModalMotionVariables`, adds `is-window-minimizing`, waits for motion, then sets status to minimized; it skips the external lock check only when `coordinated` is true. `closeStatisticsWindow` invalidates request versions only for group/person; completion request invalidation and reset are owned by the child watcher when it receives `closed`. `runStatisticsWindowMotion(id, direction)` resolves the entry ref plus the currently rendered dialog element, applies variables, adds `is-window-minimizing` or `is-window-restoring`, awaits `waitForReplayModalMotion`, and removes the class and inline variables in `finally`. `openStatisticsWindow` makes the target visible before restore motion. Completion data refresh is owned by the child's `windowState` watcher; group/person refresh is owned by `refreshStatisticsWindow`.

- [ ] **Step 4: Add shared motion CSS and explicit state styling**

Use these keyframes in `ReplayIssuePage.vue` and equivalent scoped selectors in the completion component:

```css
@keyframes replay-window-minimize {
  from { transform: translate(0,0) scale(1,1); opacity: 1; }
  to { transform: translate(var(--replay-window-x),var(--replay-window-y)) scale(var(--replay-window-scale-x),var(--replay-window-scale-y)); opacity: 0; }
}
@keyframes replay-window-restore {
  from { transform: translate(var(--replay-window-x),var(--replay-window-y)) scale(var(--replay-window-scale-x),var(--replay-window-scale-y)); opacity: 0; }
  to { transform: translate(0,0) scale(1,1); opacity: 1; }
}
.is-window-minimizing { animation: replay-window-minimize 300ms cubic-bezier(.4,0,.2,1) forwards; }
.is-window-restoring { animation: replay-window-restore 300ms cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) {
  .is-window-minimizing,.is-window-restoring { animation-duration: .01ms; }
}
```

Backdrop opacity transitions over 220ms. While `statisticsWindowTransitioning` is true, disable all three entry buttons plus minimize/X controls. Open entries use solid blue; minimized entries use a light-blue border, orange dot, visible minus mark, and the accessible label “窗口已最小化，点击恢复”.

- [ ] **Step 5: Verify refresh failures keep old data and conditions**

Add assertions for group/person and completion: after one successful load, minimize, make the restore API reject, restore, then verify old rows/dates remain visible together with “数据刷新失败，请稍后重试”. The modal must stay open and the source button must remain in the open style.

- [ ] **Step 6: Run all replay component tests**

Run: `npm test -- src/components/replay/ReplayIssuePage.spec.js src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/replayModalMotion.spec.js`

Expected: PASS with no unhandled promise rejections and no real 300ms waits in unit tests.

- [ ] **Step 7: Commit coordinated switching and animation**

```bash
git add src/components/replay/ReplayIssuePage.vue src/components/replay/ReplayIssuePage.spec.js src/components/replay/ReplayPlannedCompletionModal.vue src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/replayModalMotion.js src/components/replay/replayModalMotion.spec.js
git commit -m "feat: animate replay statistics window switching"
```

---

### Task 5: Full regression, browser acceptance, and backend static packaging

**Files:**
- Verify: `src/components/replay/ReplayIssuePage.vue`
- Verify: `src/components/replay/ReplayPlannedCompletionModal.vue`
- Generated by build: `/Users/java/axon-link-server/src/main/resources/static/**`
- Update after implementation: `/Users/java/obsidian/01 Engineering/axon-link-server/并行回放问题清单-系统设计.md`
- Update after implementation: `/Users/java/obsidian/log.md`

**Interfaces:**
- Consumes the completed frontend implementation and existing Vite mock endpoints.
- Produces verified production assets in the backend static directory and an implementation-status note in the design source of truth.

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm test`

Expected: all test files pass with zero failed tests.

- [ ] **Step 2: Build the frontend into the backend static directory**

Run: `npm run build`

Expected: Vite exits 0 and writes `index.html` plus hashed assets to `/Users/java/axon-link-server/src/main/resources/static`.

- [ ] **Step 3: Start the Vite mock preview for browser acceptance**

Run: `npm run dev -- --host 127.0.0.1 --port 5173`

Expected: `http://127.0.0.1:5173/#replay-issues` loads the mock problem list.

- [ ] **Step 4: Verify all three sessions and outer isolation in a real browser**

Perform this exact sequence:

1. Open “各组问题数”, choose `动账` and `按领域`, then minimize.
2. Open “各组开发负责人问题排名”, choose `查询`, `按问题所属领域`, and `贷款组`, then minimize.
3. Open “计划完成情况”, choose a non-default date range, `结算组`, collapse the upper pane, scroll the timeline, and minimize.
4. Confirm all three source buttons show minimized state and no overlay remains.
5. Change the outer toolbar to `全部` and `按问题所属领域`, add a table-header filter, then restore each window.
6. Confirm every window retains its own previously selected values, scroll position, and split state; confirm each restore makes one fresh request with its saved conditions.
7. While one window is open, click another minimized source button; confirm the first flies back before the second expands and only one backdrop is visible.
8. Click X on the person window, reopen it, and confirm it inherits the current outer toolbar and returns to the default `存款组`.
9. Refresh the browser and confirm all three source buttons return to normal closed state.

- [ ] **Step 5: Verify reduced-motion behavior**

Emulate `prefers-reduced-motion: reduce`, repeat minimize and restore, and confirm state switches without spatial flight while the same filters remain preserved.

- [ ] **Step 6: Update the design implementation status and Wiki log**

Add an `[IMPL] 已实现（2026-09-02）` note under the minimize section recording the final passing test count, production build, and browser acceptance. Append one `2026-09-02 [IMPL]` line to `/Users/java/obsidian/log.md`. Do not alter API or data-model documents because no contract changed.

- [ ] **Step 7: Review diffs without absorbing unrelated workspace changes**

Run:

```bash
git status --short
git diff -- src/components/replay/ReplayIssuePage.vue src/components/replay/ReplayIssuePage.spec.js src/components/replay/ReplayPlannedCompletionModal.vue src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/replayModalMotion.js src/components/replay/replayModalMotion.spec.js
git -C /Users/java/axon-link-server diff -- src/main/resources/static
```

Expected: only the planned frontend sources/tests, generated backend static assets, implementation plan, and approved design/log updates are attributable to this feature; unrelated dirty files remain untouched.

- [ ] **Step 8: Commit implementation status and generated assets only when authorized**

```bash
git add docs/superpowers/plans/2026-09-02-replay-statistics-modal-minimize.md src/components/replay/ReplayIssuePage.vue src/components/replay/ReplayIssuePage.spec.js src/components/replay/ReplayPlannedCompletionModal.vue src/components/replay/ReplayPlannedCompletionModal.spec.js src/components/replay/replayModalMotion.js src/components/replay/replayModalMotion.spec.js
git commit -m "feat: add minimizable replay statistics windows"
```

Commit `/Users/java/axon-link-server/src/main/resources/static` separately in the backend repository only if the user requests a repository commit. Do not include unrelated modified or untracked files from either repository.
