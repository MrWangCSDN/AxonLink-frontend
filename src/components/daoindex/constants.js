/**
 * SQL 巡检模块 —— 常量
 *
 * 所有颜色尽量复用 style.css 里的 CSS 变量，
 * 这样切夜间模式时自动跟随，不用写双份样式。
 */

/** 侧边栏标识色（用在 section 徽章、脉冲点等） */
export const DII_SECTION_ACCENT = '#7950F2'

/** 四个子页的 currentPage key，按钮映射 */
export const DII_PAGES = [
  {
    key: 'dii-dashboard',
    label: '概览仪表盘',
    desc: '总览 · 评级分布',
    color: '#7950F2',
  },
  {
    key: 'dii-sqls',
    label: 'SQL 分析',
    desc: '逐条 SQL 详情',
    color: '#228BE6',
  },
  {
    key: 'dii-tasks',
    label: '巡检任务',
    desc: '批量巡检进度',
    color: '#12B886',
  },
  {
    key: 'dii-table-advice',
    label: '表维度建议',
    desc: 'DBA 聚合视图',
    color: '#F76707',
  },
  {
    key: 'dii-sql-pool',
    label: 'SQL 池',
    desc: 'Excel 导入的外部 SQL 库',
    color: '#0CA678',
  },
]

/** 环境列表（颜色统一为 SG 蓝，符合"灰+蓝"双色基调） */
export const DII_ENVS = [
  { key: 'dev', label: 'DEV', color: '#0b70db' },
  { key: 'sit', label: 'SIT', color: '#0b70db' },
  { key: 'uat', label: 'UAT', color: '#0b70db' },
]

/** 严重度 → 颜色 role */
export const SEVERITY_META = {
  HIGH: { label: 'HIGH', role: 'error' },
  MEDIUM: { label: 'MEDIUM', role: 'running' },
  LOW: { label: 'LOW', role: 'idle' },
}

/** Suggestion scope（TABLE/SQL）的标识；iconKind 由消费方映射到 Lucide 图标 */
export const SCOPE_META = {
  TABLE: { label: '表级',   color: '#7950F2', iconKind: 'table'  },
  SQL:   { label: 'SQL 级', color: '#228BE6', iconKind: 'pencil' },
}
