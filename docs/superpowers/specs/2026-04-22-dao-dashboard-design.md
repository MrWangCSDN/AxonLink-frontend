# DAO Dashboard Design

- Date: 2026-04-22
- Scope: `DAO 索引巡检 -> 概览仪表盘`
- Status: Approved for spec drafting, pending implementation

## Goal

Build the DAO dashboard as a management-oriented overview page using mock data first.

The page should answer four questions quickly:

1. What is the current inspection status for the selected environment?
2. How large is the problem space right now?
3. Is the situation improving or deteriorating over the last 7 days?
4. Where should the user go next to investigate or act?

This is not a standalone reporting page. It should work as the default entry page for the DAO inspection module and route users into `SQL 分析`, `巡检任务`, and `表维度建议`.

## Chosen Direction

The approved direction is `A 管理总览` with clickable drill-down behavior.

Design intent:

- Prioritize global summary and management readability.
- Keep the first screen decision-friendly rather than detail-heavy.
- Preserve direct navigation into downstream pages so the dashboard is useful, not decorative.

## In Scope

- Replace the current empty state in `DaoDashboard.vue` with a real dashboard.
- Use mock summary data for `DEV`, `SIT`, and `UAT`.
- Support environment switching with visibly different dashboard states.
- Make dashboard modules clickable and route users to downstream DAO pages with filters.
- Preserve current DAO module visual language and existing page shell.

## Out of Scope

- Real backend integration with `GET /summary`.
- New charting libraries.
- Complex chart animation.
- Large-scale refactor of DAO module routing or sidebar structure.
- Changes to non-DAO sections of the product.

## Users

- Engineering managers checking inspection health by environment.
- Architects or senior engineers looking for risk concentration and trends.
- Developers who need a fast jump from summary to detailed SQL analysis.

## Page Structure

The dashboard should be organized into four vertical zones.

### 1. Sticky Header

Contents:

- Breadcrumb: `DAO 索引巡检 / 概览仪表盘`
- Title: `概览仪表盘`
- Environment switcher: `DEV / SIT / UAT`
- Short summary sentence for the current environment
- Data freshness label such as `刚刚更新`

Purpose:

- Keep context and environment selection always visible.
- Make the page feel like an operating console rather than a static report.

### 2. KPI Row

Four equal-weight KPI cards:

- `SQL 总数`
- `高风险 SQL`
- `LLM 完成率`
- `运行中任务`

Each card should show:

- A clear label
- A primary value
- A short secondary status string or delta
- A hover state that suggests clickability

Each card should be clickable and route the user to the relevant downstream page.

### 3. Analysis Row

Two primary modules:

- `近 7 天趋势`
- `评级分布`

Layout:

- Trend chart on the left as the dominant module
- Rating distribution on the right as the supporting structural module

Purpose:

- Show movement over time
- Show current composition of quality levels

### 4. Action Row

Three modules:

- `最差 TOP 表`
- `待关注事项`
- `最近任务`

Purpose:

- Convert summary into action
- Surface the highest-value next clicks

## Visual Direction

The dashboard should extend the existing DAO module look and feel instead of introducing a new brand layer.

Rules:

- Reuse the module accent purple sparingly for tags, highlights, and interactive emphasis.
- Keep KPI cards brighter and cleaner than lower sections.
- Keep charts and action panels quieter so the KPI row remains the first read.
- Preserve good contrast in both light and dark mode.
- Avoid a marketing-style chart page. This should read as an internal operations dashboard.

## Interaction Design

All major summary modules should drill into existing DAO pages.

### KPI Card Actions

- `SQL 总数` -> open `SQL 分析` with no extra filters
- `高风险 SQL` -> open `SQL 分析` with `overallRating=POOR`
- `LLM 完成率` -> open `SQL 分析` with `llmStatus=PENDING`
- `运行中任务` -> open `巡检任务`

### Rating Distribution Actions

Clicking a rating bucket routes to `SQL 分析` with the chosen rating filter:

- `POOR`
- `GOOD`
- `EXCELLENT`
- `NOT_APPLICABLE`

### Top Table Actions

Clicking a table row routes to `SQL 分析` with `tableName=<selected table>`.

### Attention Item Actions

Attention items route to `SQL 分析` using issue-specific filters. Supported mock issue categories:

- Rating disagreement
- Explain error
- LLM failed
- LLM pending too long

### Recent Task Actions

Clicking a task routes to `巡检任务`.

Initial implementation can route to the task list view. Direct task-detail opening can be added later without redesigning the dashboard.

## Mock Data Strategy

The dashboard should be implemented mock-first with a thin adaptation layer so that replacing mock data with a real summary API does not require rewriting the page.

### Mock Environments

Provide three summary variants:

- `DEV`: healthier state, lower risk, lighter task pressure
- `SIT`: medium risk, some failed or pending LLM work
- `UAT`: higher risk concentration and busier task state

### Mock Summary Shape

The summary model should contain seven top-level blocks:

```ts
type DaoDashboardSummary = {
  headline: {
    env: 'dev' | 'sit' | 'uat'
    title: string
    statusText: string
    updatedAtText: string
    riskLevel: 'low' | 'medium' | 'high'
  }
  kpis: Array<{
    key: 'sqlTotal' | 'poorSql' | 'llmCompletion' | 'runningTasks'
    label: string
    value: string
    deltaText?: string
    statusTone?: 'neutral' | 'success' | 'warning' | 'danger'
    goto: DashboardGotoPayload
  }>
  ratingDistribution: Array<{
    key: 'POOR' | 'GOOD' | 'EXCELLENT' | 'NOT_APPLICABLE'
    label: string
    count: number
    ratio: number
    goto: DashboardGotoPayload
  }>
  trend7d: Array<{
    day: string
    total: number
    poor: number
  }>
  topTables: Array<{
    tableName: string
    poorCount: number
    changeText: string
    goto: DashboardGotoPayload
  }>
  attention: Array<{
    key: string
    label: string
    count: number
    desc: string
    goto: DashboardGotoPayload
  }>
  recentTasks: Array<{
    id: string
    label: string
    progressText: string
    statusText: string
    durationText: string
    goto: DashboardGotoPayload
  }>
}
```

## Routing Contract

Dashboard interactions should use the existing `goto` event from `DaoDashboard` to `DaoIndexPage`, but with a more explicit payload shape.

Recommended payload:

```ts
type DashboardGotoPayload =
  | { target: 'sqls'; filter?: Record<string, string | boolean> }
  | { target: 'tasks'; taskId?: string }
  | { target: 'table-advice'; tableName?: string }
```

Behavior:

- `DaoDashboard.vue` emits the payload
- `DaoIndexPage.vue` interprets it
- `DaoIndexPage.vue` applies downstream page switch plus any relevant list filters

This keeps the dashboard unaware of downstream implementation details.

## Component Design

`DaoDashboard.vue` should become a layout container plus data/orchestration layer.

Recommended child components:

- `DiiDashboardKpiCard`
- `DiiDashboardTrendChart`
- `DiiDashboardRatingBreakdown`
- `DiiDashboardTopRiskList`
- `DiiDashboardAttentionList`
- `DiiDashboardRecentTasks`

Responsibilities:

- `DaoDashboard.vue`
  Chooses summary data by environment, renders the grid, handles click routing.
- Child components
  Render presentational sections and emit local click intents upward.

This split keeps future real-data migration localized and avoids growing `DaoDashboard.vue` into a monolith.

## Rendering Approach

Do not introduce an external chart library.

Use lightweight rendering:

- Trend chart: simple SVG or DOM/CSS bars/lines
- Rating distribution: segmented bar or compact ring-like composition built with CSS/SVG
- Ranking and action panels: plain list-based UI

Rationale:

- Lower implementation risk
- Lower bundle impact
- Easier visual consistency with the existing internal tooling style

## States

The initial mock version should support the same outer shell states that real data will need later.

### Loading

- Optional for the first mock pass
- Can be implemented as skeleton placeholders if needed

### Empty

- KPI values become `--`
- Charts show compact empty visuals
- Lists show a standard `暂无数据` treatment

### Error

- Keep the component structure capable of rendering an error block later
- No real request error handling is required in the first mock-only pass

## Data Flow

1. `DaoIndexPage.vue` owns `env`
2. `DaoDashboard.vue` receives `env`
3. `DaoDashboard.vue` selects the corresponding mock summary
4. Child components render sections from the summary model
5. User clicks a card, bucket, list row, or task
6. `DaoDashboard.vue` emits `goto`
7. `DaoIndexPage.vue` switches page and applies filters

This is the same flow intended for the real summary API later, except the summary source will change from mock data to network data.

## Testing Plan

The first implementation pass should verify the following:

1. Environment switching changes the entire dashboard dataset.
2. KPI cards route correctly to downstream pages.
3. Rating distribution buckets route correctly with rating filters.
4. Top table rows route correctly with `tableName`.
5. Recent task rows route correctly to the task page.
6. Light and dark mode remain readable.
7. The page remains fully demonstrable without a backend.

## Future Backend Integration

When the real summary API is available, integration should replace only the summary source and any small transformation logic.

The following should remain stable:

- Page layout
- Child component structure
- Click routing contract
- Environment-driven refresh behavior

The expected future backend responsibility is to return enough aggregate information to populate:

- Headline summary
- KPI row
- Rating distribution
- 7-day trend
- Top risk tables
- Attention items
- Recent tasks

## Implementation Notes

- Keep implementation localized to DAO dashboard files.
- Follow the repo's current CSS-variable based theming.
- Prefer small focused components over enlarging existing dashboard files.
- Do not block mock rendering on backend availability.
- Treat mock data quality as part of the feature because the page must feel realistic during review.

## Open Decisions Resolved In This Spec

- Dashboard orientation: `A 管理总览`
- Interactions: clickable drill-down, not static
- Data source: mock-first
- Charting: no new dependency
- Scope: dashboard only, no backend wiring

## Acceptance Criteria

The first implementation is acceptable when:

- The current empty dashboard is replaced with a usable management dashboard.
- All three environments present distinct mock summary states.
- Users can click summary modules and land in the correct downstream DAO view.
- The page feels visually consistent with the rest of the DAO module.
- The dashboard can be demonstrated end-to-end with no backend running.
