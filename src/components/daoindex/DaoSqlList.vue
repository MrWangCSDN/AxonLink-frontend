<template>
  <div class="dii-page">
    <!-- ════════════ 顶部 Hero：标题 + KPI tiles + 操作 ════════════ -->
    <header class="hero">
      <div class="hero-bar">
        <div class="hero-meta">
          <!-- 第 1 行：面包屑 + 任务编号 pill 同行 -->
          <div class="crumb-row">
            <div class="crumb">
              <span class="crumb-home">SQL 巡检</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-current">SQL 分析</span>
            </div>
            <div v-if="latestTask" class="hero-task">
              <span class="task-pill" :class="`status-${String(latestTask.status||'').toLowerCase()}`">
                <span class="task-dot"></span>
                {{ statusLabel(latestTask.status) }}
              </span>
              <span class="task-no-label">任务编号：</span>
              <code class="task-no">{{ latestTask.task_no }}</code>
            </div>
          </div>

          <!-- 当前查看任务回退条：从巡检任务页 [查看 SQL 列表] 跳过来时显示 -->
          <div v-if="filter?.taskId" class="dii-task-banner">
            <span class="dii-task-banner-text">
              当前查看任务 #{{ filter.taskId }}
              <span v-if="filter.taskNo" class="dii-task-banner-no">· {{ filter.taskNo }}</span>
            </span>
            <button class="dii-task-banner-back" @click="emit('back-to-tasks')">
              ← 返回任务列表
            </button>
          </div>

          <!-- V16：我的待审过滤 banner——从右上角铃铛跳来时显示，提示用户当前在"待办视图" -->
          <div v-if="filter?.myWhitelistTodo" class="dii-todo-banner">
            <span class="dii-todo-banner-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right:6px;vertical-align:-2px;">
                <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2v1h16v-1l-2-2z M10 21a2 2 0 0 0 4 0"
                      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              我的待审批 · 共 <strong>{{ filteredItems.length }}</strong> 条
            </span>
            <button class="dii-todo-banner-clear" @click="emit('clear-todo-filter')">清除过滤</button>
          </div>

          <!-- 第 2 行：搜索框 + 领域过滤 + 筛选汇总 -->
          <div class="hero-task-row">
            <!-- 搜索框：与任务编号同行 -->
            <div class="search hero-search">
              <svg class="search-ico" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <input
                class="search-input"
                v-model="filters.keyword"
                placeholder="按 SQL 内容 / 表名 / 类名 / 方法名 搜索…"
                @keyup.enter="doSearch"
              />
              <span v-if="filters.keyword" class="search-clear" @click="filters.keyword = ''">✕</span>
            </div>

            <!-- 领域过滤：紧跟搜索框后 -->
            <div class="seg hero-seg">
              <button
                v-for="d in DAO_DOMAIN_OPTIONS"
                :key="d.key"
                class="seg-btn"
                :class="{ active: filters.domain === d.key }"
                @click="toggleDomain(d.key)"
              >
                <span class="seg-dot" :class="`d-${d.key}`"></span>{{ d.label }}
              </button>
              <button
                class="seg-btn seg-clear"
                :class="{ disabled: !hasActiveFilter }"
                :disabled="!hasActiveFilter"
                @click="clearFilters"
              >清空</button>
            </div>

            <!-- 筛选汇总（仅有筛选时显示） -->
            <span v-if="hasActiveFilter" class="hero-filter-summary">
              筛选后 <strong>{{ total }}</strong> / 全部 <strong>{{ serverTotal }}</strong>
            </span>
            <!-- 加载进度（边拉边显示） -->
            <span v-if="loading && loadedCount > 0" class="hero-loading-progress">
              <span class="lp-spinner"></span>
              已加载 {{ loadedCount }}{{ serverTotal > 0 ? ` / ${serverTotal}` : '' }}
            </span>
          </div>
        </div>

        <div class="hero-actions">
          <DiiEnvSwitcher :model-value="env" @update:model-value="onEnvChange" />
          <button class="btn btn-secondary" :disabled="loading" @click="doReload">
            <svg class="btn-ico" :class="{ 'is-spin': loading }" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7a5 5 0 1 1-1.46-3.54M12 2.5V6h-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ loading ? '加载中' : '刷新' }}
          </button>
          <!-- V16+：导入 Excel/CSV（原 SQL 池独立页下线后入口移到这里） -->
          <button class="btn btn-secondary" @click="importOpen = true" title="导入 IndexWarnLog 日志（.xlsx 或 .csv）到 SQL 池">
            <svg class="btn-ico" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12.5v-8m0 0L4 7.5m3-3l3 3M2.5 2v1.5h9V2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            导入 Excel/CSV
          </button>
          <button class="btn btn-primary" :disabled="exporting || !latestTask || total === 0" :title="exportTitle" @click="doExport">
            <svg class="btn-ico" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v8m0 0L4 6.5m3 3l3-3M2.5 11v1.5h9V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ exporting ? '导出中…' : '导出 Excel' }}
          </button>
        </div>
      </div>

      <!-- KPI 卡片条 -->
      <div class="kpi-row">
        <div class="kpi" :class="{ active: !filters.issueSource }" @click="setIssueSource('')">
          <div class="kpi-ico kpi-ico-total"><ListTodo :size="18" :stroke-width="2" /></div>
          <div class="kpi-body">
            <div class="kpi-num">{{ kpis.total }}</div>
            <div class="kpi-lbl">SQL 问题总数</div>
          </div>
        </div>
        <div class="kpi kpi-danger" :class="{ active: filters.issueSource === 'EXPLAIN_ERROR' }" @click="setIssueSource('EXPLAIN_ERROR')">
          <div class="kpi-ico"><DatabaseZap :size="18" :stroke-width="2" /></div>
          <div class="kpi-body">
            <div class="kpi-num">{{ kpis.explainError }}</div>
            <div class="kpi-lbl">数据库报错</div>
          </div>
        </div>
        <div class="kpi kpi-warn" :class="{ active: filters.issueSource === 'LLM_FINDINGS' }" @click="setIssueSource('LLM_FINDINGS')">
          <div class="kpi-ico"><Sparkles :size="18" :stroke-width="2" /></div>
          <div class="kpi-body">
            <div class="kpi-num">{{ kpis.findings }}</div>
            <div class="kpi-lbl">AI 分析完成</div>
          </div>
        </div>
        <div class="kpi kpi-muted" :class="{ active: filters.issueSource === 'LLM_ERROR' }" @click="setIssueSource('LLM_ERROR')">
          <div class="kpi-ico"><BotOff :size="18" :stroke-width="2" /></div>
          <div class="kpi-body">
            <div class="kpi-num">{{ kpis.llmError }}</div>
            <div class="kpi-lbl">AI 分析失败</div>
          </div>
        </div>
      </div>

    </header>

    <!-- ════════════ 列表区 ════════════ -->
    <div class="list-scroll">
      <div v-if="loadError" class="state-block state-error">
        <div class="state-ico"><AlertTriangle :size="22" :stroke-width="2" /></div>
        <div class="state-title">加载失败</div>
        <div class="state-desc">{{ loadError }}</div>
        <button class="btn btn-secondary" @click="doReload">重试</button>
      </div>

      <div v-else-if="!loading && !latestTask" class="state-block">
        <DiiEmptyState
          title="当前环境下还没有巡检任务"
          :desc="`环境 ${env.toUpperCase()} 的 dii_analysis_task 表为空，请先在『巡检任务』页触发一次批量分析`"
        />
      </div>

      <div v-else>
        <DiiEmptyState
          v-if="!loading && pageItems.length === 0"
          :title="hasActiveFilter ? '没有匹配的 SQL' : '当前任务没有「有问题」的 SQL'"
          :desc="hasActiveFilter ? '试试清空筛选条件' : '当前任务下没有报错或待整改的 SQL（或仍在 AI 分析中）'"
        />

        <ol v-else class="rows">
          <li
            v-for="it in pageItems"
            :key="it.id"
            :data-row-id="it.id"
            class="row"
            :class="[
              `sev-${rowSeverity(it)}`,
              { 'is-expanded': expandedIds.has(it.id) },
              { 'is-ai-running': isRowRunning(it.id) },
            ]"
            @click="toggleExpand(it.id)"
          >
            <!-- AI 重跑中蒙版：半透磨砂底 + 中间 AI 等待动画药丸 -->
            <div v-if="isRowRunning(it.id)" class="row-ai-mask" @click.stop>
              <div class="row-ai-pill">
                <span class="ai-sparkle-wrap" aria-hidden="true">
                  <Sparkles :size="16" :stroke-width="2" class="ai-sparkle-ico" />
                  <span class="ai-sparkle-halo"></span>
                </span>
                <span class="ai-shimmer-text">AI 分析中</span>
                <span class="ai-dots" aria-hidden="true">
                  <span class="ai-dot"></span>
                  <span class="ai-dot"></span>
                  <span class="ai-dot"></span>
                </span>
              </div>
            </div>

            <!-- 左：彩色严重度条 -->
            <div class="row-stripe"></div>

            <!-- 主体 -->
            <div class="row-main">
              <!-- 第 1 行：标识区 -->
              <div class="row-head">
                <span class="kind" :class="`k-${(it.sql_kind||'other').toLowerCase()}`">
                  {{ it.sql_kind || 'SQL' }}
                </span>

                <!-- V14：SQL 来源标签
                     odb  = 源代码扫描（来自 dii_analysis_item，原本就在的 SQL）
                     nsql = Excel 导入的 namedsql 警告日志（来自 dii_sql_pool）
                     title 给鼠标悬停展示中文释义 -->
                <span
                  class="source-tag"
                  :class="`source-${(it.source||'odb').toLowerCase()}`"
                  :title="(it.source==='nsql') ? '来源：导入的 namedsql 警告日志' : '来源：源码扫描（odb）'"
                >
                  {{ (it.source || 'odb').toLowerCase() }}
                </span>

                <!-- V16+：nsql 行紧接 source tag 后展示完整 named_sql（全量、不截断、长则自动换行）
                     pool DAO 把 named_sql 放进了 class_fqn 字段（兼容 odb 列名）；同时多带原始 named_sql 字段 -->
                <code
                  v-if="it.source === 'nsql' && (it.named_sql || it.class_fqn)"
                  class="named-sql-full"
                  :title="it.named_sql || it.class_fqn"
                >{{ it.named_sql || it.class_fqn }}</code>

                <span class="table-chain" :title="(tableListOf(it) || []).join(', ')">
                  <span class="table-name">{{ tableListOf(it)[0] || '—' }}</span>
                  <span v-if="tableListOf(it).length > 1" class="table-more">
                    +{{ tableListOf(it).length - 1 }}
                  </span>
                </span>

                <span class="sep">·</span>

                <span class="domain" :class="`dom-${domainOf(it).key}`">
                  <span class="domain-dot"></span>{{ domainOf(it).label }}
                </span>

                <span class="row-grow"></span>
              </div>

              <!-- ① 块：SQL 语句（展开时显示编号标题） -->
              <div v-if="expandedIds.has(it.id)" class="block-h">
                <span class="block-no">①</span>
                <span class="block-title">SQL 语句</span>
              </div>
              <div class="code-block" :class="{ collapsed: !expandedIds.has(it.id) }">
                <pre class="row-sql" :class="{ collapsed: !expandedIds.has(it.id) }" v-html="highlightSql(it.sql_text || '—')"></pre>
                <button
                  v-if="expandedIds.has(it.id)"
                  class="code-copy-btn"
                  :title="copiedKey === `sql-${it.id}` ? '已复制' : '复制 SQL'"
                  @click.stop="copyText(it.sql_text || '', `sql-${it.id}`)"
                >
                  <Check v-if="copiedKey === `sql-${it.id}`" :size="13" :stroke-width="2.5" />
                  <Copy v-else :size="13" :stroke-width="2" />
                </button>
              </div>

              <!-- 第 3 行：问题摘要（折叠态显示一行；展开后显示完整 callout） -->
              <div v-if="!expandedIds.has(it.id)" class="row-summary">
                <span v-if="issueOf(it).source === 'EXPLAIN_ERROR'" class="sum sum-danger">
                  <span class="sum-ico"><OctagonAlert :size="13" :stroke-width="2" /></span>
                  <span class="sum-text">{{ issueOf(it).message }}</span>
                </span>
                <span v-else-if="issueOf(it).source === 'LLM_FINDINGS' && issueOf(it).count > 0" class="sum sum-warn">
                  <span class="sum-ico"><Search :size="13" :stroke-width="2" /></span>
                  <span class="sum-text">
                    <b>{{ issueOf(it).count }}</b> 处问题：
                    <span v-for="(f, i) in issueOf(it).findings.slice(0, 2)" :key="i" class="sum-finding">
                      <span class="sev-tag" :class="sevClass(f.severity)">{{ f.severity || 'LOW' }}</span>
                      {{ f.description || f.type || '—' }}
                      <span v-if="i < Math.min(issueOf(it).count, 2) - 1" class="sum-divider">·</span>
                    </span>
                    <span v-if="issueOf(it).count > 2" class="sum-more"> …还有 {{ issueOf(it).count - 2 }} 条</span>
                  </span>
                </span>
                <span v-else-if="issueOf(it).source === 'LLM_PENDING'" class="sum sum-info">
                  <span class="sum-ico"><Loader2 :size="13" :stroke-width="2" class="is-spin" /></span>
                  <span class="sum-text">AI 正在分析，请稍候…</span>
                </span>
                <span v-else-if="issueOf(it).source === 'LLM_ERROR'" class="sum sum-muted">
                  <span class="sum-ico"><AlertTriangle :size="13" :stroke-width="2" /></span>
                  <span class="sum-text">AI 分析失败：{{ issueOf(it).message }}</span>
                </span>
              </div>

              <!-- 展开态：② 执行结果 / AI 分析 + ③ AI 建议 -->
              <div v-else class="row-detail" @click.stop>
                <!-- DB 报错：独立块（与 AI 大框分离） -->
                <template v-if="issueOf(it).source === 'EXPLAIN_ERROR'">
                  <div>
                    <div class="block-h">
                      <span class="block-no block-no-danger">②</span>
                      <span class="block-title">执行结果</span>
                    </div>
                    <div class="code-block">
                      <pre class="callout-b">{{ issueOf(it).message }}</pre>
                      <button
                        class="code-copy-btn"
                        :title="copiedKey === `err-${it.id}` ? '已复制' : '复制错误信息'"
                        @click.stop="copyText(issueOf(it).message || '', `err-${it.id}`)"
                      >
                        <Check v-if="copiedKey === `err-${it.id}`" :size="13" :stroke-width="2.5" />
                        <Copy v-else :size="13" :stroke-width="2" />
                      </button>
                    </div>
                  </div>
                  <div class="row-detail-actions">
                    <button
                      class="btn btn-primary btn-ai-lead"
                      :disabled="isRowRunning(it.id)"
                      @click.stop="rerunLlm(it.id)"
                    >
                      <Loader2 v-if="isRowRunning(it.id)" :size="14" :stroke-width="2" class="btn-ico is-spin" />
                      <AiBrandIcon v-else class="btn-ai-lead-ico" />
                      <span class="btn-ai-lead-label">{{ isRowRunning(it.id) ? '分析中…' : '重新分析' }}</span>
                    </button>
                    <!-- V16：白名单申请按钮 -->
                    <button
                      class="btn btn-wl"
                      :class="wlButtonClass(it)"
                      @click.stop="openWhitelistDialog(it)"
                    >{{ wlButtonText(it) }}</button>
                  </div>
                </template>

                <!-- AI 相关三种情况 + AI 建议 + 重新分析按钮，全部包在大框内 -->
                <div v-else class="ai-block">

                <div v-if="issueOf(it).source === 'LLM_FINDINGS' && issueOf(it).count > 0">
                  <div class="block-h">
                    <span class="block-no block-no-warn">②</span>
                    <span class="block-title">AI 分析</span>
                    <!-- AI 元信息条：靠右与标题同行 -->
                    <div class="ai-meta ai-meta-inline">
                      <span v-if="it.llm_model" class="ai-meta-item">
                        <Bot :size="11" :stroke-width="2" />
                        <code>{{ it.llm_model }}</code>
                      </span>
                      <span v-if="it.llm_elapsed_ms != null" class="ai-meta-item" title="LLM 分析耗时">
                        <Clock :size="11" :stroke-width="2" />
                        {{ formatElapsedShort(it.llm_elapsed_ms) }}
                      </span>
                      <span v-if="it.llm_confidence" class="ai-meta-item ai-meta-conf" :class="confLevelClass(it.llm_confidence)" title="AI 置信度">
                        <Gauge :size="11" :stroke-width="2" />
                        置信度{{ confLabel(it.llm_confidence) }}
                      </span>
                      <span v-if="it.llm_called_at" class="ai-meta-item ai-meta-time" title="LLM 分析时间">
                        <CalendarClock :size="11" :stroke-width="2" />
                        {{ it.llm_called_at }}
                      </span>
                    </div>
                  </div>

                  <!-- 一句话总结 -->
                  <div v-if="it.llm_summary" class="ai-summary">
                    <span class="ai-summary-label">一句话总结</span>
                    <span class="ai-summary-text">{{ it.llm_summary }}</span>
                  </div>

                  <div class="findings-card">
                    <div v-for="(f, i) in issueOf(it).findings" :key="i" class="finding">
                      <span class="sev-tag" :class="sevClass(f.severity)">{{ f.severity || 'LOW' }}</span>
                      <div class="finding-body">
                        <div class="finding-type">{{ f.type || '—' }}</div>
                        <div class="finding-desc">{{ f.description || '—' }}</div>
                        <div v-if="f.evidence" class="finding-evidence">{{ f.evidence }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else-if="issueOf(it).source === 'LLM_PENDING'">
                  <div class="block-h">
                    <span class="block-no block-no-info">②</span>
                    <span class="block-title">AI 分析</span>
                  </div>
                  <div class="ai-pending-block">
                    <Loader2 :size="16" :stroke-width="2" class="ai-pending-spin" />
                    <span class="ai-pending-text">AI 正在分析，请稍候…</span>
                  </div>
                </div>

                <div v-else-if="issueOf(it).source === 'LLM_ERROR'">
                  <div class="block-h">
                    <span class="block-no block-no-muted">②</span>
                    <span class="block-title">AI 分析</span>
                  </div>
                  <div class="code-block">
                    <pre class="callout-b">{{ issueOf(it).message }}</pre>
                    <button
                      class="code-copy-btn"
                      :title="copiedKey === `aierr-${it.id}` ? '已复制' : '复制错误信息'"
                      @click.stop="copyText(issueOf(it).message || '', `aierr-${it.id}`)"
                    >
                      <Check v-if="copiedKey === `aierr-${it.id}`" :size="13" :stroke-width="2.5" />
                      <Copy v-else :size="13" :stroke-width="2" />
                    </button>
                  </div>
                </div>

                <!-- ③ 块：AI 建议（仅在 LLM 成功且有 suggestions 时） -->
                <div v-if="suggestionOf(it).source === 'LLM_SUGGESTIONS' && suggestionOf(it).count > 0">
                  <div class="block-h">
                    <span class="block-no block-no-info">③</span>
                    <span class="block-title">AI 建议</span>
                  </div>
                  <div class="sugs-list">
                    <div v-for="(s, i) in suggestionOf(it).suggestions" :key="i" class="sug-card">
                      <div class="sug-card-h">
                        <span class="scope-tag" :class="`scope-${(s.scope||'SQL').toLowerCase()}`">
                          {{ s.scope === 'TABLE' ? '表级' : 'SQL 级' }}
                        </span>
                        <code class="sug-type">{{ s.type || 'OPTIMIZE' }}</code>
                        <span v-if="s.priority != null" class="sug-priority">P{{ s.priority }}</span>
                      </div>
                      <div v-if="s.reason" class="sug-reason">{{ s.reason }}</div>
                      <div v-if="s.ddl" class="code-block">
                        <pre class="sug-code" v-html="highlightSql(s.ddl)"></pre>
                        <button
                          class="code-copy-btn"
                          :title="copiedKey === `ddl-${it.id}-${i}` ? '已复制' : '复制 DDL'"
                          @click.stop="copyText(s.ddl, `ddl-${it.id}-${i}`)"
                        >
                          <Check v-if="copiedKey === `ddl-${it.id}-${i}`" :size="13" :stroke-width="2.5" />
                          <Copy v-else :size="13" :stroke-width="2" />
                        </button>
                      </div>
                      <div v-if="s.newSql" class="code-block">
                        <pre class="sug-code" v-html="highlightSql(s.newSql)"></pre>
                        <button
                          class="code-copy-btn"
                          :title="copiedKey === `newsql-${it.id}-${i}` ? '已复制' : '复制建议 SQL'"
                          @click.stop="copyText(s.newSql, `newsql-${it.id}-${i}`)"
                        >
                          <Check v-if="copiedKey === `newsql-${it.id}-${i}`" :size="13" :stroke-width="2.5" />
                          <Copy v-else :size="13" :stroke-width="2" />
                        </button>
                      </div>
                      <div v-if="s.riskWarning" class="sug-risk">
                        <AlertTriangle :size="12" :stroke-width="2" /> {{ s.riskWarning }}
                      </div>
                    </div>
                  </div>
                </div>

                <div class="row-detail-actions">
                  <button
                    class="btn btn-primary btn-ai-lead"
                    :disabled="isRowRunning(it.id)"
                    @click.stop="rerunLlm(it.id)"
                  >
                    <Loader2 v-if="isRowRunning(it.id)" :size="14" :stroke-width="2" class="btn-ico is-spin" />
                    <AiBrandIcon v-else class="btn-ai-lead-ico" />
                    <span class="btn-ai-lead-label">{{ isRowRunning(it.id) ? '分析中…' : '重新分析' }}</span>
                  </button>
                  <!-- V16：白名单申请按钮 -->
                  <button
                    class="btn btn-wl"
                    :class="wlButtonClass(it)"
                    @click.stop="openWhitelistDialog(it)"
                  >{{ wlButtonText(it) }}</button>
                </div>
                </div><!-- /.ai-block -->
              </div>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="loading && loadedCount === 0" class="state-block">
        <span class="lp-spinner big"></span>
        <div class="state-desc">加载中…</div>
      </div>
    </div>

    <!-- 分页器：固定在 dii-page 底部，不随列表滚动 -->
    <div v-if="total > 0 && !loadError" class="pager pager-fixed">
      <div class="pager-l">
        <span>共 <strong>{{ total }}</strong> 条</span>
        <span class="pager-sep">·</span>
        <label class="pager-lbl">每页</label>
        <select class="select-sm" :value="pageSize" @change="onPageSizeChange">
          <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <div class="pager-r">
        <button class="btn btn-icon" :disabled="page <= 1 || loading" @click="gotoPage(1)">«</button>
        <button class="btn btn-icon" :disabled="page <= 1 || loading" @click="gotoPage(page - 1)">‹</button>
        <span class="pager-info">第 <strong>{{ page }}</strong> / {{ pageCount }} 页</span>
        <button class="btn btn-icon" :disabled="page >= pageCount || loading" @click="gotoPage(page + 1)">›</button>
        <button class="btn btn-icon" :disabled="page >= pageCount || loading" @click="gotoPage(pageCount)">»</button>
        <input
          class="input-xs"
          type="number"
          min="1"
          :max="pageCount"
          v-model.number="jumpInput"
          @keyup.enter="doJump"
        />
        <button class="btn btn-secondary btn-sm" @click="doJump">Go</button>
      </div>
    </div>

    <!-- ════════════ V16：白名单审批弹窗（统一组件，按 mode 切换） ════════════ -->
    <DiiWhitelistDialog
      v-model:open="wlDlg.open"
      :mode="wlDlg.mode"
      :row="wlDlg.row"
      :application="wlDlg.application"
      :current-user="currentUser"
      @action-done="onWlActionDone"
    />

    <!-- ════════════ V16+：SQL 池 Excel/CSV 导入弹窗（原独立页下线后挂这里） ════════════ -->
    <DiiSqlPoolImportModal
      v-model:open="importOpen"
      :default-env="env"
      @imported="onPoolImported"
    />

    <!-- ════════════ 重新执行 AI 分析 · 模态框 ════════════ -->
    <transition name="rerun-modal">
      <div v-if="aiRerun.open" class="rerun-mask" @click.self="closeRerunModal">
        <div class="rerun-card" role="dialog" aria-modal="true">
          <header class="rerun-card-h">
            <AiBrandIcon :size="20" />
            <span class="rerun-card-title">AI 分析</span>
            <button class="rerun-close" title="关闭" @click="closeRerunModal">
              <X :size="16" :stroke-width="2" />
            </button>
          </header>

          <div class="rerun-card-b">
            <label class="rerun-field-label">
              SQL 语句
              <span class="rerun-field-hint">（可编辑——若你刚改过 SQL，可在此预览修改后的分析结果）</span>
            </label>
            <textarea
              v-model="aiRerun.sql"
              class="rerun-sql"
              spellcheck="false"
              rows="12"
              placeholder="粘贴或修改 SQL 后再触发 AI 分析"
            ></textarea>
          </div>

          <footer class="rerun-card-f">
            <div class="rerun-model">
              <label class="rerun-model-label" for="rerun-model-select">模型</label>
              <div class="rerun-select-wrap">
                <select
                  id="rerun-model-select"
                  v-model="aiRerun.model"
                  class="rerun-select"
                >
                  <option v-for="m in AI_MODELS" :key="m.key" :value="m.key">{{ m.label }}</option>
                </select>
                <ChevronDown :size="14" :stroke-width="2" class="rerun-select-chev" />
              </div>
            </div>
            <div class="rerun-actions">
              <button class="btn btn-secondary" @click="closeRerunModal">取消</button>
              <button class="btn btn-primary" :disabled="!aiRerun.sql.trim()" @click="submitRerun">
                <Bot :size="14" :stroke-width="2" class="btn-ico" />
                确认
              </button>
            </div>
          </footer>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  Sigma,
  OctagonAlert,
  Search,
  AlertTriangle,
  Lightbulb,
  Copy,
  Check,
  Bot,
  Clock,
  Gauge,
  CalendarClock,
  ListTodo,
  DatabaseZap,
  Sparkles,
  BotOff,
  RefreshCw,
  Loader2,
  X,
  ChevronDown,
  WandSparkles,
} from 'lucide-vue-next'
import DiiEnvSwitcher from './widgets/DiiEnvSwitcher.vue'
import DiiEmptyState from './widgets/DiiEmptyState.vue'
import AiBrandIcon from './widgets/AiBrandIcon.vue'
import DiiWhitelistDialog from './widgets/DiiWhitelistDialog.vue'
import DiiSqlPoolImportModal from './widgets/DiiSqlPoolImportModal.vue'
import {
  listDiiItemIssues,
  getDiiItemIssuesStats,
  getLatestDiiTask,
  runDiiLlmAnalyze,
  runDiiLlmAnalyzeAsync,
  getDiiItem,
  exportDiiItemIssues,
  getWhitelistApplication,
} from '../../api/daoIndex.js'
import {
  splitTables,
  resolveDomain,
  resolveIssueCell,
  resolveSuggestionCell,
  DAO_DOMAIN_OPTIONS,
} from '../../utils/daoIndex.js'

const props = defineProps({
  env: { type: String, default: 'uat' },
  filter: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:env', 'back-to-tasks', 'clear-todo-filter'])

/* ────────── 静态字典 ────────── */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DOMAIN_ORDER = Object.fromEntries(DAO_DOMAIN_OPTIONS.map((d, i) => [d.key, i]))

/* ────────── 响应式状态 ────────── */
const filters = ref({ domain: '', issueSource: '', keyword: '' })
const latestTask = ref(null)
const rawItems = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const jumpInput = ref(1)
const loading = ref(false)
const loadError = ref('')
// runningId 已被 aiRunningIds 替代（支持多行同时运行）
const exporting = ref(false)
const serverTotal = ref(0)
const loadedCount = ref(0)
const expandedIds = ref(new Set())

/** 当前刚刚被复制的代码块 key（用于"✓ 已复制"反馈），1.5 秒后清空 */
const copiedKey = ref(null)
let copyResetTimer = null

/* ───────── SQL 语法高亮（轻量 tokenizer，无依赖） ─────────
   一次扫描，按优先级匹配：注释 / 字符串 / 数字 / 标识符 / 占位符 ?
   匹配命中后区分 SQL 关键字 vs 内置函数；剩余文本直接 HTML 转义。
   颜色由 CSS 控制，light/dark 主题各一套。 */
const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','LIKE','BETWEEN','EXISTS','IS','NULL','AS','ON',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','INDEX','UNIQUE','DROP','ALTER','ADD',
  'JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','UNION','DISTINCT','ALL',
  'GROUP','BY','ORDER','ASC','DESC','LIMIT','OFFSET','HAVING',
  'CASE','WHEN','THEN','ELSE','END','IF','TRUE','FALSE',
  'PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','AUTO_INCREMENT',
  'VARCHAR','INT','BIGINT','DECIMAL','TEXT','DATE','DATETIME','TIMESTAMP',
  'BEGIN','COMMIT','ROLLBACK','TRANSACTION','START','SAVEPOINT','INTERVAL', 'DAY','MONTH','YEAR','HOUR',
])
const SQL_FUNCS = new Set([
  'NOW','COUNT','SUM','AVG','MIN','MAX','DATE_SUB','DATE_ADD',
  'CONCAT','SUBSTRING','LENGTH','TRIM','UPPER','LOWER',
  'COALESCE','IFNULL','CAST','CONVERT','ROUND','ABS',
])

function escapeHtml(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function highlightSql(text) {
  if (!text) return ''
  // 优先级：注释 > 字符串 > 数字 > 标识符 > 占位符
  const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|(\?)/g
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index))
    const [full, comment, str, num, ident, ph] = m
    if (comment) {
      out += `<span class="sql-comment">${escapeHtml(comment)}</span>`
    } else if (str) {
      out += `<span class="sql-str">${escapeHtml(str)}</span>`
    } else if (num) {
      out += `<span class="sql-num">${escapeHtml(num)}</span>`
    } else if (ident) {
      const upper = ident.toUpperCase()
      if (SQL_KEYWORDS.has(upper)) {
        out += `<span class="sql-kw">${escapeHtml(ident)}</span>`
      } else if (SQL_FUNCS.has(upper)) {
        out += `<span class="sql-fn">${escapeHtml(ident)}</span>`
      } else {
        out += escapeHtml(ident)
      }
    } else if (ph) {
      out += `<span class="sql-placeholder">?</span>`
    }
    last = m.index + full.length
  }
  out += escapeHtml(text.slice(last))
  return out
}

async function copyText(text, key) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // navigator.clipboard 在非 https 环境会抛错；fallback 到旧 API
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
  }
  copiedKey.value = key
  if (copyResetTimer) clearTimeout(copyResetTimer)
  copyResetTimer = setTimeout(() => { copiedKey.value = null }, 1500)
}

const hasActiveFilter = computed(
  () => !!(filters.value.domain || filters.value.issueSource || filters.value.keyword.trim()),
)

const exportTitle = computed(() => {
  if (!latestTask.value) return '当前环境没有任务，无法导出'
  if (total.value === 0) return '当前任务没有"有问题"的 SQL，无可导出内容'
  if (exporting.value) return '正在生成 Excel，请稍候…'
  return `导出当前任务（${latestTask.value.task_no}）下全部"有问题"的 SQL 为 Excel`
})

/**
 * 4 个 KPI：直接来自后端 /stats 端点（一次 SQL 出结果），不再本地 group。
 * 字段：{ total, explainError, llmFindings, llmError }
 * 模板里用的是 `kpis.findings`，为兼容保留同名（getter 形式见下方）
 */
const kpisRaw = ref({ total: 0, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 })
const kpis = computed(() => ({
  total: kpisRaw.value.total || 0,
  explainError: kpisRaw.value.explainError || 0,
  findings: kpisRaw.value.llmFindings || 0,   // 模板字段名兼容
  llmError: kpisRaw.value.llmError || 0,
}))

function toggleExpand(id) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

const filteredItems = computed(() => {
  const kw = filters.value.keyword.trim().toLowerCase()
  const domainKey = filters.value.domain
  const issueKey = filters.value.issueSource
  // V16：父级 filter.myWhitelistTodo=true 时只展示「待审批中」的 SQL
  //   （PENDING_L1 / PENDING_L2）。终态 / REJECTED_L1 / CANCELLED 都排除
  const myWlTodo = !!props.filter?.myWhitelistTodo
  const hit = rawItems.value.filter((it) => {
    if (myWlTodo) {
      const s = it.whitelist_status
      if (s !== 'PENDING_L1' && s !== 'PENDING_L2') return false
    }
    if (domainKey && domainOf(it).key !== domainKey) return false
    if (issueKey && issueOf(it).source !== issueKey) return false
    if (kw) {
      const hay = [it.sql_text, it.involved_tables, it.class_fqn, it.method_name, it.project_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
  return hit.slice().sort((a, b) => {
    // 报错类置顶，再按领域、再按 id
    const sevOrder = { EXPLAIN_ERROR: 0, LLM_FINDINGS: 1, LLM_ERROR: 2, NONE: 3 }
    const sa = sevOrder[issueOf(a).source] ?? 9
    const sb = sevOrder[issueOf(b).source] ?? 9
    if (sa !== sb) return sa - sb
    const da = DOMAIN_ORDER[domainOf(a).key] ?? 99
    const db = DOMAIN_ORDER[domainOf(b).key] ?? 99
    if (da !== db) return da - db
    return (b.id || 0) - (a.id || 0)
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)))
const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredItems.value.slice(start, start + pageSize.value)
})

watch(filteredItems, (list) => {
  total.value = list.length
  const pc = Math.max(1, Math.ceil(list.length / pageSize.value))
  if (page.value > pc) {
    page.value = pc
    jumpInput.value = pc
  }
})

/* ────────── 单行衍生字段 ────────── */
function domainOf(row) { return resolveDomain(row.project_name) }
function issueOf(row) { return resolveIssueCell(row) }
function suggestionOf(row) { return resolveSuggestionCell(row) }
function tableListOf(row) { return splitTables(row.involved_tables || '') }
function sevClass(sev) {
  const s = String(sev || '').toUpperCase()
  if (s === 'HIGH') return 'sev-high'
  if (s === 'MEDIUM') return 'sev-medium'
  return 'sev-low'
}

/** LLM 置信度：真实后端是 HIGH/MEDIUM/LOW 三档字符串，展示为中文「高/中/低」 */
function confLabel(raw) {
  const k = String(raw || '').toUpperCase()
  if (k === 'HIGH')   return '高'
  if (k === 'MEDIUM') return '中'
  if (k === 'LOW')    return '低'
  // 兼容兜底：万一拿到旧 mock 的数值，也展示个像样的
  if (raw == null || raw === '') return '—'
  return String(raw)
}
/** 给置信度档位映射 CSS class（用于上色：高=绿、中=黄、低=红） */
function confLevelClass(raw) {
  const k = String(raw || '').toUpperCase()
  if (k === 'HIGH')   return 'is-strong'
  if (k === 'MEDIUM') return 'is-medium'
  if (k === 'LOW')    return 'is-weak'
  return ''
}
/** 把毫秒数格式化为简短可读：23ms / 1.2s / 12.4s / 2m18s */
function formatElapsedShort(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return '—'
  if (n < 1000) return `${Math.round(n)}ms`
  const s = n / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s - m * 60)
  return `${m}m${rem}s`
}
function rowSeverity(row) {
  const s = issueOf(row).source
  if (s === 'EXPLAIN_ERROR') return 'danger'
  if (s === 'LLM_ERROR')   return 'muted'
  if (s === 'LLM_PENDING') return 'info'
  if (s === 'LLM_FINDINGS') {
    const findings = issueOf(row).findings || []
    if (findings.some(f => String(f.severity || '').toUpperCase() === 'HIGH')) return 'danger'
    if (findings.some(f => String(f.severity || '').toUpperCase() === 'MEDIUM')) return 'warn'
    return 'low'
  }
  return 'low'
}
function rowBadge(row) {
  const s = issueOf(row).source
  if (s === 'EXPLAIN_ERROR') return { key: 'danger', label: 'DB 错误' }
  if (s === 'LLM_ERROR') return { key: 'muted', label: 'AI 失败' }
  if (s === 'LLM_FINDINGS') {
    const findings = issueOf(row).findings || []
    const hi = findings.filter(f => String(f.severity || '').toUpperCase() === 'HIGH').length
    if (hi > 0) return { key: 'danger', label: `${hi} 高危` }
    return { key: 'warn', label: `${findings.length} 处优化` }
  }
  return { key: '', label: '' }
}
function shortClass(fqn) {
  if (!fqn) return ''
  const parts = String(fqn).split('.')
  return parts[parts.length - 1] || fqn
}
function statusLabel(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'DONE') return '已完成'
  if (v === 'RUNNING') return '运行中'
  if (v === 'FAILED') return '失败'
  return v || '—'
}

/* ────────── 交互 ────────── */
function setIssueSource(key) {
  filters.value.issueSource = filters.value.issueSource === key ? '' : key
  page.value = 1
}
function toggleDomain(key) {
  filters.value.domain = filters.value.domain === key ? '' : key
  page.value = 1
}
function doSearch() { page.value = 1 }
function clearFilters() {
  filters.value = { domain: '', issueSource: '', keyword: '' }
  page.value = 1
}
function doReload() { doLoad() }
function gotoPage(p) {
  page.value = Math.max(1, Math.min(pageCount.value, p))
  jumpInput.value = page.value
}
function doJump() {
  const n = Number(jumpInput.value)
  if (!Number.isFinite(n)) return
  gotoPage(Math.floor(n))
}
function onPageSizeChange(e) {
  pageSize.value = Number(e.target.value)
  page.value = 1
}
function onEnvChange(e) {
  emit('update:env', e)
  page.value = 1
  doLoad()
}

/* ────────── 数据加载 ────────── */
async function doLoad() {
  loading.value = true
  loadError.value = ''
  rawItems.value = []
  loadedCount.value = 0
  serverTotal.value = 0
  total.value = 0
  kpisRaw.value = { total: 0, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 }
  try {
    // 如果父组件通过 filter.taskId 指定了任务（从巡检任务页跳来），优先用；
    // 否则走原"取最新 DONE 任务"逻辑。
    let task
    if (props.filter?.taskId) {
      task = {
        id: props.filter.taskId,
        task_no: props.filter.taskNo || `#${props.filter.taskId}`,
      }
    } else {
      task = await getLatestDiiTask(props.env)
    }
    latestTask.value = task
    if (!task) return

    // ① 一次拉 4 个 KPI 数字（后端单条 SQL 出结果，不依赖列表全量加载）
    try {
      const stats = await getDiiItemIssuesStats({ env: props.env, taskId: task.id })
      kpisRaw.value = stats || { total: 0, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 }
    } catch (e) {
      console.warn('[SQL分析] 加载 KPI stats 失败，KPI 暂为 0：', e?.message || e)
      kpisRaw.value = { total: 0, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 }
    }

    // ② 列表照旧分页拉
    const batchSize = 500
    const maxItems = 50_000
    let offset = 0
    const acc = []

    while (offset < maxItems) {
      const res = await listDiiItemIssues({
        env: props.env, taskId: task.id, limit: batchSize, offset,
      })
      const batch = Array.isArray(res) ? res : (res?.items || [])
      if (offset === 0) serverTotal.value = res?.total ?? batch.length
      if (batch.length === 0) break
      acc.push(...batch)
      rawItems.value = acc.slice()
      loadedCount.value = acc.length
      total.value = acc.length
      if (batch.length < batchSize) break
      offset += batchSize
    }
  } catch (e) {
    loadError.value = e.message || '未知错误'
    rawItems.value = []
    total.value = 0
    serverTotal.value = 0
    loadedCount.value = 0
    kpisRaw.value = { total: 0, explainError: 0, llmFindings: 0, llmPending: 0, llmError: 0 }
  } finally {
    loading.value = false
  }
}

/* ─────────── 重新执行 AI 分析 · 模态框 ─────────── */
const AI_MODELS = [
  { key: 'glm-4.7',     label: 'GLM 4.7' },
  { key: 'minimax-2.7', label: 'MiniMax 2.7' },
]
const aiRerun = ref({
  open: false,
  itemId: null,
  sql: '',
  model: 'minimax-2.7',
})
/** 正在重跑 AI 的行 id 集合（用于行级蒙版） */
const aiRunningIds = ref(new Set())
function isRowRunning(id) { return aiRunningIds.value.has(id) }

/* ═════════════════ V16+：SQL 池导入（独立页合并后的入口） ═════════════════ */
const importOpen = ref(false)
/** 导入完成后刷新列表——后端已串接白名单继承 + 池数据合并显示 */
function onPoolImported() {
  if (typeof doLoad === 'function') doLoad()
}

/* ═════════════════ V16：白名单审批工作流 ═════════════════ */

/**
 * 当前用户：优先从全局登录态读（LDAP B 档），fallback 到本地 storage
 * 简化方案——若都拿不到则提示用户在 yml 上 SecurityContextHolder 兜底
 */
const currentUser = ref(
  (typeof window !== 'undefined' && window.localStorage?.getItem('dii-user')) || 'guest'
)

const wlDlg = ref({
  open: false,
  mode: 'apply',   // 'apply' | 'view' | 'l1' | 'l2'
  row: null,
  application: null,
})

/**
 * 根据当前行的 whitelist_status 决定按钮文案与样式。
 */
function wlButtonText(it) {
  const s = it?.whitelist_status
  // V16+：APPROVED 行附带 target_type 信息——区分"单条 SQL 白名单"vs"同名 nsql 共享白名单"
  const t = it?.whitelist_target_type    // 'HASH' / 'NAMED_SQL' / undefined
  if (!s)                  return '申请白名单'
  if (s === 'PENDING_L1')  return '白名单申请中 · 一审'
  if (s === 'PENDING_L2')  return '白名单申请中 · 二审'
  if (s === 'REJECTED_L1') return '白名单已退回'
  if (s === 'APPROVED') {
    return t === 'NAMED_SQL' ? '已白名单 · 同名 nsql' : '已白名单 · 单条'
  }
  return '申请白名单'
}
function wlButtonClass(it) {
  const s = it?.whitelist_status
  return {
    'btn-wl-empty':    !s,
    'btn-wl-pending':  s === 'PENDING_L1' || s === 'PENDING_L2',
    'btn-wl-rejected': s === 'REJECTED_L1',
    'btn-wl-approved': s === 'APPROVED',
  }
}

/**
 * 点击按钮：
 *   - 无 wl 状态：apply 模式
 *   - 有 wl 状态：拉 application 详情 → 按 user 角色决定 mode (l1/l2/view)
 */
async function openWhitelistDialog(it) {
  if (!it?.whitelist_app_id) {
    wlDlg.value = { open: true, mode: 'apply', row: it, application: null }
    return
  }
  try {
    const app = await getWhitelistApplication(it.whitelist_app_id)
    const user = currentUser.value
    let mode = 'view'
    // 状态机：根据当前用户 + status 推导显示哪个 mode
    if (app?.status === 'PENDING_L1' && app?.l1_approver === user) mode = 'l1'
    else if (app?.status === 'PENDING_L2' && app?.l2_approver === user) mode = 'l2'
    // 其他情况一律 view（含申请人 / 旁观者）
    wlDlg.value = { open: true, mode, row: it, application: app }
  } catch (e) {
    alert(`加载白名单申请详情失败：${e?.message || e}`)
  }
}

/**
 * 操作完成后回调：刷新当前行 wl 状态。简单做：整页重载（与重新分析等其他动作风格一致）。
 */
function onWlActionDone() {
  // 触发列表重载——doLoad() 已存在于本组件
  // 注意：不重置过滤器；用户刚做完操作还想留在原位
  if (typeof doLoad === 'function') {
    doLoad()
  }
}

/** 点击 "重新执行 AI 分析" → 打开模态框，预填当前 SQL */
function rerunLlm(id) {
  const row = rawItems.value.find(r => r.id === id)
  if (!row) return
  aiRerun.value = {
    open: true,
    itemId: id,
    sql: row.sql_text || '',
    model: 'minimax-2.7',
  }
}
function closeRerunModal() {
  aiRerun.value = { ...aiRerun.value, open: false }
}

/**
 * 模态框点击"确认" → 关弹窗 + 行打蒙版 + 异步触发 LLM + 轮询行状态。
 *
 * 流程：
 *   ① 后端 POST /debug/llm-analyze/{id}/async 立即返回（已在 DB 标记 PENDING）
 *   ② 前端每 3s 轮询 getDiiItem(id)，看到 llm_status ≠ PENDING 即停止
 *   ③ 用最新数据原地替换 rawItems[idx]，移除蒙版
 *
 * 超时保护：最多轮询 5 分钟，到期未完成强制移除蒙版（极端情况）
 */
const RERUN_POLL_INTERVAL_MS = 3000
const RERUN_POLL_TIMEOUT_MS = 5 * 60 * 1000

function pollRerunStatus(id) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const tick = async () => {
      try {
        const fresh = await getDiiItem(id)
        const status = fresh && fresh.llm_status
        if (fresh && fresh.id != null) {
          const idx = rawItems.value.findIndex((r) => r.id === fresh.id)
          if (idx >= 0) {
            rawItems.value.splice(idx, 1, { ...rawItems.value[idx], ...fresh })
          }
        }
        if (status && status !== 'PENDING') {
          // DONE / FAILED / SKIPPED 都视作终态
          resolve({ ok: true, status })
          return
        }
      } catch (e) {
        console.warn('[SQL分析] 轮询单行状态出错（继续等待）：', e)
      }
      if (Date.now() - startedAt > RERUN_POLL_TIMEOUT_MS) {
        resolve({ ok: false, status: 'TIMEOUT' })
        return
      }
      setTimeout(tick, RERUN_POLL_INTERVAL_MS)
    }
    setTimeout(tick, RERUN_POLL_INTERVAL_MS)
  })
}

async function submitRerun() {
  const id = aiRerun.value.itemId
  const sqlText = aiRerun.value.sql
  const model = aiRerun.value.model
  if (id == null) return
  closeRerunModal()
  // 加入运行集合 → 行立即出现"AI 分析生成中..."蒙版
  const next = new Set(aiRunningIds.value)
  next.add(id)
  aiRunningIds.value = next
  try {
    // ① 触发异步任务，后端立即返回（不阻塞）
    await runDiiLlmAnalyzeAsync(id, { sql: sqlText, model })
    // ② 轮询行状态直到终态
    const r = await pollRerunStatus(id)
    if (!r.ok) {
      console.warn('[SQL分析] 轮询超时（5 分钟），蒙版已撤除，可手动刷新查看最终状态')
    }
  } catch (e) {
    alert('重新分析触发失败：' + (e.message || e))
  } finally {
    const after = new Set(aiRunningIds.value)
    after.delete(id)
    aiRunningIds.value = after
  }
}

async function doExport() {
  if (exporting.value || !latestTask.value) return
  exporting.value = true
  try {
    const res = await exportDiiItemIssues({ env: props.env, taskId: latestTask.value.id })
    console.info('[SQL分析] 已导出', res?.fileName)
  } catch (e) {
    alert('导出失败：' + (e.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

onMounted(doLoad)
watch(() => props.env, () => {
  // 切 env 时，原 task 属于另一 env 就失效；emit 让父清空 filter
  // 父收到后会清掉 sqlListFilter，DaoSqlList 重新走"最新 DONE 任务"
  if (props.filter?.taskId) {
    emit('back-to-tasks')
  }
  doLoad()
})
watch(
  () => props.filter,
  (f) => {
    if (!f) return
    const next = { domain: '', issueSource: '', keyword: '' }
    if (f.domain) next.domain = f.domain
    filters.value = next
    page.value = 1
  },
  { deep: true },
)
</script>

<style scoped>
/* ════════════ 设计 token（参考 Sourcegraph）════════════
   - 中性灰为主，单一深蓝 #0b70db 作为唯一交互 accent
   - 状态色（红/橙/绿）只用于真正的语义信号，不作装饰
   - 移除渐变与多彩；用边框、字重、间距而不是色块来分层 */
.dii-page {
  --c-bg:        #fafbfc;
  --c-surface:   #ffffff;
  --c-border:    #e1e5eb;
  --c-border-2:  #ecf0f4;
  --c-text:      #14171c;
  --c-text-2:    #5e6975;
  --c-text-3:    #8990a0;
  --c-primary:   #0b70db;   /* Sourcegraph 蓝：唯一交互色 */
  --c-primary-2: #0859a8;
  --c-primary-bg:#e8f1fd;
  --c-danger:    #cf1124;
  --c-danger-bg: #fdecee;
  --c-warn:      #c08c00;   /* 偏深的琥珀，不刺眼 */
  --c-warn-bg:   #fdf3df;
  --c-info:      #0b70db;
  --c-info-bg:   #e8f1fd;
  --c-success:   #137333;
  --c-low:       #8990a0;
  --c-low-bg:    #f1f3f5;

  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
}

/* ════════════ Dark 主题 token 覆盖（Sourcegraph Cody 风）════════════
   - 接近纯黑的深底 #0a0a0a，与 sidebar 统一无 navy 蓝调
   - surface 仅微差，靠 border 而非 bg 分层
   - 主色暗色切红（SG 招牌） */
[data-theme="dark"] .dii-page {
  --c-bg:        #0a0a0a;
  --c-surface:   #131316;
  --c-border:    rgba(255,255,255,0.08);
  --c-border-2:  rgba(255,255,255,0.05);
  --c-text:      #f1f3f8;
  --c-text-2:    #c8d3e8;
  --c-text-3:    #9b9da4;
  --c-primary:   #FF5543;
  --c-primary-2: #ff7561;
  --c-primary-bg:rgba(255,85,67,0.12);
  --c-danger:    #ff7a7e;
  --c-danger-bg: rgba(255,84,89,0.14);
  --c-warn:      #f5c062;
  --c-warn-bg:   rgba(245,192,98,0.14);
  --c-info:      #5e9eff;
  --c-info-bg:   rgba(94,158,255,0.12);
  --c-success:   #6ec78a;
  --c-low:       #9b9da4;
  --c-low-bg:    rgba(255,255,255,0.04);
}

/* ════════════ Hero ════════════ */
.hero {
  flex-shrink: 0;
  padding: 18px 28px 0;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}
.hero-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.hero-meta { min-width: 0; flex: 1; }

.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}
.crumb-home { color: var(--c-text-3); }
.crumb-sep { color: var(--c-text-3); }
.crumb-current { color: var(--c-text); font-weight: 500; }

.hero-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--c-text);
}

/* 面包屑 + 任务编号 pill 同行 */
.crumb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.crumb-row .crumb { margin-bottom: 0; flex-shrink: 0; }

/* 任务过滤回退条：仅在从巡检任务页跳来时显示 */
.dii-task-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
  padding: 10px 14px;
  background: var(--bg-info-soft, #eef4ff);
  border: 1px solid var(--border-info, #c5d8ff);
  border-radius: 6px;
}
.dii-task-banner-text {
  font-size: 13px;
  color: var(--text-primary, #14171c);
  font-family: ui-monospace, monospace;
}
.dii-task-banner-no {
  color: var(--text-secondary, #5a6172);
  font-weight: normal;
  margin-left: 4px;
}
.dii-task-banner-back {
  padding: 4px 10px;
  background: transparent;
  /* 用 banner 自身的 info-blue 边框色，避免和 banner 蓝边视觉脱节
     （早先写 var(--border) 在 light 模式下会拿到全局灰，与蓝色 banner 不一致） */
  border: 1px solid var(--border-info, #c5d8ff);
  border-radius: 4px;
  color: var(--text-link, #2563eb);
  font-size: 12.5px;
  cursor: pointer;
}
.dii-task-banner-back:hover {
  background: var(--bg-info-hover, #dbe7ff);
}

/* V16：我的待审过滤 banner（黄色提示色） */
.dii-todo-banner {
  display: flex; align-items: center; justify-content: space-between;
  margin: 12px 0 8px;
  padding: 10px 14px;
  background: var(--bg-warning-soft, #fffbe6);
  border: 1px solid var(--border-warning, #ffd591);
  border-radius: 6px;
}
.dii-todo-banner-text {
  font-size: 13px;
  color: var(--text-warning, #c08c00);
  display: inline-flex; align-items: center;
}
.dii-todo-banner-clear {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border-warning, #ffd591);
  border-radius: 4px;
  color: var(--text-warning, #c08c00);
  font-size: 12.5px;
  cursor: pointer;
}
.dii-todo-banner-clear:hover { background: var(--bg-warning-soft-hover, #fff3bf); }
[data-theme="dark"] .dii-todo-banner {
  background: var(--bg-warning-soft-dark, #3a2e15);
  border-color: var(--border-warning-dark, #7a5e1f);
}
[data-theme="dark"] .dii-todo-banner-text { color: var(--text-warning-dark, #f5c062); }
[data-theme="dark"] .dii-todo-banner-clear {
  color: var(--text-warning-dark, #f5c062);
  border-color: var(--border-warning-dark, #7a5e1f);
}

/* dark 模式：用更柔和的蓝调，避免在深色背景上"扎眼" */
[data-theme="dark"] .dii-task-banner {
  background: var(--bg-info-soft-dark, #1e2a4a);
  border-color: var(--border-info-dark, #3a5183);
}
[data-theme="dark"] .dii-task-banner-back {
  color: var(--text-link-dark, #60a5fa);
  border-color: var(--border-info-dark, #3a5183);
}
[data-theme="dark"] .dii-task-banner-back:hover {
  background: var(--bg-info-hover-dark, #2a3a64);
}

/* 搜索 / 领域 / 筛选汇总同行排列：不换行，搜索框可压缩 */
.hero-task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
}
.hero-task { flex-shrink: 0; }   /* 状态 + 任务编号块不压缩 */
.hero-search {
  flex: 1 1 auto;
  min-width: 140px;              /* 给搜索框最小可压缩值 */
  max-width: 320px;
}
.hero-seg { flex-shrink: 0; }    /* 领域 segment 不压缩 */
/* 领域按钮内边距收紧一些，让一行更易容纳 */
.hero-seg .seg-btn { padding: 5px 9px; gap: 4px; }
.hero-seg .seg-btn .seg-dot { width: 5px; height: 5px; }
.hero-filter-summary {
  font-size: 12px;
  color: var(--c-text-3);
  white-space: nowrap;
  flex-shrink: 0;
}
.hero-filter-summary strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.hero-loading-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--c-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 状态 + 任务编号合并成一个外框 */
.hero-task {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  padding: 4px 12px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-surface);
}
.task-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;             /* 外框已经包了，pill 本身不再加 padding */
  font-weight: 600;
  font-size: 11.5px;
  background: transparent;
  color: var(--c-text-2);
}
/* 状态色仅作用于文字（dot 用 currentColor），背景统一交给外框 */
.task-pill.status-done { color: var(--c-success); }
.task-pill.status-running { color: var(--c-primary); }
.task-pill.status-failed { color: var(--c-danger); }
.task-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
}
.task-pill.status-running .task-dot { animation: pulse 1.4s infinite; }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.35 } }

.task-no-label {
  font-size: 12px;
  color: var(--c-text-3);
  margin-right: -4px;   /* 与 task-no 之间留出更紧凑的视觉间距 */
}
.task-no {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--c-text);
  background: var(--c-low-bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.task-progress { color: var(--c-text-3); }
.task-failed { color: var(--c-danger); font-weight: 600; }

.hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ════════════ 按钮 ════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
}
.btn:hover:not(:disabled) {
  background: var(--c-low-bg);
  color: var(--c-text);
  border-color: var(--c-text-3);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--c-primary-2);
  border-color: var(--c-primary-2);
  color: #fff;
}
.btn-secondary { /* default */ }
.btn-icon {
  padding: 5px 10px;
  font-family: ui-monospace, monospace;
  font-size: 14px;
  line-height: 1;
}
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-link {
  border: none;
  background: transparent;
  color: var(--c-primary);
  padding: 4px 8px;
  font-weight: 500;
}
.btn-link:hover:not(:disabled) {
  background: var(--c-primary-bg);
  color: var(--c-primary-2);
}
.btn-ico { flex-shrink: 0; }
.btn-ico.is-spin { animation: spin 0.8s linear infinite; }

/* AI 图标作为按钮的"前缀块"：高度撑满按钮，紧贴左边 */
.btn-ai-lead {
  padding: 0 14px 0 0;        /* 左边 padding 让 icon 贴边 */
  gap: 8px;
  overflow: hidden;
}
.btn-ai-lead-ico {
  width: auto !important;
  height: 100% !important;      /* 撑满按钮高度，覆盖 SVG 自身的 width/height 属性 */
  align-self: stretch;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  display: block;
}
.btn-ai-lead-label {
  font-weight: 600;
}

/* V16：白名单按钮 4 态样式 */
.btn-wl {
  padding: 4px 12px;
  font-size: 12.5px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  margin-left: 8px;
  border: 1px solid transparent;
  transition: background 0.12s;
}
.btn-wl-empty {
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #5a6172);
  border-color: var(--border, #d4d8dd);
}
.btn-wl-empty:hover {
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-primary, #14171c);
}
.btn-wl-pending {
  background: var(--bg-warning-soft, #fffbe6);
  color: var(--text-warning, #c08c00);
  border-color: var(--border-warning, #ffd591);
}
.btn-wl-pending:hover {
  background: var(--bg-warning-soft-hover, #fff3bf);
}
.btn-wl-rejected {
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border-color: var(--border-error, #ffccc7);
}
.btn-wl-rejected:hover {
  background: var(--bg-error-soft-hover, #ffe0dc);
}
.btn-wl-approved {
  background: var(--bg-success-soft, #f6ffed);
  color: var(--text-success, #137333);
  border-color: var(--border-success, #b7eb8f);
}
.btn-wl-approved:hover { cursor: default; }

[data-theme="dark"] .btn-wl-empty {
  background: var(--bg-card-dark, #1f2733);
  color: var(--text-secondary-dark, #9aa3b0);
  border-color: var(--border-dark, #2a3340);
}
[data-theme="dark"] .btn-wl-pending {
  background: var(--bg-warning-soft-dark, #3a2e15);
  color: var(--text-warning-dark, #f5c062);
  border-color: var(--border-warning-dark, #7a5e1f);
}
[data-theme="dark"] .btn-wl-rejected {
  background: var(--bg-error-soft-dark, #3d1f1f);
  color: var(--text-error-dark, #ff7a7e);
  border-color: var(--border-error-dark, #6b3030);
}
[data-theme="dark"] .btn-wl-approved {
  background: var(--bg-success-soft-dark, #1e3320);
  color: var(--text-success-dark, #6ec78a);
  border-color: var(--border-success-dark, #2f5a32);
}

/* "AI" 文字图标：用 monospace 字体在小框里居中，模拟图标 */
.ai-text-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 14px;
  padding: 0 3px;
  border: 1.4px solid currentColor;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.02em;
  line-height: 1;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ════════════ KPI Tiles ════════════ */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
/* KPI tile：白底 + 单边底色细线区分类别；选中态只换底色细线为 accent，不改大色块 */
.kpi {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  position: relative;
}
.kpi:hover { border-color: var(--c-text-3); }
.kpi.active {
  border-color: var(--c-primary);
  background: var(--c-primary-bg);
}

.kpi-ico {
  width: 28px; height: 28px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--c-low-bg);
  color: var(--c-text-2);
}
.kpi.kpi-danger .kpi-ico { color: var(--c-danger); }
.kpi.kpi-warn .kpi-ico { color: var(--c-warn); }
.kpi.kpi-muted .kpi-ico { color: var(--c-text-2); }
.kpi.active .kpi-ico { background: var(--c-surface); }

.kpi-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.kpi-num {
  font-size: 20px;
  font-weight: 600;
  color: var(--c-text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.kpi-lbl {
  font-size: 11px;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ════════════ Toolbar ════════════ */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0 14px;
  flex-wrap: wrap;
}

.search {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 480px;
}
.search-ico {
  position: absolute;
  left: 10px; top: 50%;
  transform: translateY(-50%);
  color: var(--c-text-3);
  pointer-events: none;
}
.search-input {
  width: 100%;
  height: 32px;
  padding: 0 30px 0 32px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 12.5px;
  outline: none;
  transition: all 0.15s;
  font-family: inherit;
}
.search-input:focus { border-color: var(--c-primary); }
.search-clear {
  position: absolute;
  right: 8px; top: 50%;
  transform: translateY(-50%);
  width: 18px; height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--c-text-3);
  cursor: pointer;
  font-size: 11px;
}
.search-clear:hover { background: var(--c-low-bg); color: var(--c-text); }

.seg {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: var(--c-low-bg);
  border-radius: 8px;
  gap: 2px;
}
.seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--c-text-2);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.seg-btn:hover:not(:disabled):not(.active) { color: var(--c-text); background: rgba(255,255,255,0.5); }
.seg-btn.active {
  background: var(--c-surface);
  color: var(--c-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.seg-btn.disabled { opacity: 0.4; cursor: not-allowed; }
.seg-clear { padding: 5px 9px; color: var(--c-text-3); }
/* 领域按钮的色点：恢复显示，4 种颜色与行内 .domain-dot 对齐 */
.seg-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.seg-btn .seg-dot.d-deposit    { background: #FA8C16; }
.seg-btn .seg-dot.d-loan       { background: #52C41A; }
.seg-btn .seg-dot.d-common     { background: #1890FF; }
.seg-btn .seg-dot.d-settlement { background: #722ED1; }
.seg-btn .seg-dot.d-other      { background: var(--c-text-3); }

.toolbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  font-size: 12px;
  color: var(--c-text-3);
}
.filter-summary strong { color: var(--c-text); font-variant-numeric: tabular-nums; }
.loading-progress { display: inline-flex; align-items: center; gap: 6px; color: var(--c-primary); }
.lp-spinner {
  width: 12px; height: 12px;
  border: 1.5px solid var(--c-primary-bg);
  border-top-color: var(--c-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
.lp-spinner.big { width: 24px; height: 24px; border-width: 2.5px; }

/* ════════════ 列表 ════════════ */
.list-scroll {
  flex: 1;
  overflow: auto;
  padding: 14px 28px 32px;
  min-height: 0;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;                   /* 6 → 14：行间留出充足呼吸空间 */
}

.row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);   /* 浅阴影让每张卡有"实体感" */
}
.row:hover {
  border-color: var(--c-text-3);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}
.row.is-expanded {
  border-color: var(--c-primary);
  box-shadow: 0 2px 12px rgba(11, 112, 219, 0.10);
}
[data-theme="dark"] .row { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
[data-theme="dark"] .row:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
[data-theme="dark"] .row.is-expanded { box-shadow: 0 2px 14px rgba(255, 85, 67, 0.20); }


/* 左侧严重度色条：3 → 4px 加粗，作为"卡片身份证"更醒目 */
.row-stripe {
  width: 4px;
  flex-shrink: 0;
  background: var(--c-low);
}
.row.sev-danger .row-stripe { background: var(--c-danger); }
.row.sev-warn .row-stripe { background: var(--c-warn); }
.row.sev-low .row-stripe { background: var(--c-low); }
.row.sev-muted .row-stripe { background: var(--c-text-3); }
.row.sev-info .row-stripe { background: var(--c-info); }

.row-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 14px;
  min-width: 0;
}

/* 第 1 行：标识区，加底部分隔线把"meta" 和"SQL/摘要" 分层 */
.row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--c-border-2);
}
/* SQL 类型徽章：单色 monospace，仅靠字体差异化，不用颜色噪声 */
.kind {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--c-low-bg);
  color: var(--c-text-2);
  border: 1px solid var(--c-border);
  flex-shrink: 0;
}

/* V14：SQL 来源标签（odb / nsql）—— 与 .kind 同高，颜色按主题 token 分两套
   odb  = 蓝色（信息色，与 link 同色调）
   nsql = 紫色（区分新来源，配色取自 SQL 池子菜单 accent #0CA678 的克制版） */
.source-tag {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  flex-shrink: 0;
  text-transform: lowercase;
}
.source-odb {
  background: var(--c-info-bg, #e6f0fc);
  color: var(--c-info-text, #0b70db);
  border: 1px solid var(--c-info-border, #b6d4f5);
}
.source-nsql {
  background: var(--c-accent-bg, #e6fcf2);
  color: var(--c-accent-text, #0a8559);
  border: 1px solid var(--c-accent-border, #a7e4c8);
}
/* dark 主题：亮一档 */
[data-theme="dark"] .source-odb {
  background: var(--c-info-bg-dark, #1f3050);
  color: var(--c-info-text-dark, #7eb8fd);
  border-color: var(--c-info-border-dark, #2f4a78);
}
[data-theme="dark"] .source-nsql {
  background: var(--c-accent-bg-dark, #1d3329);
  color: var(--c-accent-text-dark, #6ec78a);
  border-color: var(--c-accent-border-dark, #2f5a3c);
}

/* V16+：nsql 行专属——完整 named_sql 显示
   - 不截断（白名单审批 / 巡检定位都要看完整名）
   - 长名自动 break-word 而不是省略号；行高紧凑避免破坏 row-head 视觉
   - 配色继承 source-nsql 弱化版（绿色，但比 badge 浅，避免与 badge 撞色） */
.named-sql-full {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-accent-text, #0a8559);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--c-accent-bg-soft, #f0fdf6);
  border: 1px solid var(--c-accent-border-soft, #cfeede);
  /* 关键：全量展示，不省略号 */
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.4;
  /* 占据剩余横向空间，避免与右侧 table-chain / domain 挤一行 */
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
}
[data-theme="dark"] .named-sql-full {
  background: var(--c-accent-bg-soft-dark, #16271f);
  color: var(--c-accent-text-dark, #6ec78a);
  border-color: var(--c-accent-border-soft-dark, #2a4a37);
}

.table-chain {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.table-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-more {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--c-low-bg);
  color: var(--c-text-3);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.sep { color: var(--c-text-3); font-size: 11px; }

/* 领域标签：4 大领域用 4 种颜色，与左侧"交易链路"侧栏 DOMAIN_COLORS 对齐 */
.domain {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--c-text-2);
  flex-shrink: 0;
}
.domain-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--c-text-3);
}
/* 4 种领域固定色（与 ChainImpactSidebar.DOMAIN_COLORS 一致） */
.domain.dom-deposit    .domain-dot { background: #FA8C16; } /* 存款 = 橙 */
.domain.dom-loan       .domain-dot { background: #52C41A; } /* 贷款 = 绿 */
.domain.dom-common     .domain-dot { background: #1890FF; } /* 公共 = 蓝 */
.domain.dom-settlement .domain-dot { background: #722ED1; } /* 结算 = 紫 */
.domain.dom-other      .domain-dot { background: var(--c-text-3); }

.method {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  color: var(--c-text-3);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.method-class { color: var(--c-text-2); font-weight: 500; }
.method-name { color: var(--c-text-3); }

.row-grow { flex: 1; min-width: 8px; }

/* 问题徽章：明显的 pill 形态 + 浅色填充 + 同色文字，提升识别度 */
.issue-badge {
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 600;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 12px;
  border: 1px solid;
}
.issue-badge::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.issue-badge.b-danger {
  color: var(--c-danger);
  background: var(--c-danger-bg);
  border-color: var(--c-danger);
}
.issue-badge.b-warn {
  color: var(--c-warn);
  background: var(--c-warn-bg);
  border-color: var(--c-warn);
}
.issue-badge.b-muted {
  color: var(--c-text-2);
  background: var(--c-low-bg);
  border-color: var(--c-border);
}

/* ── 代码块通用：黑底浅字 + 右上角复制按钮（覆盖 row-sql / callout-b / sug-code） ── */
.code-block {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}
.code-block.collapsed { overflow: hidden; }

.code-copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #c8cad0;
  cursor: pointer;
  opacity: 0;                 /* 默认隐藏，hover 整块时浮出 */
  transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
  z-index: 2;
}
.code-block:hover .code-copy-btn,
.code-copy-btn:focus-visible {
  opacity: 1;
}
.code-copy-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.20);
  color: #ffffff;
}
.code-copy-btn:active { background: rgba(255, 255, 255, 0.20); }

/* 第 2 行：SQL —— 黑底终端风 */
.row-sql {
  margin: 0;
  padding: 10px 36px 10px 12px;   /* 右侧 36px 给复制按钮腾位 */
  border-radius: 6px;
  background: #0d1117;            /* GitHub 深底 */
  border: 1px solid #1f2329;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.55;
  color: #d8dee9;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: hidden;
}
.row-sql.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 第 3 行：摘要（折叠态） */
.row-summary { display: flex; align-items: flex-start; }
.sum {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--c-text-2);
  min-width: 0;
}
.sum-ico { flex-shrink: 0; display: inline-flex; align-items: center; line-height: 0; padding-top: 2px; }
.sum-text { min-width: 0; overflow: hidden; }
.sum-finding { white-space: nowrap; }
.sum-divider { margin: 0 6px; color: var(--c-text-3); }
.sum-more { color: var(--c-primary); font-weight: 500; }
.sum.sum-danger .sum-text { color: var(--c-danger); }
.sum.sum-muted .sum-text { color: var(--c-text-3); }
.sum.sum-info .sum-text { color: var(--c-info); }
.sum.sum-info .sum-ico { color: var(--c-info); }
.sum-ico .is-spin { animation: spin 0.8s linear infinite; }

/* PENDING 展开态：浅蓝底 + 旋转 spinner */
.ai-pending-block {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--c-info-bg);
  border: 1px dashed var(--c-info);
  border-radius: 6px;
  color: var(--c-info);
  font-size: 13px;
}
.ai-pending-spin {
  animation: spin 0.9s linear infinite;
  color: var(--c-info);
}
.ai-pending-text { font-weight: 500; }

/* 展开态详情：块间距加大到 16px 让"独立单元"感更强 */
.row-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 4px;
}

/* ── 块标题（① ② ③）── */
.block-h {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  margin-top: 4px;
  font-size: 12px;
}
.block-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--c-low-bg);
  color: var(--c-text-2);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
}
.block-no-danger { background: var(--c-danger-bg); color: var(--c-danger); }
.block-no-warn   { background: var(--c-warn-bg); color: var(--c-warn); }
.block-no-info   { background: var(--c-primary-bg); color: var(--c-primary); }
.block-no-muted  { background: var(--c-low-bg); color: var(--c-text-2); }

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-text);
  letter-spacing: 0.02em;
}

.block-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-left: auto;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
}
.block-status-danger { color: var(--c-danger); border-color: var(--c-danger); background: var(--c-danger-bg); }
.block-status-warn   { color: var(--c-warn); border-color: var(--c-warn); background: var(--c-warn-bg); }
.block-status-info   { color: var(--c-primary); border-color: var(--c-primary); background: var(--c-primary-bg); }
.block-status-muted  { color: var(--c-text-2); border-color: var(--c-border); background: var(--c-low-bg); }

/* ── AI 大框：包裹 ② AI 分析 + ③ AI 建议 + 重新分析按钮 ── */
.ai-block {
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--c-surface);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── AI 元信息条（模型 / 耗时 / 置信度 / 时间）── */
.ai-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  font-size: 11px;
  color: var(--c-text-3);
  margin-bottom: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}
/* 与 ② 标题同行、靠右排列 */
.ai-meta-inline {
  margin-left: auto;
}
.ai-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ai-meta-item code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--c-text-2);
  font-size: 11px;
}
.ai-meta-conf.is-strong { color: var(--c-success); font-weight: 600; }
.ai-meta-conf.is-medium { color: var(--c-warn); font-weight: 600; }
.ai-meta-conf.is-weak   { color: var(--c-danger); font-weight: 600; }
.ai-meta-time { font-variant-numeric: tabular-nums; }

/* ── 一句话总结 ── */
.ai-summary {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--c-warn-bg);
  border-left: 2px solid var(--c-warn);
  border-radius: 4px;
  font-size: 12.5px;
  line-height: 1.6;
}
.ai-summary-label {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--c-warn);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-warn);
  border-radius: 3px;
  align-self: center;
}
.ai-summary-text {
  flex: 1;
  color: var(--c-text);
}

/* ── findings 列表（重排为表格式行）── */
.findings-card {
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-bg);
  overflow: hidden;
}
.finding {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--c-border-2);
}
.finding:last-child { border-bottom: none; }
.finding .finding-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.finding-type {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--c-text-3);
  letter-spacing: 0.02em;
}
.finding-desc {
  font-size: 12.5px;
  color: var(--c-text);
  line-height: 1.55;
}
.finding-evidence {
  font-size: 11px;
  color: var(--c-text-3);
  font-family: ui-monospace, monospace;
  margin-top: 2px;
  padding: 4px 8px;
  background: var(--c-surface);
  border-radius: 3px;
  border: 1px solid var(--c-border-2);
  word-break: break-all;
}

/* ── suggestions 列表 ── */
.sugs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sug-card {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sug-card-h {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sug-card .sug-type {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-2);
  background: var(--c-low-bg);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--c-border);
}
.sug-priority {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--c-text-3);
  font-family: ui-monospace, monospace;
}
.sug-reason {
  font-size: 12.5px;
  color: var(--c-text);
  line-height: 1.6;
}
.sug-risk {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  font-size: 11.5px;
  color: var(--c-danger);
  background: var(--c-danger-bg);
  border: 1px solid var(--c-danger);
  border-radius: 4px;
  align-self: flex-start;
}

/* Callout：背景统一柔和灰，左侧 2px 色边代表语义；不再用大色块 */
.callout {
  border-radius: 4px;
  border: 1px solid var(--c-border);
  border-left-width: 2px;
  padding: 9px 12px;
  background: var(--c-bg);
}
.callout.c-danger { border-left-color: var(--c-danger); }
.callout.c-warn   { border-left-color: var(--c-warn); }
.callout.c-info   { border-left-color: var(--c-info); }
.callout-h {
  font-size: 12.5px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--c-text);
}
.callout-h-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.callout-b {
  margin: 0;
  padding: 10px 36px 10px 12px;
  background: #0d1117;
  border: 1px solid #1f2329;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.55;
  color: #d8dee9;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow: auto;
}

.findings, .sugs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.findings li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.finding-body { flex: 1; min-width: 0; }
.finding-type { font-size: 11.5px; color: var(--c-text-3); font-family: ui-monospace, monospace; margin-bottom: 2px; }
.finding-desc { font-size: 12.5px; color: var(--c-text); line-height: 1.55; }

.sev-tag {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.05em;
  border: 1px solid;
  background: transparent;
}
.sev-tag.sev-high { color: var(--c-danger); border-color: var(--c-danger); }
.sev-tag.sev-medium { color: var(--c-warn); border-color: var(--c-warn); }
.sev-tag.sev-low { color: var(--c-text-3); border-color: var(--c-border); }

.sugs li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.6);
  border-radius: 4px;
}
.sug-h { display: flex; align-items: center; gap: 6px; }
.scope-tag {
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.scope-tag.scope-table { background: var(--c-low-bg); color: var(--c-text-2); border: 1px solid var(--c-border); }
.scope-tag.scope-sql   { background: var(--c-low-bg); color: var(--c-text-2); border: 1px solid var(--c-border); }
.sug-type {
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--c-text-3);
}
.sug-reason {
  font-size: 12.5px;
  color: var(--c-text);
  line-height: 1.55;
}
/* 代码块用浅灰底深色文字（Sourcegraph 风），不使用反色暗框 */
.sug-code {
  margin: 0;
  padding: 10px 36px 10px 12px;
  background: #0d1117;
  color: #d8dee9;
  border: 1px solid #1f2329;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow: auto;
  max-height: 160px;
}

.row-detail-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--c-border-2);
}
/* ai-block 内部的 actions 不需要再画虚线（外框已经界定了边界） */
.ai-block .row-detail-actions {
  border-top: none;
  padding-top: 0;
}

/* ════════════ Pager ════════════ */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 4px 8px;
  flex-wrap: wrap;
  gap: 12px;
}
/* 固定在 dii-page 底部，不随列表滚动 */
.pager-fixed {
  flex-shrink: 0;
  padding: 10px 28px;
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  box-shadow: 0 -2px 8px rgba(15, 23, 42, 0.04);
}
[data-theme="dark"] .pager-fixed {
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.4);
}
.pager-l, .pager-r { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--c-text-2); }
.pager-l strong { color: var(--c-text); font-variant-numeric: tabular-nums; }
.pager-sep { color: var(--c-border); }
.pager-lbl { color: var(--c-text-3); }
.pager-info { padding: 0 4px; color: var(--c-text-2); }
.pager-info strong { color: var(--c-text); font-variant-numeric: tabular-nums; }

.select-sm {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 12px;
  outline: none;
  font-family: inherit;
}
.select-sm:focus { border-color: var(--c-primary); }
.input-xs {
  width: 56px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 12px;
  outline: none;
  font-family: inherit;
}
.input-xs:focus { border-color: var(--c-primary); }

/* ════════════ State blocks ════════════ */
.state-block {
  padding: 60px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.state-error .state-ico {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: var(--c-danger-bg);
  color: var(--c-danger);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.state-title { font-size: 14px; font-weight: 600; color: var(--c-text); }
.state-desc { font-size: 12.5px; color: var(--c-text-3); }

/* ════════════ Dark 模式下：代码块反向 — 白底深字
   理由：dark page 已经是 #0a0a0a 深底，再用深底代码块两者糊在一起；
   反过来用浅底代码块 + 深字，能与外围深面板形成强反差，提升可读性 */
[data-theme="dark"] .row-sql,
[data-theme="dark"] .callout-b,
[data-theme="dark"] .sug-code {
  background: #c8ccd2;       /* 偏暗的灰白：不刺眼，与 #0a0a0a 仍保持充分对比 */
  color: #1a1d24;
  border-color: #a8acb3;
}

/* ── SQL 语法高亮：精简版，仅关键字 / 注释 / 占位符着色 ──
   字符串 / 函数名 / 数字保持普通文字色，避免代码框过于花哨。
   v-html 注入内容用 :deep() 穿透 scoped 边界 */
:deep(.sql-kw)          { color: #569cd6; font-weight: 600; }
:deep(.sql-comment)     { color: #6a9955; font-style: italic; }
:deep(.sql-placeholder) { color: #9cdcfe; }

[data-theme="dark"] :deep(.sql-kw)          { color: #0550ae; font-weight: 600; }
[data-theme="dark"] :deep(.sql-comment)     { color: #008000; font-style: italic; }
[data-theme="dark"] :deep(.sql-placeholder) { color: #001080; }

/* 复制按钮：dark 模式下处在白色代码块上，反向用深色样式 */
[data-theme="dark"] .code-copy-btn {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.12);
  color: #5e6975;
}
[data-theme="dark"] .code-copy-btn:hover {
  background: rgba(0, 0, 0, 0.12);
  border-color: rgba(0, 0, 0, 0.20);
  color: #14171c;
}

/* ════════════ 行级 AI 重跑蒙版 ════════════ */
.row.is-ai-running { pointer-events: none; }
.row.is-ai-running .row-ai-mask { pointer-events: auto; }

/* 半透磨砂遮罩：保留视线 + 锁定交互 */
.row-ai-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(1.5px);
  -webkit-backdrop-filter: blur(1.5px);
  border-radius: inherit;
}
[data-theme="dark"] .row-ai-mask {
  background: rgba(0, 0, 0, 0.50);
}

/* 等待药丸 */
.row-ai-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px 7px 14px;
  border-radius: 999px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.04);
  font-size: 12.5px;
  font-weight: 500;
}
[data-theme="dark"] .row-ai-pill {
  border-color: rgba(255, 255, 255, 0.10);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

/* ── Sparkles 脉冲光晕 ── */
.ai-sparkle-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.ai-sparkle-ico {
  position: relative;
  z-index: 2;
  color: var(--c-primary);
  animation: ai-sparkle-tilt 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.ai-sparkle-halo {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: var(--c-primary-bg);
  opacity: 0;
  animation: ai-sparkle-halo 2s ease-out infinite;
}
@keyframes ai-sparkle-tilt {
  0%,100% { transform: rotate(0deg) scale(1); }
  50%     { transform: rotate(20deg) scale(1.12); }
}
@keyframes ai-sparkle-halo {
  0%   { opacity: 0; transform: scale(0.5); }
  40%  { opacity: 0.9; }
  100% { opacity: 0; transform: scale(2.2); }
}

/* ── 文字 shimmer ── */
.ai-shimmer-text {
  background: linear-gradient(
    90deg,
    var(--c-text-3) 0%,
    var(--c-text) 35%,
    var(--c-primary) 50%,
    var(--c-text) 65%,
    var(--c-text-3) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: ai-shimmer 2.2s linear infinite;
  letter-spacing: 0.02em;
}
@keyframes ai-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* ── 3 点跳动（ChatGPT typing 风） ── */
.ai-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.ai-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-primary);
  opacity: 0.35;
  animation: ai-dot-bounce 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.ai-dot:nth-child(2) { animation-delay: 0.18s; }
.ai-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes ai-dot-bounce {
  0%,80%,100% { transform: translateY(0); opacity: 0.35; }
  40%         { transform: translateY(-3px); opacity: 1; }
}

/* ════════════ 重跑模态框 ════════════ */
.rerun-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
[data-theme="dark"] .rerun-mask { background: rgba(0, 0, 0, 0.65); }

.rerun-card {
  width: 720px;
  max-width: 100%;
  max-height: 90vh;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.20);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rerun-card-h {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text);
}
.rerun-card-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}
.rerun-close {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--c-text-3);
  cursor: pointer;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rerun-close:hover { background: var(--c-low-bg); color: var(--c-text); }

.rerun-card-b {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.rerun-field-label {
  font-size: 12px;
  color: var(--c-text-2);
  font-weight: 500;
}
.rerun-field-hint {
  margin-left: 4px;
  color: var(--c-text-3);
  font-weight: 400;
}
.rerun-sql {
  width: 100%;
  flex: 1;
  min-height: 220px;
  padding: 10px 12px;
  background: #0d1117;
  color: #d8dee9;
  border: 1px solid #1f2329;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
}
.rerun-sql:focus { border-color: var(--c-primary); }
[data-theme="dark"] .rerun-sql {
  background: #c8ccd2;
  color: #1a1d24;
  border-color: #a8acb3;
}

.rerun-card-f {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--c-border);
  background: var(--c-bg);
}

.rerun-model {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rerun-model-label { font-size: 12px; color: var(--c-text-2); }
/* 模型下拉：原生 select + 自定义 chevron 图标覆盖 */
.rerun-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.rerun-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 6px 28px 6px 10px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--c-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  height: 30px;
  min-width: 132px;
  outline: none;
}
.rerun-select:hover { border-color: var(--c-text-3); }
.rerun-select:focus { border-color: var(--c-primary); }
.rerun-select-chev {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--c-text-3);
}

.rerun-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* 模态框进出动画 */
.rerun-modal-enter-active,
.rerun-modal-leave-active {
  transition: opacity 0.18s ease;
}
.rerun-modal-enter-active .rerun-card,
.rerun-modal-leave-active .rerun-card {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.rerun-modal-enter-from,
.rerun-modal-leave-to { opacity: 0; }
.rerun-modal-enter-from .rerun-card,
.rerun-modal-leave-to .rerun-card {
  transform: translateY(-8px) scale(0.98);
  opacity: 0;
}
</style>
