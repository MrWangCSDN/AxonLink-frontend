# 回放全局流水号排序实施计划

> 使用 superpowers:executing-plans 当前会话执行。

**Goal:** 全局流水号三态服务端排序，空值在两个方向均置后。
**Architecture:** 前端互斥排序状态、列表 JSON 顶层参数、GET 列表/导出参数统一传入 DAO，在分页前排序。
**Tech Stack:** Vue 3 / Vitest / Spring MVC / JDBC / H2。
**Spec:** Obsidian 并行回放问题清单-全局流水号排序-系统设计.md。

## Global Constraints

文本顺序保留标识符，NULL/空字符串/空格置后；稳定分页；既有出现笔数排序和七列折叠功能保持。

## Review Focus

前后端传参、列表与导出一致、排序互斥、筛选分页保留排序、重置清除排序但保留列布局。

## Task 1

- [x] 新增后端集成与前端行为/API测试并验证失败。
- [x] 增加枚举/兼容请求参数，DAO 空值标记+文本方向+稳定次序；列表和导出接入。
- [x] 前端表头图标、三态/互斥/重置/分页传参。
- [x] 后端相关测试、前端全量测试、生产构建及 diff 检查。
- [x] 独立审查并保存验证结果；Obsidian 设计提交并推送。

## 验证记录

- 后端在 Java 17 下运行 ReplayIssueControllerTest、ReplayIssueDaoTest：127 项通过；默认 Java 25 不兼容现有 Mockito，未修改项目依赖。
- 前端全量 npm test -- --exclude '**/.worktrees/**'：29 文件、491 项通过；排除其他工作树的测试副本。
- npm run build 成功，产物更新到后端静态目录。
- 独立只读审查无发现，前后端 git diff --check 通过。
- 实现采用标识符文本比较，空白总是置后；两个排序同时从外部请求传入时流水号优先，界面两项互斥。
- 源码保持未提交，Obsidian 设计、接口/模型及索引单独提交推送。
