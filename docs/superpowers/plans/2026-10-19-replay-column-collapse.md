# 回放问题清单列收起展开实施计划

> 使用 superpowers:executing-plans 在当前会话执行。

**Goal:** 表头切换任务标记至科技负责人七列，默认展开，查询操作保留状态。

**Architecture:** 页面独立布尔状态控制计算可见列，全部表格结构复用可见列集合。

**Tech Stack:** Vue 3、Lucide、Vitest、Vue Test Utils。

**Spec:** /tmp/axon-replay-column-collapse-docs/01 Engineering/axon-link-server/并行回放问题清单-列收起展开-系统设计.md（Obsidian 设计工作树，远端提交后保留在 vault）。

## Global Constraints

- 默认展开，精确隐藏七列，不修改服务端、导出或筛选条件。
- 图标位于始终可见的问题描述表头，动态无障碍标签。
- 分页、每页条数、条件查询、重置不修改展开状态。

## Review Focus

- 收起后展开入口仍存在。
- 表头、正文、colgroup 和状态行 colspan 一致。
- 隐藏字段已有筛选仍生效。
- 空结果和加载过程保持布局状态。
- 默认展开的既有列顺序与宽度保持。

## Task 1: 实现并验证表头切换

**Files:** src/components/replay/ReplayIssuePage.vue、src/components/replay/ReplayIssuePage.spec.js。

**Interfaces:** 现有 API 和筛选处理保持，columns 为计算后的可见列集合。

- [x] 添加行为测试：默认列、七列切换、展开与收起分别经分页/每页条数/条件查询/重置后保持、空列表 colspan。
- [x] 运行新增测试，确认缺少切换按钮导致失败。
- [x] 独立 ref 保存展开状态，列定义和范围计算可见列；表头加入图标与动态可访问属性，沿用表头按钮样式。
- [x] 运行 ReplayIssuePage 测试、完整 npm test -- --exclude '**/.worktrees/**' 和 npm run build，检查 git diff --check。
- [x] 检查 diff 与需求，记录结果；源码留在当前工作区供用户审阅。

## 执行结果

- 新增行为测试先因切换入口缺失失败，再随实现通过；分页接口按实际 limit/offset 断言。
- 当前页面：133 项通过；当前源码全量：29 文件、489 项通过。
- 排除仓库内旧 `.worktrees` 测试副本，避免 Vitest 把其他工作树版本与当前版本混跑。
- 生产构建成功，静态产物更新到后端 src/main/resources/static。
- Obsidian 设计及索引已通过隔离工作树提交并推送 origin/main，提交 6d6214c；原 vault 未提交内容保持原样。
- 源码与测试留在当前前端工作区，未提交。

## 用户确认的视觉增强

方案：七列表头 2px 红线标范围，问题描述表头显示“‹ 收起7列 / 展开7列 ›”；收起后操作列表头及正文左边界显示 2px 红色竖线；悬停提示七个字段，不加占位列。

- [x] 修改既有行为断言，验证文字切换及字段提示。
- [x] 更新表头/正文范围样式与按钮，不修改独立展开状态及排序逻辑。
- [x] 页面测试、生产构建和浏览器视觉检查。
- [x] 同步 Obsidian 唯一设计与索引并提交推送。

### 视觉增强验证结果

- 既有切换行为测试先验证缺少文字而失败，再随实现通过；页面 134 项、前端全量 491 项通过。
- 浏览器确认七列表头红线、文字按钮及收起后的红色竖线，重置筛选仍保持收起。截图 /tmp/replay-column-range-expanded.png、/tmp/replay-column-range-collapsed.png；本地后端未启动，截图检查表头样式，数据行由既有组件测试覆盖。
- 独立只读复核无发现，git diff --check 通过，生产构建已输出到后端静态目录。
- 更新源码包 axon-link-server-source-20261019-red-column-indicators-111144.zip，并核对包内静态文件与最新构建一致。
- Obsidian 设计更新提交 a801e80，原 vault 未提交改动未操作。
