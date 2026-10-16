<template>
  <div class="transaction-card" :class="{ expanded: isExpanded }">
    <!-- 卡片头部 -->
    <div class="card-header" @click="toggleExpand">
      <div class="card-expand-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          :style="{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }">
          <path d="M6 4L10 8L6 12" stroke="#8C94A6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="card-main">
        <div class="card-title-row">
          <span class="tx-code">{{ transaction.id }}</span>
          <span class="tx-name">{{ transaction.name }}</span>
        </div>
        <div class="card-meta">
          <span class="meta-badge service">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
              <path d="M3.5 6h5M3.5 4h5M3.5 8h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            {{ transaction.serviceCount }} 服务
          </span>
          <span class="meta-badge component">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5L10.5 4V8L6 10.5L1.5 8V4L6 1.5z" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            {{ transaction.componentCount }} 构件
          </span>
          <span class="meta-badge table">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M1 4.5h10M1 7.5h10M4.5 1v10" stroke="currentColor" stroke-width="1.2"/>
            </svg>
            {{ transaction.tableCount }} 表
          </span>
          <span class="meta-badge error-code"
                v-if="transaction.errorCodeCount > 0"
                @click.stop>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
            {{ transaction.errorCodeCount }} 错误码
          </span>
        </div>
      </div>
      <div class="card-right">
        <span class="domain-tag">{{ transaction.domain }}</span>
        <span class="layer-badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1.5L10.5 3.5L6 5.5L1.5 3.5L6 1.5z" stroke="currentColor" stroke-width="1.2"/>
            <path d="M1.5 6L6 8L10.5 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M1.5 8.5L6 10.5L10.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          {{ transaction.layers }}层
        </span>
        <button v-if="isExpanded" class="fullscreen-btn" title="全屏展示" @click.stop="openFullscreen">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.5 5V2H4.5M9.5 2H12.5V5M12.5 9V12H9.5M4.5 12H1.5V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="fullscreen-btn error-code-export-btn"
                v-if="isExpanded && transaction.errorCodeCount > 0"
                @click.stop="downloadErrorCodes"
                title="下载本交易错误码">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 全屏遮罩 -->
    <Teleport to="body">
      <div v-if="isFullscreen" class="fs-backdrop" @click.self="closeFullscreen"/>
    </Teleport>

    <!-- API 测试弹窗 -->
    <ApiTester
      :visible="apiTester.visible"
      :tx-code="apiTester.txCode"
      :tx-name="apiTester.txName"
      :is-dark="isDark"
      @close="apiTester.visible = false"
    />

    <!-- 代码查看弹窗（Monaco Editor）
         使用 v-show 而非 v-if：组件常驻 DOM，关闭时只隐藏不销毁，
         保留 Monaco 的 openTabs 状态，再次打开时标签页仍在。 -->
    <Teleport to="body">
      <div v-show="codeViewer.visible"
           class="code-modal-backdrop"
           :class="{
             'code-modal-backdrop-fs': codeViewer.fullscreen,
             'code-modal-backdrop-drawer-right': codeViewer.drawerVisible && !codeViewer.fullscreen && codeViewer.drawerPlacement === 'external-right',
             'code-modal-backdrop-ai-fullscreen': codeViewer.drawerVisible && codeViewer.drawerPlacement === 'fullscreen',
           }"
           :style="{ '--code-modal-reserved-width': `${codeViewer.drawerReservedWidth || 0}px` }"
           @click.self="!codeViewer.fullscreen && codeViewer.drawerPlacement !== 'fullscreen' && closeCodeViewer()">
        <div
          class="code-modal monaco-modal"
          :class="{
            'monaco-modal-fs': codeViewer.fullscreen,
            'monaco-modal-external-right': codeViewer.drawerVisible && !codeViewer.fullscreen && codeViewer.drawerPlacement === 'external-right',
            'monaco-modal-ai-background': codeViewer.drawerVisible && codeViewer.drawerPlacement === 'fullscreen',
            'monaco-modal-ai-hidden': codeViewer.drawerVisible && codeViewer.drawerPlacement === 'fullscreen',
          }"
          :style="{ '--code-modal-reserved-width': `${codeViewer.drawerReservedWidth || 0}px` }"
        >
          <!-- Monaco 代码查看器 -->
          <MonacoCodeViewer
            :node="codeViewer.node"
            :transaction="transaction"
            :file-path="codeViewer.filePath"
            :method-name="codeViewer.methodName"
            :locate-text="codeViewer.locateText"
            :line-no="codeViewer.lineNo"
            :is-dark="isDark"
            :parent-loading="codeViewer.loading"
            :modal-shift="codeViewer.drawerReservedWidth"
            :visible="codeViewer.visible"
            @close="closeCodeViewer"
            @fullscreen-change="handleCodeViewerFullscreenChange"
            @drawer-layout-change="updateCodeViewerDrawer"
          />


        </div>
      </div>
    </Teleport>

    <!-- 链路图：v-if 确保收起时 DOM 彻底销毁，不占内存 -->
    <div v-if="isExpanded" class="chain-view" :class="{ 'chain-view-fullscreen': isFullscreen }">
      <!-- 选中信息栏 / 提示栏 -->
      <div v-if="hasSelection" class="selection-bar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="#4F7CFF" stroke-width="1.3"/>
          <path d="M4.5 7l2 2 3-3" stroke="#4F7CFF" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="selection-text">{{ selectionSummary }}</span>
        <button class="reset-btn" @click.stop="resetSelection">重置</button>
      </div>
      <div v-else class="chain-hint">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="#8C94A6" stroke-width="1.2"/>
          <path d="M6.5 4v3l2 1.5" stroke="#8C94A6" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        点击服务层或构件层节点进行关联筛选
      </div>

      <!-- 工具栏 -->
      <div class="chain-toolbar">
        <div v-if="isFullscreen" class="fs-title-bar">
          <span class="tx-code" style="font-family:monospace;">{{ transaction.id }}</span>
          <span style="font-size:14px;font-weight:600;color:#1F2937;">{{ transaction.name }}</span>
          <span class="domain-tag" style="margin-left:4px;">{{ transaction.domain }}</span>
        </div>
        <div v-else class="zoom-hint">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5h9M6.5 2v9" stroke="#8C94A6" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Ctrl + 滚轮缩放
        </div>
        <div class="toolbar-right">
          <div class="ai-toolbar-actions">
            <button
              class="ai-toolbar-btn"
              :class="{ active: aiAnalysis.visible }"
              :disabled="aiAnalysis.loading"
              @click.stop="toggleAiPanel"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1.5L7.6 4.4L10.5 5.5L7.6 6.6L6.5 9.5L5.4 6.6L2.5 5.5L5.4 4.4L6.5 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M10.5 1.8L10.9 2.8L11.9 3.2L10.9 3.6L10.5 4.6L10.1 3.6L9.1 3.2L10.1 2.8L10.5 1.8z" fill="currentColor"/>
              </svg>
              {{ analysisButtonLabel }}
            </button>
            <button
              v-if="aiAnalysis.visible"
              class="ai-toolbar-btn secondary"
              :disabled="aiAnalysis.loading"
              @click.stop="runAiAnalysis(true)"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M10.8 5.2A4.8 4.8 0 1 0 11 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M8.9 2.5H11.2V4.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              刷新
            </button>
          </div>
          <div class="zoom-controls">
            <button class="zoom-btn" @click.stop="zoomOut">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="zoom-value">{{ Math.round(scale * 100) }}%</span>
            <button class="zoom-btn" @click.stop="zoomIn">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <!-- 适应宽度 -->
          <button class="zoom-btn" title="适应宽度" @click.stop="fitToWidth().then(recalcAll)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M1 7l3-3M1 7l3 3M13 7l-3-3M13 7l-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button v-if="isFullscreen" class="zoom-btn fs-close-btn" @click.stop="closeFullscreen">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 5.5H4.5V2.5M9.5 2.5V5.5H12.5M12.5 8.5H9.5V11.5M4.5 11.5V8.5H1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="aiAnalysis.visible" class="analysis-panel">
        <div class="analysis-panel-header">
          <div class="analysis-panel-title-group">
            <div class="analysis-panel-title-row">
              <span class="analysis-panel-title">AI 解读</span>
              <span v-if="aiAnalysis.result?.cached" class="analysis-status-tag cached">缓存结果</span>
              <span v-if="isAnalysisStale" class="analysis-status-tag stale">路径已变化</span>
            </div>
            <span class="analysis-panel-scope">{{ analysisScopeLabel }}</span>
          </div>
          <button class="analysis-close-btn" @click.stop="aiAnalysis.visible = false">收起</button>
        </div>

        <div v-if="aiAnalysis.loading" class="analysis-loading">
          <div class="analysis-loading-spinner"/>
          <div class="analysis-loading-text">
            <span class="analysis-loading-title">正在生成解读</span>
            <span class="analysis-loading-sub">会结合当前交易链路、选中路径和关键代码片段进行分析</span>
          </div>
        </div>

        <div v-else-if="aiAnalysis.error" class="analysis-error-card">
          <div>
            <div class="analysis-error-title">AI 解读失败</div>
            <div class="analysis-error-detail">{{ aiAnalysis.error }}</div>
          </div>
        </div>

        <div v-else-if="aiAnalysis.result" class="analysis-content">
          <div class="analysis-stats">
            <div v-for="stat in analysisStats" :key="stat.label" class="analysis-stat-chip">
              <span class="analysis-stat-label">{{ stat.label }}</span>
              <span class="analysis-stat-value">{{ stat.value }}</span>
            </div>
          </div>

          <div class="analysis-section-grid">
            <section class="analysis-section-card">
              <div class="analysis-section-title">总览</div>
              <div class="analysis-section-text">{{ analysisSummaryText || '暂无总览内容' }}</div>
            </section>

            <section class="analysis-section-card">
              <div class="analysis-section-title">业务解读</div>
              <div class="analysis-section-text">{{ analysisBusinessText || '暂无业务解读内容' }}</div>
            </section>

            <section class="analysis-section-card">
              <div class="analysis-section-title">技术检查</div>
              <div class="analysis-section-text">{{ analysisTechnicalText || '暂无技术检查内容' }}</div>
            </section>
          </div>

          <section v-if="analysisFindings.length" class="analysis-section-card">
            <div class="analysis-section-title">规则发现</div>
            <div class="analysis-finding-list">
              <article v-for="item in analysisFindings" :key="`${item.key}-${item.title}`" class="analysis-finding-item">
                <div class="analysis-finding-head">
                  <span class="analysis-severity-chip" :class="findingSeverityClass(item.severity)">
                    {{ item.severity || 'INFO' }}
                  </span>
                  <span class="analysis-finding-title">{{ item.title || item.key }}</span>
                </div>
                <div v-if="item.detail" class="analysis-finding-detail">{{ item.detail }}</div>
                <div v-if="item.evidence" class="analysis-finding-evidence">{{ item.evidence }}</div>
              </article>
            </div>
          </section>

          <section v-if="analysisSnippets.length" class="analysis-section-card">
            <div class="analysis-section-title">关联代码片段</div>
            <div class="analysis-snippet-list">
              <article
                v-for="snippet in analysisSnippets.slice(0, 3)"
                :key="`${snippet.nodeCode}-${snippet.methodName}-${snippet.startLine}`"
                class="analysis-snippet-item"
              >
                <div class="analysis-snippet-head">
                  <span class="analysis-snippet-node">{{ snippet.nodeCode || '未命名节点' }}</span>
                  <span class="analysis-snippet-method">{{ snippet.methodName || '代码片段' }}</span>
                </div>
                <div class="analysis-snippet-path">{{ snippet.filePath }}</div>
                <div v-if="snippet.startLine > 0 && snippet.endLine > 0" class="analysis-snippet-range">
                  第 {{ snippet.startLine }} - {{ snippet.endLine }} 行
                </div>
                <pre class="analysis-snippet-preview">{{ snippetPreview(snippet.content) }}</pre>
              </article>
            </div>
          </section>
        </div>
      </div>

      <!-- 链路画布 -->
      <div ref="chainCanvasEl" class="chain-canvas"
        :style="canvasHeight ? { height: canvasHeight + 'px' } : {}"
        @wheel.prevent="handleWheel" @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag">
        <div ref="chainContentEl" class="chain-content"
          :style="{ transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`, transformOrigin: 'top left' }">

          <!-- SVG 贝塞尔曲线 -->
          <svg class="chain-curves-svg" :width="svgSize.w" :height="svgSize.h">
            <defs>
              <marker id="arrow-marker" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#C5CBD7"/>
              </marker>
            </defs>
            <path v-for="(c,i) in svgCurves" :key="i" :d="c.d" stroke="#C5CBD7" stroke-width="1.5" fill="none" marker-end="url(#arrow-marker)"/>
          </svg>

          <!-- 交易层 -->
          <div class="chain-layer" data-layer="orchestration">
            <div class="layer-header orchestration" @click.stop="toggleLayer('orchestration')">
              <span class="layer-title">交易层</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                :style="{ transform: collapsedLayers.orchestration ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }">
                <path d="M3.5 5.5L7 9L10.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div v-show="!collapsedLayers.orchestration" class="layer-nodes">
              <div v-for="node in transaction.chain.orchestration" :key="node.code" class="chain-node orchestration-node">
                <div class="node-first-row">
                  <span class="node-code">{{ node.code }}</span>
                  <button class="code-view-btn test-btn" @click.stop="openApiTester(node)" title="报文测试">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 3h8M2 6h5.5M2 9h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      <circle cx="9.5" cy="9" r="2" stroke="#4F7CFF" stroke-width="1.2"/>
                      <path d="M9.5 8v1.2M9.5 10.4v.1" stroke="#4F7CFF" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button class="code-view-btn" @click.stop="openCodeViewer(node, 'orchestration')" title="查看代码">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
                <span class="node-name">{{ node.name }}</span>
              </div>
            </div>
          </div>

          <!-- 服务层 -->
          <div class="chain-layer" data-layer="service">
            <div class="layer-header service" @click.stop="toggleLayer('service')">
              <span class="layer-title">服务层</span>
              <div class="layer-header-right">
                <span v-if="activePath.service && hasSvcToSvc && activeCalledServices.length" class="layer-badge-count">
                  {{ activeCalledServices.length }}/{{ calledServices.length }}
                </span>
                <span class="layer-click-hint">点击筛选</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  :style="{ transform: collapsedLayers.service ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }">
                  <path d="M3.5 5.5L7 9L10.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>

            <div v-show="!collapsedLayers.service" ref="serviceLayerRef" class="svc-inner-canvas">
              <!-- pcs→pbs 调用箭头 SVG -->
              <svg v-if="serviceCallArrows.length" class="service-call-svg" :width="serviceCallSvgSize.w" :height="serviceCallSvgSize.h">
                <defs>
                  <marker id="svc-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#C5CBD7"/>
                  </marker>
                </defs>
                <path v-for="(a,i) in serviceCallArrows" :key="i" :d="a.d" stroke="#C5CBD7" stroke-width="1.5" fill="none" marker-end="url(#svc-arrow)"/>
              </svg>

              <!-- 流程编排子层 -->
              <div class="svc-inner-layer pbs-inner-layer">
                <div class="svc-inner-header">
                  <span class="svc-inner-title">流程编排</span>
                </div>
                <div class="svc-inner-nodes">
                  <template v-for="node in orchestrationServices" :key="node.code">
                    <!-- 服务节点 -->
                    <div :data-scode="node.code" class="chain-node service-node"
                      :class="{ 'node-selected': selectedServices.has(node.code) }"
                      @click.stop="selectOrchService(node.code)">
                      <div class="node-header">
                        <span class="node-prefix" :class="`prefix-${node.prefix}`">{{ node.prefix }}</span>
                        <span class="node-code-service">{{ node.code }}</span>
                        <div class="node-header-actions">
                          <svg v-if="selectedServices.has(node.code)" class="node-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="6" fill="#12B886"/>
                            <path d="M4 7l2.5 2.5 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          <button class="code-view-btn" @click.stop="openCodeViewer(node, 'service')" title="查看代码">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                              <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                              <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <span class="node-name">{{ node.name }}</span>
                      <span v-if="isCrossDomain(node)" class="cross-domain-tag"
                        :style="{ background: domainStyle(node.domain).bg, color: domainStyle(node.domain).color, border: `1px solid ${domainStyle(node.domain).border}` }">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                        {{ node.domain }}
                      </span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- 编码调用子层 -->
              <div v-if="hasSvcToSvc && activeCalledServices.length" class="svc-inner-layer pcs-inner-layer">
                <div class="svc-inner-header">
                  <span class="svc-inner-title">编码调用</span>
                  <span class="layer-badge-count" style="font-size:10px;padding:1px 6px;">
                    直接 {{ callTreeRoots.length }} · 共 {{ activeCalledServices.length }}
                  </span>
                </div>
                <div class="svc-inner-nodes">
                  <div v-for="(item, idx) in visibleCallNodes" :key="idx" :data-scode="item.node.code"
                    class="chain-node service-node pcs-service-node"
                    :class="{ 'node-selected': selectedServices.has(item.node.code) }"
                    :style="{ marginLeft: (item.depth * 18) + 'px' }"
                    @click.stop="selectCalledSvc(item.node.code)">
                    <div class="node-header">
                      <button v-if="item.childCount" class="svc-expand-btn" @click.stop="toggleCallExpand(item.node.code)"
                        :title="expandedCalls.has(item.node.code) ? '收起' : '展开'">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                          :style="{ transform: expandedCalls.has(item.node.code) ? 'rotate(90deg)' : 'none' }">
                          <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                      <span class="node-prefix" :class="`prefix-${item.node.prefix}`">{{ item.node.prefix }}</span>
                      <span class="node-code-service">{{ item.node.code }}</span>
                      <div class="node-header-actions">
                        <span v-if="item.childCount" class="svc-child-count">调 {{ item.childCount }}</span>
                        <svg v-if="selectedServices.has(item.node.code)" class="node-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" fill="#12B886"/>
                          <path d="M4 7l2.5 2.5 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <button class="code-view-btn" @click.stop="openCodeViewer(item.node, 'service')" title="查看代码">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span class="node-name">{{ item.node.name }}</span>
                    <span v-if="isCrossDomain(item.node)" class="cross-domain-tag"
                      :style="{ background: domainStyle(item.node.domain).bg, color: domainStyle(item.node.domain).color, border: `1px solid ${domainStyle(item.node.domain).border}` }">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      {{ item.node.domain }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 构件层（双子框：业务/产品构件 + 公共/技术构件） -->
          <div class="chain-layer" data-layer="component">
            <div class="layer-header component" @click.stop="toggleLayer('component')">
              <span class="layer-title">构件层</span>
              <div class="layer-header-right">
                <span v-if="activePath.service || activePath.calledSvc" class="layer-badge-count">
                  {{ visibleBizCompCount + visibleTechCompCount }}/{{ transaction.chain.component.length }}
                </span>
                <span class="layer-click-hint">点击筛选</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  :style="{ transform: collapsedLayers.component ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }">
                  <path d="M3.5 5.5L7 9L10.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>

            <!-- 构件层内嵌双子框 -->
            <div v-show="!collapsedLayers.component" ref="compLayerRef" class="svc-inner-canvas">
              <!-- 构件间调用箭头 SVG -->
              <svg v-if="compCallArrows.length" class="service-call-svg"
                :width="compCallSvgSize.w" :height="compCallSvgSize.h">
                <defs>
                  <marker id="comp-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#C5CBD7"/>
                  </marker>
                </defs>
                <path v-for="(a,i) in compCallArrows" :key="i" :d="a.d"
                  stroke="#C5CBD7" stroke-width="1.5" fill="none" marker-end="url(#comp-arrow)"/>
              </svg>

              <!-- 左子框：业务/产品构件（pbcb/pbcp），无可见构件时隐藏 -->
              <div v-if="visibleBizComps.length" class="svc-inner-layer comp-biz-layer">
                <div class="svc-inner-header" style="border-top-color:#F76707;background:linear-gradient(to bottom,rgba(247,103,7,0.05),transparent)">
                  <span class="svc-inner-title">业务/产品构件</span>
                  <span v-if="activePath.bizComp" class="layer-badge-count" style="background:#F76707;">
                    1/{{ bizComps.length }}
                  </span>
                </div>
                <div class="svc-inner-nodes">
                  <div v-for="node in visibleBizComps" :key="node.code" :data-ccode="node.code"
                    class="chain-node component-node"
                    :class="{ 'node-selected': activePath.bizComp === node.code }"
                    @click.stop="selectBizComp(node.code)">
                    <div class="node-header">
                      <span class="node-prefix" :class="`prefix-${node.prefix}`">{{ node.prefix }}</span>
                      <span class="node-code-service">{{ node.code }}</span>
                      <div class="node-header-actions">
                        <svg v-if="activePath.bizComp === node.code" class="node-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" fill="#F76707"/>
                          <path d="M4 7l2.5 2.5 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <button class="code-view-btn" @click.stop="openCodeViewer(node, 'component')" title="查看代码">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span class="node-name">{{ node.name }}</span>
                    <span v-if="isCrossDomain(node)" class="cross-domain-tag"
                      :style="{ background: domainStyle(node.domain).bg, color: domainStyle(node.domain).color, border: `1px solid ${domainStyle(node.domain).border}` }">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      {{ node.domain }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 右子框：公共/技术构件（pbcc/pbct），无可见构件时隐藏 -->
              <div v-if="visibleTechComps.length" class="svc-inner-layer comp-tech-layer">
                <div class="svc-inner-header" style="border-top-color:#7950F2;background:linear-gradient(to bottom,rgba(121,80,242,0.05),transparent)">
                  <span class="svc-inner-title">公共/技术构件</span>
                  <span v-if="activePath.techComp" class="layer-badge-count" style="background:#7950F2;">
                    1/{{ techComps.length }}
                  </span>
                </div>
                <div class="svc-inner-nodes">
                  <div v-for="node in visibleTechComps" :key="node.code" :data-ccode="node.code"
                    class="chain-node component-node"
                    :class="{ 'node-selected': activePath.techComp === node.code }"
                    @click.stop="selectTechComp(node.code)">
                    <div class="node-header">
                      <span class="node-prefix" :class="`prefix-${node.prefix}`">{{ node.prefix }}</span>
                      <span class="node-code-service">{{ node.code }}</span>
                      <div class="node-header-actions">
                        <svg v-if="activePath.techComp === node.code" class="node-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" fill="#7950F2"/>
                          <path d="M4 7l2.5 2.5 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <button class="code-view-btn" @click.stop="openCodeViewer(node, 'component')" title="查看代码">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span class="node-name">{{ node.name }}</span>
                    <span v-if="isCrossDomain(node)" class="cross-domain-tag"
                      :style="{ background: domainStyle(node.domain).bg, color: domainStyle(node.domain).color, border: `1px solid ${domainStyle(node.domain).border}` }">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                      {{ node.domain }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 数据层 -->
          <div class="chain-layer" data-layer="data">
            <div class="layer-header data" @click.stop="toggleLayer('data')">
              <span class="layer-title">数据层</span>
              <div class="layer-header-right">
                <span v-if="activePath.techComp || activePath.bizComp || activePath.calledSvc || activePath.service" class="layer-badge-count data-badge">
                  {{ visibleTableCount }}/{{ tableNodes.length }}
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                  :style="{ transform: collapsedLayers.data ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }">
                  <path d="M3.5 5.5L7 9L10.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
            <div v-show="!collapsedLayers.data" class="layer-nodes data-panels">
              <div class="data-sub-layer data-panel data-panel-table">
                <div class="data-sub-header">
                  <span class="data-sub-title">Table层</span>
                  <span class="data-sub-count">{{ visibleTableCount }}/{{ tableNodes.length }}</span>
                </div>
                <div class="data-sub-nodes">
                  <div
                    v-for="node in visibleTableList"
                    :key="node.code"
                    class="chain-node data-node table-node"
                    :class="{ 'node-selected': activeTable === node.code }"
                    @click.stop="selectTable(node.code)"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="#7950F2" stroke-width="1.3"/>
                      <path d="M1.5 5h11M1.5 9h11M5 1.5v11" stroke="#7950F2" stroke-width="1.3"/>
                    </svg>
                    <div class="data-node-body">
                      <span class="node-table-code">{{ node.tableId || node.code }}</span>
                      <div class="table-node-meta">
                        <span class="node-table-name table-node-name-inline">{{ node.tableLongname || node.name }}</span>
                        <span
                          v-if="node.domain"
                          class="cross-domain-tag"
                          :style="{ background: domainStyle(node.domain).bg, color: domainStyle(node.domain).color, border: `1px solid ${domainStyle(node.domain).border}` }"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                          </svg>
                          {{ node.domain }}
                        </span>
                      </div>
                    </div>
                    <div class="data-node-actions">
                      <button class="code-view-btn" @click.stop="openCodeViewer(node, 'table')" title="查看代码">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                      </button>
                      <svg v-if="activeTable === node.code" class="node-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="#7950F2"/>
                        <path d="M4 7l2.5 2.5 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div class="data-sub-layer dao-sub-layer data-panel data-panel-dao">
                <div class="data-sub-header">
                  <span class="data-sub-title">Dao层</span>
                  <span class="data-sub-count">{{ visibleDaoCount }}/{{ daoNodes.length }}</span>
                </div>
                <div class="data-sub-nodes">
                  <div
                    v-for="node in visibleDaoList"
                    :key="node.code"
                    class="chain-node data-node dao-node"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 3.5h9v7h-9z" stroke="#4F7CFF" stroke-width="1.3"/>
                      <path d="M4.5 1.8v3.4M9.5 1.8v3.4M4 8h4" stroke="#4F7CFF" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <div class="data-node-body">
                      <span class="node-table-code">{{ node.methodName || node.name }}</span>
                      <span class="node-table-name">{{ node.daoClassName }}</span>
                    </div>
                    <button class="code-view-btn" @click.stop="openCodeViewer(node, 'dao')" title="查看代码">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M4 2.5L1.5 6 4 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6.5 1.5l-1 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import MonacoCodeViewer from './MonacoCodeViewer.vue'
import ApiTester from './ApiTester.vue'
import { analyzeFlowtranTransaction, getErrorCodes, exportErrorCodes } from '../api/index.js'

const props = defineProps({
  transaction:     { type: Object,  required: true },
  defaultExpanded: { type: Boolean, default: false },
  isDark:          { type: Boolean, default: false }
})

const isExpanded = ref(props.defaultExpanded)
const errorCodeList = ref([])
const isFullscreen = ref(false)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

const collapsedLayers = reactive({ orchestration: false, service: false, component: false, data: false })

const chainContentEl = ref(null)
const chainCanvasEl  = ref(null)
const svgCurves = ref([])
const svgSize = reactive({ w: 0, h: 0 })
const canvasHeight = ref(null)  // 动态高度，消除缩放后的空白

// 根据 scale 重新计算 canvas 高度（transform 不影响 DOM 流，需手动补正）
const updateCanvasHeight = async () => {
  await nextTick()
  const content = chainContentEl.value
  if (!content) { canvasHeight.value = null; return }
  const naturalH = content.scrollHeight
  canvasHeight.value = Math.max(160, Math.ceil(naturalH * scale.value) + 36)
}

const serviceLayerRef = ref(null)
const serviceCallArrows = ref([])
const serviceCallSvgSize = reactive({ w: 0, h: 0 })

const LAYER_ORDER = ['orchestration', 'service', 'component', 'data']

// ---- 跨领域标签 ----
const DOMAIN_COLORS = {
  '公共领域': { bg: '#EEF3FF', color: '#3B5ADB', border: '#C5D5FF' },
  '贷款领域': { bg: '#FFF4E6', color: '#E67700', border: '#FFD8A8' },
  '存款领域': { bg: '#E6FCF5', color: '#087F5B', border: '#96F2D7' },
  '结算领域': { bg: '#F3F0FF', color: '#5F3DC4', border: '#B197FC' },
}
const domainStyle = (d) => DOMAIN_COLORS[d] || { bg: '#F3F4F6', color: '#374151', border: '#D1D5DB' }
const isCrossDomain = (node) => node.domain && node.domain !== props.transaction.domain

const relations = computed(() => props.transaction.chain.relations || {
  rootServices: [],
  serviceToService: {},
  serviceToComponent: {},
  componentToComponent: {},
  nodeToTable: {},
  tableToDao: {}
})

const hasSvcToSvc = computed(() => Object.keys(relations.value.serviceToService || {}).length > 0)

// ---- 构件层分类 ----
const BIZ_PREFIXES  = new Set(['pbcb', 'pbcp'])   // 业务/产品构件
const TECH_PREFIXES = new Set(['pbcc', 'pbct'])   // 公共/技术构件

const bizComps  = computed(() => props.transaction.chain.component.filter(c => BIZ_PREFIXES.has(c.prefix)))
const techComps = computed(() => props.transaction.chain.component.filter(c => TECH_PREFIXES.has(c.prefix)))

// 构件间调用关系（pbcb/pbcp → pbcc/pbct）
const compCallSvgRef = ref(null)
const compLayerRef   = ref(null)
const compCallArrows = ref([])
const compCallSvgSize = reactive({ w: 0, h: 0 })

const serviceNodeMap = computed(() =>
  new Map((props.transaction.chain.service || []).map(node => [node.code, node]))
)
const componentNodeMap = computed(() =>
  new Map((props.transaction.chain.component || []).map(node => [node.code, node]))
)

const serviceToServiceMap = computed(() => relations.value.serviceToService || {})
const serviceToComponentMap = computed(() => relations.value.serviceToComponent || {})
const componentToComponentMap = computed(() => relations.value.componentToComponent || {})
const componentParentMap = computed(() => {
  const reverse = {}
  Object.entries(componentToComponentMap.value || {}).forEach(([parentCode, children]) => {
    ;(children || []).forEach(childCode => {
      if (!reverse[childCode]) reverse[childCode] = []
      if (!reverse[childCode].includes(parentCode)) reverse[childCode].push(parentCode)
    })
  })
  return reverse
})
const nodeToTableMap = computed(() => relations.value.nodeToTable || {})
const tableToDaoMap = computed(() => relations.value.tableToDao || {})
const dataLayers = computed(() => {
  const data = props.transaction.chain.data
  if (Array.isArray(data)) {
    return { table: data, dao: [] }
  }
  return {
    table: data?.table || [],
    dao: data?.dao || [],
  }
})
const tableNodes = computed(() => dataLayers.value.table)
const daoNodes = computed(() => dataLayers.value.dao)

// ======== 服务路径下钻（serviceTrail）+ 构件层级下钻 ========
const activePath = reactive({ serviceTrail: [], bizComp: null, techComp: null })
const activeTable = ref(null)
Object.defineProperty(activePath, 'service', {
  get: () => activePath.serviceTrail[0] || null,
  enumerable: false
})
Object.defineProperty(activePath, 'calledSvc', {
  get: () => activePath.serviceTrail.length ? activePath.serviceTrail[activePath.serviceTrail.length - 1] : null,
  enumerable: false
})
Object.defineProperty(activePath, 'component', {
  get: () => activePath.bizComp || activePath.techComp,
  enumerable: false
})

const calledByCodes = computed(() => {
  const set = new Set()
  Object.values(serviceToServiceMap.value).forEach(list => (list || []).forEach(code => set.add(code)))
  return set
})

const rootServiceCodes = computed(() => {
  const configured = new Set(relations.value.rootServices || [])
  if (configured.size) {
    return configured
  }
  const inferred = new Set()
  ;(props.transaction.chain.service || []).forEach(node => {
    if (!calledByCodes.value.has(node.code)) inferred.add(node.code)
  })
  return inferred
})

const orchestrationServices = computed(() =>
  (props.transaction.chain.service || []).filter(node => rootServiceCodes.value.has(node.code))
)
const calledServices = computed(() =>
  (props.transaction.chain.service || []).filter(node => !rootServiceCodes.value.has(node.code))
)

const selectedServiceCode = computed(() =>
  activePath.serviceTrail.length ? activePath.serviceTrail[activePath.serviceTrail.length - 1] : null
)

const hasSelection = computed(() =>
  activePath.serviceTrail.length > 0 || !!(activePath.bizComp || activePath.techComp)
)

const selectionSummary = computed(() => {
  const parts = activePath.serviceTrail
    .map(code => serviceNodeMap.value.get(code)?.name || code)
  if (activePath.bizComp) {
    parts.push(componentNodeMap.value.get(activePath.bizComp)?.name || activePath.bizComp)
  }
  if (activePath.techComp) {
    parts.push(componentNodeMap.value.get(activePath.techComp)?.name || activePath.techComp)
  }
  return parts.join(' → ')
})

const walkClosure = (startCodes, adjacency) => {
  const visited = new Set()
  const stack = [...startCodes]
  while (stack.length) {
    const code = stack.pop()
    if (!code || visited.has(code)) continue
    visited.add(code)
    ;(adjacency[code] || []).forEach(next => {
      if (!visited.has(next)) stack.push(next)
    })
  }
  return visited
}

const directServiceChildren = (code) => serviceToServiceMap.value[code] || []
const directComponentChildren = (code) => componentToComponentMap.value[code] || []
const directNodeTables = (code) => nodeToTableMap.value[code] || []
const directTableDaos = (code) => tableToDaoMap.value[code] || []

const collectServiceClosure = (startCode, { includeStart = true } = {}) => {
  if (!startCode) return new Set()
  const closure = walkClosure([startCode], serviceToServiceMap.value)
  if (!includeStart) closure.delete(startCode)
  return closure
}

const collectComponentClosure = (startCodes, { includeStart = true } = {}) => {
  const closure = walkClosure(startCodes, componentToComponentMap.value)
  if (!includeStart) {
    startCodes.forEach(code => closure.delete(code))
  }
  return closure
}

const collectComponentAncestors = (startCodes, { includeStart = true } = {}) => {
  const closure = walkClosure(startCodes, componentParentMap.value)
  if (!includeStart) {
    startCodes.forEach(code => closure.delete(code))
  }
  return closure
}

const collectComponentContext = (componentCode) => {
  if (!componentCode) return new Set()
  const context = collectComponentClosure([componentCode])
  collectComponentAncestors([componentCode], { includeStart: false }).forEach(code => context.add(code))
  return context
}

const collectComponentsForService = (serviceCode) => {
  const services = collectServiceClosure(serviceCode)
  const directComponents = new Set()
  services.forEach(code => {
    ;(serviceToComponentMap.value[code] || []).forEach(compCode => directComponents.add(compCode))
  })
  const allComponents = new Set(directComponents)
  collectComponentClosure([...directComponents], { includeStart: false }).forEach(code => allComponents.add(code))
  return allComponents
}

const collectTablesForComponent = (componentCode) => {
  const components = collectComponentClosure([componentCode])
  const tables = new Set()
  components.forEach(code => {
    directNodeTables(code).forEach(table => tables.add(table))
  })
  return tables
}

const collectTablesForService = (serviceCode) => {
  const services = collectServiceClosure(serviceCode)
  const tables = new Set()
  services.forEach(code => {
    directNodeTables(code).forEach(table => tables.add(table))
  })
  collectComponentsForService(serviceCode).forEach(code => {
    directNodeTables(code).forEach(table => tables.add(table))
  })
  return tables
}

// 服务层点击后保留完整服务视图，只联动下游构件/数据层筛选。
const activeCalledServices = computed(() => calledServices.value)

// ── 编码调用「层级树」：按 serviceToService 把编码调用组织成树，默认收起 ──
// pcs 复合服务可展开显示它调用的 pbs；顶层 = 未被本集合内其他服务调用的（父是根服务）。
const expandedCalls = ref(new Set())
const callTreeRoots = computed(() => {
  const calledSet = new Set(activeCalledServices.value.map(n => n.code))
  const childInSet = new Set()
  activeCalledServices.value.forEach(n => {
    ;(serviceToServiceMap.value[n.code] || []).forEach(c => { if (calledSet.has(c)) childInSet.add(c) })
  })
  return activeCalledServices.value.filter(n => !childInSet.has(n.code))
})
// 按展开态做前序遍历，拍平成带 depth/childCount 的可见列表；祖先集去重防环。
const visibleCallNodes = computed(() => {
  const byCode = new Map(activeCalledServices.value.map(n => [n.code, n]))
  const out = []
  const walk = (node, depth, ancestors) => {
    const kids = (serviceToServiceMap.value[node.code] || [])
      .filter(c => byCode.has(c) && !ancestors.has(c))
    out.push({ node, depth, childCount: kids.length })
    if (kids.length && expandedCalls.value.has(node.code)) {
      const nextAnc = new Set(ancestors); nextAnc.add(node.code)
      kids.forEach(c => walk(byCode.get(c), depth + 1, nextAnc))
    }
  }
  callTreeRoots.value.forEach(r => walk(r, 0, new Set([r.code])))
  return out
})
const toggleCallExpand = (code) => {
  const s = new Set(expandedCalls.value)
  s.has(code) ? s.delete(code) : s.add(code)
  expandedCalls.value = s
  // 展开/收起改变了 pcs-inner-layer 高度 → 刷新叠加的 SVG 连线高度
  nextTick(() => { recalcServiceCallArrows() })
}

const visibleComponentCodes = computed(() => {
  if (activePath.techComp) return collectComponentContext(activePath.techComp)
  if (activePath.bizComp) return collectComponentContext(activePath.bizComp)
  if (selectedServiceCode.value) return collectComponentsForService(selectedServiceCode.value)
  return new Set((props.transaction.chain.component || []).map(node => node.code))
})

const showComponent = (code) => visibleComponentCodes.value.has(code)

const visibleBizComps = computed(() =>
  bizComps.value.filter(node => showComponent(node.code))
)

const visibleTechComps = computed(() =>
  techComps.value.filter(node => showComponent(node.code))
)

const visibleBizCompCount  = computed(() => visibleBizComps.value.length)
const visibleTechCompCount = computed(() => visibleTechComps.value.length)

const visibleDataCodes = computed(() => {
  if (activePath.techComp) return collectTablesForComponent(activePath.techComp)
  if (activePath.bizComp) return collectTablesForComponent(activePath.bizComp)
  if (selectedServiceCode.value) return collectTablesForService(selectedServiceCode.value)
  return new Set(tableNodes.value.map(node => node.code))
})

const showTable = (code) => visibleDataCodes.value.has(code)

const visibleDaoCodes = computed(() => {
  const selectedTables = activeTable.value
    ? new Set([activeTable.value])
    : visibleDataCodes.value
  const daoCodes = new Set()
  selectedTables.forEach(code => {
    directTableDaos(code).forEach(daoCode => daoCodes.add(daoCode))
  })
  return daoCodes
})

const showDao = (code) => visibleDaoCodes.value.has(code)
const visibleTableList = computed(() =>
  tableNodes.value.filter(node => showTable(node.code))
)
const visibleDaoList = computed(() =>
  daoNodes.value.filter(node => showDao(node.code))
)

// badge 计数
const visibleComponentCount = computed(() =>
  (props.transaction.chain.component || []).filter(n => showComponent(n.code)).length
)
const visibleTableCount = computed(() =>
  tableNodes.value.filter(n => showTable(n.code)).length
)
const visibleDaoCount = computed(() =>
  daoNodes.value.filter(n => showDao(n.code)).length
)

// ---- 点击处理 ----
const selectOrchService = (code) => {
  if (activePath.serviceTrail.length === 1 && activePath.serviceTrail[0] === code) {
    activePath.serviceTrail = []
  } else {
    activePath.serviceTrail = [code]
  }
  activePath.bizComp = null
  activePath.techComp = null
  activeTable.value = null
  nextTick(() => { recalcCurves(); recalcServiceCallArrows(); recalcCompCallArrows() })
}

const selectCalledSvc = (code) => {
  const trail = [...activePath.serviceTrail]
  const last = trail[trail.length - 1]

  if (!trail.length) {
    activePath.serviceTrail = [code]
  } else if (last === code) {
    activePath.serviceTrail = trail.slice(0, -1)
  } else if (trail.includes(code)) {
    activePath.serviceTrail = trail.slice(0, trail.indexOf(code) + 1)
  } else if (directServiceChildren(last).includes(code)) {
    activePath.serviceTrail = [...trail, code]
  } else {
    activePath.serviceTrail = [code]
  }

  activePath.bizComp = null
  activePath.techComp = null
  activeTable.value = null
  nextTick(() => { recalcCurves(); recalcCompCallArrows() })
}

// 点击业务/产品构件（pbcb/pbcp）→ 设置 bizComp，清除 techComp
const selectBizComp = (code) => {
  activePath.bizComp  = activePath.bizComp === code ? null : code
  activePath.techComp = null
  activeTable.value = null
  nextTick(() => { recalcCurves(); recalcCompCallArrows() })
}

// 点击公共/技术构件（pbcc/pbct）→ 设置 techComp
const selectTechComp = (code) => {
  activePath.techComp = activePath.techComp === code ? null : code
  activeTable.value = null
  nextTick(() => { recalcCurves(); recalcCompCallArrows() })
}

const selectTable = (code) => {
  activeTable.value = activeTable.value === code ? null : code
  nextTick(() => { recalcCurves(); updateCanvasHeight() })
}

// 兼容旧 toggleComponent（现在区分 biz/tech）
const toggleComponent = (code) => {
  const node = props.transaction.chain.component.find(c => c.code === code)
  if (!node) return
  BIZ_PREFIXES.has(node.prefix) ? selectBizComp(code) : selectTechComp(code)
}

const resetSelection = () => {
  activePath.serviceTrail = []
  activePath.bizComp = null
  activePath.techComp  = null
  activeTable.value = null
  nextTick(() => { recalcCurves(); recalcServiceCallArrows(); recalcCompCallArrows() })
}

const selectedServices   = computed(() => new Set(activePath.serviceTrail))
const selectedComponents = computed(() => new Set([activePath.bizComp, activePath.techComp].filter(Boolean)))

const createAnalysisSessionId = () =>
  `tx-${props.transaction.id}-${Math.random().toString(36).slice(2, 10)}`

const aiSessionId = ref(createAnalysisSessionId())
const aiAnalysis = reactive({
  visible: false,
  loading: false,
  error: '',
  result: null,
  requestKey: '',
})

const analysisSelectedPath = computed(() => [
  ...activePath.serviceTrail,
  ...(activePath.bizComp ? [activePath.bizComp] : []),
  ...(activePath.techComp ? [activePath.techComp] : []),
])

const analysisFocus = computed(() =>
  selectionSummary.value || `${props.transaction.id} ${props.transaction.name}`
)

const analysisScopeLabel = computed(() =>
  hasSelection.value ? `当前路径：${selectionSummary.value}` : '当前范围：整笔交易'
)

const currentAnalysisKey = computed(() =>
  JSON.stringify({
    txId: props.transaction.id,
    path: analysisSelectedPath.value,
    focus: analysisFocus.value,
  })
)

const analysisButtonLabel = computed(() => {
  if (aiAnalysis.loading) return '解读中'
  if (aiAnalysis.visible) return '收起解读'
  if (!aiAnalysis.result) return 'AI解读'
  return currentAnalysisKey.value === aiAnalysis.requestKey ? '查看解读' : '更新解读'
})

const isAnalysisStale = computed(() =>
  !!aiAnalysis.result && !!aiAnalysis.requestKey && aiAnalysis.requestKey !== currentAnalysisKey.value
)

const analysisFindings = computed(() => aiAnalysis.result?.findings || [])
const analysisSnippets = computed(() => aiAnalysis.result?.codeSnippets || [])
const analysisStats = computed(() => {
  const stats = aiAnalysis.result?.contextStats || {}
  return [
    { label: '模式', value: stats.mode || aiAnalysis.result?.mode || '--' },
    { label: '模型', value: aiAnalysis.result?.model || stats.model || '--' },
    { label: '片段', value: stats.snippetCount ?? analysisSnippets.value.length },
    { label: '规则', value: stats.findingCount ?? analysisFindings.value.length },
  ]
})

const stripSectionTitle = (text, label) => {
  if (!text) return ''
  const pattern = new RegExp(`^##\\s*${label}\\s*\\n?`, 'i')
  return text.replace(pattern, '').trim()
}

const analysisSummaryText = computed(() =>
  stripSectionTitle(aiAnalysis.result?.summary, '总览')
)
const analysisBusinessText = computed(() =>
  stripSectionTitle(aiAnalysis.result?.businessSummary, '业务解读')
)
const analysisTechnicalText = computed(() =>
  stripSectionTitle(aiAnalysis.result?.technicalSummary, '技术检查')
)

const snippetPreview = (content) => {
  if (!content) return ''
  return content.length <= 320 ? content : `${content.slice(0, 320)}...`
}

const findingSeverityClass = (severity) => {
  const value = (severity || '').toUpperCase()
  if (value === 'HIGH' || value === 'ERROR') return 'severity-high'
  if (value === 'MEDIUM' || value === 'WARN' || value === 'WARNING') return 'severity-medium'
  if (value === 'LOW' || value === 'INFO') return 'severity-low'
  return 'severity-default'
}

const runAiAnalysis = async (forceRefresh = false) => {
  aiAnalysis.visible = true
  aiAnalysis.loading = true
  aiAnalysis.error = ''
  try {
    const result = await analyzeFlowtranTransaction(props.transaction.id, {
      sessionId: aiSessionId.value,
      focus: analysisFocus.value,
      mode: 'FULL',
      includeCode: true,
      forceRefresh,
      maxCodeSnippets: 6,
      selectedPath: analysisSelectedPath.value,
    })
    aiAnalysis.result = result
    aiAnalysis.requestKey = currentAnalysisKey.value
  } catch (error) {
    aiAnalysis.error = error?.message || 'AI 解读失败'
  } finally {
    aiAnalysis.loading = false
  }
}

const toggleAiPanel = async () => {
  if (aiAnalysis.visible) {
    aiAnalysis.visible = false
    return
  }
  if (!aiAnalysis.result || isAnalysisStale.value) {
    await runAiAnalysis(false)
    return
  }
  aiAnalysis.visible = true
}

// 构件层内部调用箭头（bizComp → techComp）
const recalcCompCallArrows = async () => {
  await nextTick()
  await nextTick() // 等待构件子框高度变化完全稳定
  const el = compLayerRef.value
  if (!el) return
  const c2c = relations.value.componentToComponent || {}
  if (!Object.keys(c2c).length) { compCallArrows.value = []; return }
  const s = scale.value
  const containerRect = el.getBoundingClientRect()
  compCallSvgSize.w = el.scrollWidth
  compCallSvgSize.h = el.scrollHeight
  const leftBox  = el.querySelector('.comp-biz-layer')
  const rightBox = el.querySelector('.comp-tech-layer')
  if (!leftBox || !rightBox) { compCallArrows.value = []; return }
  const lr = leftBox.getBoundingClientRect()
  const rr = rightBox.getBoundingClientRect()
  const x1 = (lr.right - containerRect.left) / s
  const y1 = (lr.top + lr.height / 2 - containerRect.top) / s
  const x2 = (rr.left  - containerRect.left) / s
  const y2 = (rr.top + rr.height / 2 - containerRect.top) / s
  const cx = (x2 - x1) * 0.5
  compCallArrows.value = [{ d: `M ${x1} ${y1} C ${x1+cx} ${y1} ${x2-cx} ${y2} ${x2} ${y2}` }]
}

const resolveLayerCurveAnchor = (layerEl, layerName) => {
  if (!layerEl) return null
  const headerEl = layerEl.querySelector('.layer-header')
  if (collapsedLayers[layerName]) {
    return headerEl || layerEl
  }
  if (layerName === 'data') {
    const tablePanel = layerEl.querySelector('.data-panel-table')
    if (tablePanel && tablePanel.offsetParent !== null) {
      return tablePanel
    }
  }
  return layerEl
}

// ---- SVG 曲线计算 ----
const recalcCurves = async () => {
  await nextTick()
  const el = chainContentEl.value
  if (!el) return
  const s = scale.value
  const canvasRect = el.getBoundingClientRect()
  svgSize.w = el.scrollWidth
  svgSize.h = el.scrollHeight
  const curves = []
  for (let i = 0; i < LAYER_ORDER.length - 1; i++) {
    const leftLayerName = LAYER_ORDER[i]
    const rightLayerName = LAYER_ORDER[i + 1]
    const leftLayer  = el.querySelector(`[data-layer="${leftLayerName}"]`)
    const rightLayer = el.querySelector(`[data-layer="${rightLayerName}"]`)
    if (!leftLayer || !rightLayer) continue
    const leftAnchor = resolveLayerCurveAnchor(leftLayer, leftLayerName)
    const rightAnchor = resolveLayerCurveAnchor(rightLayer, rightLayerName)
    const lr = leftAnchor.getBoundingClientRect()
    const rr = rightAnchor.getBoundingClientRect()
    const x1 = (lr.right - canvasRect.left) / s
    const y1 = (lr.top + lr.height / 2 - canvasRect.top) / s
    const x2 = (rr.left  - canvasRect.left) / s
    const y2 = (rr.top + rr.height / 2 - canvasRect.top) / s
    const cx = (x2 - x1) * 0.5
    curves.push({ d: `M ${x1} ${y1} C ${x1+cx} ${y1} ${x2-cx} ${y2} ${x2} ${y2}` })
  }
  svgCurves.value = curves
}

const recalcServiceCallArrows = async () => {
  await nextTick()
  const el = serviceLayerRef.value
  if (!el || !hasSvcToSvc.value) { serviceCallArrows.value = []; return }
  const s = scale.value
  const containerRect = el.getBoundingClientRect()
  serviceCallSvgSize.w = el.scrollWidth
  serviceCallSvgSize.h = el.scrollHeight
  const leftBox  = el.querySelector('.pbs-inner-layer')
  const rightBox = el.querySelector('.pcs-inner-layer')
  if (!leftBox || !rightBox) { serviceCallArrows.value = []; return }
  const lr = leftBox.getBoundingClientRect()
  const rr = rightBox.getBoundingClientRect()
  const x1 = (lr.right - containerRect.left) / s
  const y1 = (lr.top + lr.height / 2 - containerRect.top) / s
  const x2 = (rr.left  - containerRect.left) / s
  const y2 = (rr.top + rr.height / 2 - containerRect.top) / s
  const cx = (x2 - x1) * 0.5
  serviceCallArrows.value = [{ d: `M ${x1} ${y1} C ${x1+cx} ${y1} ${x2-cx} ${y2} ${x2} ${y2}` }]
}

const recalcAll = () => {
  recalcCurves()
  recalcServiceCallArrows()
  recalcCompCallArrows()
  updateCanvasHeight()
}

// 自动适应宽度（内容超出才缩小，否则保持 100%）
const fitToWidth = async () => {
  await nextTick()
  await nextTick()
  const canvas  = chainCanvasEl.value
  const content = chainContentEl.value
  if (!canvas || !content) return
  const canvasW  = canvas.clientWidth - 40
  const contentW = content.scrollWidth
  if (contentW <= 0) return
  const fit = Math.min(1, Math.max(0.3, canvasW / contentW))
  scale.value      = parseFloat(fit.toFixed(2))
  translateX.value = 0
  translateY.value = 0
  await updateCanvasHeight()
}

// 初始化展开：适应宽度 + 绘制连线
const initExpanded = async () => {
  await fitToWidth()
  recalcAll()
}

// 展开时取错误码（零回归：链路已由父级随 props 注入，此处只并行加一个错误码调用）
// 回填徽章计数：固定取 distinctCount（去重错误码数），不是 count、不是 list.length
async function onExpandErrorCodes() {
  try {
    const ec = await getErrorCodes(props.transaction.id)
    props.transaction.errorCodeCount = ec.distinctCount
    errorCodeList.value = ec.list   // 展开明细（若有明细区则渲染）
  } catch (e) {
    // 容错（设计 §4.6）：物化缺表期/网络抖动时静默，徽章保持旧值或 0，不抛红到控制台
  }
}

// 单交易下载
async function downloadErrorCodes() {
  await exportErrorCodes(props.transaction.id)
}

// defaultExpanded=true 时 isExpanded 初始就是 true，watch 不会触发，需 onMounted 处理
onMounted(() => { if (isExpanded.value) { initExpanded(); onExpandErrorCodes() } })

// 后续手动展开时触发
watch(isExpanded, (v) => { if (v) { initExpanded(); onExpandErrorCodes() } })
watch(() => props.transaction.id, () => {
  aiSessionId.value = createAnalysisSessionId()
  Object.assign(aiAnalysis, {
    visible: false,
    loading: false,
    error: '',
    result: null,
    requestKey: '',
  })
})
watch(collapsedLayers, recalcAll, { deep: true })
watch(scale, recalcAll)
watch([translateX, translateY], recalcAll)

const toggleExpand = () => { isExpanded.value = !isExpanded.value }
const toggleLayer  = (layer) => { collapsedLayers[layer] = !collapsedLayers[layer] }
const zoomIn  = () => { scale.value = Math.min(scale.value + 0.1, 2);  updateCanvasHeight() }
const zoomOut = () => { scale.value = Math.max(scale.value - 0.1, 0.3); updateCanvasHeight() }

const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    scale.value = Math.max(0.3, Math.min(2, scale.value + (e.deltaY > 0 ? -0.1 : 0.1)))
    updateCanvasHeight()
  }
}

let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartTX = 0, dragStartTY = 0
const startDrag = (e) => {
  if (e.button !== 0) return
  isDragging = true
  dragStartX = e.clientX; dragStartY = e.clientY
  dragStartTX = translateX.value; dragStartTY = translateY.value
}
const onDrag = (e) => {
  if (!isDragging) return
  translateX.value = dragStartTX + (e.clientX - dragStartX) / scale.value
  translateY.value = dragStartTY + (e.clientY - dragStartY) / scale.value
}
const endDrag = () => { isDragging = false }

const openFullscreen = () => {
  isFullscreen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => { recalcCurves(); recalcServiceCallArrows() })
}
const closeFullscreen = () => {
  isFullscreen.value = false
  document.body.style.overflow = ''
  nextTick(() => { recalcCurves(); recalcServiceCallArrows() })
}

// ======== 代码查看（增强版：全类展示 + 内部方法跳转 + 多标签导航） ========
const codeViewer = reactive({
  visible: false, node: null, nodeType: '', copied: false,
  noSource: false, loading: false,
  toast: '', filePath: '', methodName: '', locateText: '', lineNo: 0,
  fullscreen: false,
  drawerVisible: false, drawerPlacement: 'hidden', drawerShift: 0, drawerWidth: 0, drawerReservedWidth: 0,
})

// ── API 测试弹窗状态 ──
const apiTester = reactive({ visible: false, txCode: '', txName: '' })

const openApiTester = (node) => {
  apiTester.txCode  = node.code || props.transaction.id
  apiTester.txName  = node.name || props.transaction.name
  apiTester.visible = true
}

// 已加载节点路径缓存：node.code → filePath
// 跨关闭/打开保留，避免重复发起网络请求；切换到其他交易卡片时自然随组件销毁
const nodePathCache = new Map()
// 按真实交易和节点解析源码位置，由后端统一处理服务、构件、DAO 和表。
const openCodeViewer = async (node, nodeType) => {
  Object.assign(codeViewer, {
    visible: true, node, nodeType, noSource: false, loading: true,
    toast: '', filePath: '', methodName: '', locateText: '', lineNo: 0,
    drawerVisible: false, drawerPlacement: 'hidden', drawerShift: 0,
    drawerWidth: 0, drawerReservedWidth: 0,
  })
  const cacheKey = `${props.transaction.id}|${nodeType}|${node?.prefix || ''}|${node.code}`
  const cached = nodePathCache.get(cacheKey)
  if (cached) {
    Object.assign(codeViewer, cached, { loading: false })
    return
  }
  try {
    const params = new URLSearchParams({
      txId: props.transaction.id,
      nodeCode: node.code,
      nodeType,
      nodePrefix: node?.prefix || '',
    })
    const res = await fetch(`/api/source/resolve/flow?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data || typeof data.filePath !== 'string' || !data.filePath.trim()) {
      throw new Error('未找到节点源码路径')
    }
    const resolved = {
      filePath: data.filePath,
      methodName: data.methodName || '',
      locateText: data.locateText || '',
      lineNo: data.lineNo || 0,
    }
    nodePathCache.set(cacheKey, resolved)
    Object.assign(codeViewer, resolved, { loading: false })
  } catch {
    Object.assign(codeViewer, { noSource: true, loading: false })
  }
}

const updateCodeViewerDrawer = (layout = {}) => {
  codeViewer.drawerVisible = !!layout.visible
  codeViewer.drawerPlacement = layout.placement || 'hidden'
  codeViewer.drawerWidth = layout.visible ? Math.max(0, Number(layout.width) || 0) : 0
  codeViewer.drawerReservedWidth = layout.visible && !codeViewer.fullscreen && layout.placement === 'external-right'
    ? codeViewer.drawerWidth + 20
    : 0
  codeViewer.drawerShift = layout.visible && !codeViewer.fullscreen
    ? Math.max(0, Number(layout.modalShift) || 0)
    : 0
}

const handleCodeViewerFullscreenChange = (value) => {
  codeViewer.fullscreen = !!value
  if (codeViewer.fullscreen) {
    codeViewer.drawerShift = 0
    codeViewer.drawerReservedWidth = 0
  } else if (codeViewer.drawerVisible && codeViewer.drawerPlacement === 'external-right') {
    codeViewer.drawerReservedWidth = codeViewer.drawerWidth + 20
  }
}

const closeCodeViewer = () => {
  codeViewer.visible    = false
  codeViewer.fullscreen = false
  codeViewer.lineNo = 0
  codeViewer.drawerVisible = false
  codeViewer.drawerPlacement = 'hidden'
  codeViewer.drawerShift = 0
  codeViewer.drawerWidth = 0
  codeViewer.drawerReservedWidth = 0
}

defineExpose({
  isExpanded,
  expand:   () => { isExpanded.value = true },
  collapse: () => { if (isFullscreen.value) closeFullscreen(); isExpanded.value = false }
})
</script>

<style scoped>
.transaction-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  overflow: clip;
  transition: box-shadow 0.2s, background 0.3s, border-color 0.3s;
}
.transaction-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
.transaction-card.expanded { box-shadow: 0 4px 20px rgba(0,0,0,0.15); }

/* 卡片头部 */
.card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; cursor: pointer; transition: background 0.15s;
}
.card-header:hover { background: var(--card-hover-bg); }
.card-expand-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.card-main { flex: 1; min-width: 0; }
.card-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.tx-code { font-size: 12px; font-weight: 600; color: #4F7CFF; background: rgba(79,124,255,0.1); padding: 2px 8px; border-radius: 4px; font-family: 'SF Mono','Fira Code',monospace; flex-shrink: 0; }
.tx-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.card-meta { display: flex; align-items: center; gap: 8px; }
.meta-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 12px; }
.meta-badge.service   { background: rgba(79,124,255,0.1);  color: #4F7CFF; }
.meta-badge.component { background: rgba(247,103,7,0.1);   color: #F76707; }
.meta-badge.table     { background: rgba(18,184,134,0.1);  color: #12B886; }
.meta-badge.error-code {
  background: var(--c-error-code-bg);
  color: var(--c-error-code-text);
}
.card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.domain-tag { font-size: 11px; color: var(--text-muted); background: var(--bg-badge); padding: 2px 8px; border-radius: 4px; }
.layer-badge { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #7950F2; background: rgba(121,80,242,0.1); padding: 2px 8px; border-radius: 4px; font-weight: 500; }
.fullscreen-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--card-border); border-radius: 5px; cursor: pointer; color: var(--text-faint); flex-shrink: 0; transition: all 0.15s; }
.fullscreen-btn:hover { background: rgba(79,124,255,0.1); color: #4F7CFF; border-color: rgba(79,124,255,0.3); }

/* 全屏 */
.fs-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 998; backdrop-filter: blur(2px); }
.chain-view-fullscreen { position: fixed !important; inset: 40px !important; z-index: 999; border-radius: 14px !important; box-shadow: 0 24px 80px rgba(0,0,0,0.4) !important; display: flex; flex-direction: column; border: 1px solid var(--card-border); overflow: hidden; }
.chain-view-fullscreen .chain-canvas { flex: 1; overflow: auto; min-height: 0 !important; }
.fs-title-bar { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.toolbar-right { display: flex; align-items: center; gap: 4px; }
.fs-close-btn { background: #FEF2F2 !important; color: #EF4444 !important; border-color: #FECACA !important; }
.fs-close-btn:hover { background: #FEE2E2 !important; border-color: #FCA5A5 !important; }
.ai-toolbar-actions { display: flex; align-items: center; gap: 6px; margin-right: 4px; }
.ai-toolbar-btn {
  height: 28px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 10px; background: var(--btn-accent-bg); border: 1px solid var(--btn-accent-bd);
  border-radius: 6px; cursor: pointer; color: var(--text-active); font-size: 12px; font-weight: 600;
  transition: all 0.15s; font-family: inherit;
}
.ai-toolbar-btn:hover:not(:disabled) { background: var(--btn-accent-bg-hover); border-color: var(--btn-accent-bd-hover); }
.ai-toolbar-btn.active { background: var(--btn-accent-bg-active); border-color: var(--btn-accent-bd-active); }
.ai-toolbar-btn.secondary { background: var(--bg-action-btn); color: var(--text-muted); border-color: var(--card-border); }
.ai-toolbar-btn.secondary:hover:not(:disabled) { background: var(--btn-accent-bg); color: var(--text-active); border-color: var(--btn-accent-bd); }
.ai-toolbar-btn:disabled { opacity: 0.65; cursor: not-allowed; }

/* 选中信息栏 */
.selection-bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(79,124,255,0.1); border-bottom: 1px solid rgba(79,124,255,0.2); font-size: 12px; }
.selection-text { flex: 1; color: #4F7CFF; font-weight: 500; }
.reset-btn { padding: 3px 10px; background: var(--card-bg); border: 1px solid rgba(79,124,255,0.3); border-radius: 5px; color: #4F7CFF; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.reset-btn:hover { background: #4F7CFF; color: #fff; }

.chain-hint { padding: 8px 16px 0; font-size: 12px; color: var(--text-faint); display: flex; align-items: center; gap: 5px; }

.chain-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--chain-toolbar); border-bottom: 1px solid var(--layer-nodes-bd); gap: 12px; flex-shrink: 0; transition: background 0.3s; }
.zoom-hint { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-faint); }
.zoom-controls { display: flex; align-items: center; gap: 4px; }
.zoom-btn { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: var(--bg-action-btn); border: 1px solid var(--card-border); border-radius: 6px; cursor: pointer; color: var(--text-muted); transition: all 0.15s; }
.zoom-btn:hover { background: rgba(79,124,255,0.1); color: #4F7CFF; border-color: rgba(79,124,255,0.3); }
.zoom-value { font-size: 12px; color: var(--text-muted); min-width: 40px; text-align: center; font-family: monospace; }

.analysis-panel {
  border-bottom: 1px solid var(--layer-nodes-bd);
  background: linear-gradient(180deg, rgba(79,124,255,0.04), transparent 36%), var(--chain-bg);
  padding: 14px 16px 16px;
}
.analysis-panel-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px;
}
.analysis-panel-title-group { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.analysis-panel-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.analysis-panel-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.analysis-panel-scope { font-size: 12px; color: var(--text-faint); }
.analysis-status-tag {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600;
}
.analysis-status-tag.cached { background: rgba(18,184,134,0.12); color: #0f9f74; }
.analysis-status-tag.stale { background: rgba(247,103,7,0.12); color: #d96a02; }
.analysis-close-btn {
  height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--card-border);
  background: var(--card-bg); color: var(--text-muted); cursor: pointer; font-size: 12px; transition: all 0.15s;
}
.analysis-close-btn:hover { color: #4F7CFF; border-color: rgba(79,124,255,0.26); background: rgba(79,124,255,0.06); }
.analysis-loading, .analysis-error-card {
  display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px;
  background: var(--layer-bg); border: 1px solid var(--layer-bd);
}
.analysis-loading-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(79,124,255,0.18); border-top-color: #4F7CFF;
  animation: spin 0.9s linear infinite; flex-shrink: 0;
}
.analysis-loading-text { display: flex; flex-direction: column; gap: 4px; }
.analysis-loading-title, .analysis-error-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.analysis-loading-sub, .analysis-error-detail { font-size: 12px; color: var(--text-faint); line-height: 1.6; }
.analysis-content { display: flex; flex-direction: column; gap: 12px; }
.analysis-stats { display: flex; flex-wrap: wrap; gap: 8px; }
.analysis-stat-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px;
  border-radius: 999px; background: var(--layer-bg); border: 1px solid var(--layer-bd);
}
.analysis-stat-label { font-size: 11px; color: var(--text-faint); }
.analysis-stat-value { font-size: 11px; color: var(--text-primary); font-weight: 600; }
.analysis-section-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;
}
.analysis-section-card {
  display: flex; flex-direction: column; gap: 10px; padding: 14px;
  border-radius: 12px; background: var(--layer-bg); border: 1px solid var(--layer-bd);
}
.analysis-section-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.analysis-section-text {
  font-size: 12px; line-height: 1.75; color: var(--text-secondary);
  white-space: pre-wrap; word-break: break-word;
}
.analysis-finding-list, .analysis-snippet-list { display: flex; flex-direction: column; gap: 10px; }
.analysis-finding-item, .analysis-snippet-item {
  display: flex; flex-direction: column; gap: 7px; padding: 12px;
  border-radius: 10px; background: var(--card-bg); border: 1px solid var(--card-border);
}
.analysis-finding-head, .analysis-snippet-head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.analysis-severity-chip {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
}
.analysis-severity-chip.severity-high { background: rgba(239,68,68,0.12); color: #dc2626; }
.analysis-severity-chip.severity-medium { background: rgba(245,158,11,0.14); color: #d97706; }
.analysis-severity-chip.severity-low { background: rgba(18,184,134,0.12); color: #0f9f74; }
.analysis-severity-chip.severity-default { background: rgba(140,148,166,0.14); color: var(--text-muted); }
.analysis-finding-title, .analysis-snippet-node { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.analysis-finding-detail, .analysis-snippet-path, .analysis-snippet-range {
  font-size: 12px; line-height: 1.6; color: var(--text-faint); word-break: break-word;
}
.analysis-finding-evidence {
  font-family: 'Consolas','Cascadia Code','JetBrains Mono','Fira Code',monospace;
  font-size: 11px; color: var(--text-secondary);
  background: rgba(79,124,255,0.06); border: 1px solid rgba(79,124,255,0.12);
  padding: 8px 10px; border-radius: 8px; white-space: pre-wrap; word-break: break-word;
}
.analysis-snippet-method {
  font-size: 11px; color: #4F7CFF; font-family: 'SF Mono','Fira Code',monospace;
}
.analysis-snippet-preview {
  margin: 0; padding: 10px 12px; border-radius: 8px; max-height: 180px; overflow: auto;
  background: rgba(17,24,39,0.92); color: #E5EDF7; font-size: 11px; line-height: 1.6;
  font-family: 'Consolas','Cascadia Code','JetBrains Mono','Fira Code',monospace;
  white-space: pre-wrap; word-break: break-word;
}

/* 链路图 */
.chain-view { border-top: 1px solid var(--layer-nodes-bd); background: var(--chain-bg); transition: background 0.3s; }
.chain-canvas { overflow-x: auto; overflow-y: hidden; min-height: 160px; cursor: grab; user-select: none; padding: 16px 20px 20px; scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) transparent; }
.chain-canvas:active { cursor: grabbing; }
.chain-canvas::-webkit-scrollbar { height: 6px; }
.chain-canvas::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
.chain-canvas::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

.chain-content { display: flex; flex-direction: row; align-items: flex-start; gap: 48px; width: fit-content; min-width: 100%; position: relative; }
.chain-curves-svg { position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; z-index: 0; }

/* 层 */
.chain-layer { background: var(--layer-bg); border: 1px solid var(--layer-bd); border-radius: 10px; overflow: visible; min-width: 190px; flex-shrink: 0; display: flex; flex-direction: column; position: relative; z-index: 1; transition: background 0.3s, border-color 0.3s; }
.layer-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; cursor: pointer; transition: background 0.15s; border-top: 3px solid transparent; white-space: nowrap; }
.layer-header:hover { background: var(--card-hover-bg); }
.orchestration { border-top-color: #4F7CFF; background: linear-gradient(to bottom, rgba(79,124,255,0.06), transparent); }
.service       { border-top-color: #12B886; background: linear-gradient(to bottom, rgba(18,184,134,0.06), transparent); }
.component     { border-top-color: #F76707; background: linear-gradient(to bottom, rgba(247,103,7,0.06), transparent); }
.data          { border-top-color: #7950F2; background: linear-gradient(to bottom, rgba(121,80,242,0.06), transparent); }
.layer-title { font-size: 12px; font-weight: 600; color: var(--layer-title); letter-spacing: 0.5px; }
.layer-header-right { display: flex; align-items: center; gap: 6px; }
.layer-click-hint { font-size: 10px; color: var(--text-faint); }
.layer-badge-count { font-size: 11px; font-weight: 700; background: #4F7CFF; color: #fff; padding: 1px 7px; border-radius: 10px; }
.data-badge { background: #7950F2; }

.layer-nodes { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--layer-nodes-bd); flex: 1; }

/* 节点 */
.chain-node { display: flex; flex-direction: column; gap: 3px; padding: 9px 12px; border-radius: 8px; border: 1px solid; cursor: pointer; transition: all 0.15s; width: 100%; }
.orchestration-node { background: var(--node-orch-bg); border-color: var(--node-orch-bd); }
.orchestration-node:hover { filter: brightness(0.95); box-shadow: 0 2px 8px rgba(79,124,255,0.2); }
.service-node { background: var(--node-svc-bg); border-color: var(--node-svc-bd); }
.service-node:hover { filter: brightness(0.95); box-shadow: 0 2px 8px rgba(18,184,134,0.2); }
.component-node { background: var(--node-comp-bg); border-color: var(--node-comp-bd); }
.component-node:hover { filter: brightness(0.95); box-shadow: 0 2px 8px rgba(247,103,7,0.2); }
.data-node { flex-direction: row; align-items: center; gap: 8px; background: var(--node-data-bg); border-color: var(--node-data-bd); padding: 8px 12px; }
.data-node:hover { filter: brightness(0.95); box-shadow: 0 2px 8px rgba(121,80,242,0.2); }
.table-node.node-selected { border-color: #6d28d9; box-shadow: 0 0 0 1px rgba(109,40,217,0.18), 0 4px 14px rgba(121,80,242,0.22); background: rgba(121,80,242,0.08); }
.dao-node { border-color: rgba(79,124,255,0.24); background: rgba(79,124,255,0.05); }
.dao-node .node-table-code { color: #4F7CFF; }
.pcs-service-node { background: var(--node-pcs-bg) !important; border-color: var(--node-pcs-bd) !important; }

.data-panels {
  flex-direction: row;
  align-items: flex-start;
  gap: 14px;
}

.data-sub-layer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dao-sub-layer {
  margin-top: 0;
  padding-top: 0;
  padding-left: 14px;
  border-top: 0;
  border-left: 1px dashed rgba(121,80,242,0.18);
}

.data-panel {
  min-width: 0;
}

.data-panel-table {
  width: 250px;
  flex: 0 0 250px;
}

.data-panel-dao {
  width: 250px;
  flex: 0 0 250px;
}

.data-sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.data-sub-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.data-sub-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-faint);
}

.data-sub-nodes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-header { display: flex; align-items: center; gap: 6px; }
.node-prefix { display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; font-family: 'SF Mono','Fira Code',monospace; letter-spacing: 0.5px; white-space: nowrap; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-width: 1.5px; border-style: solid; }
.prefix-pbs    { background: #DCFCE7; color: #15803D; border-color: #86EFAC; }
.prefix-pcs    { background: #DBEAFE; color: #1D4ED8; border-color: #93C5FD; }
.svc-expand-btn { background: none; border: none; padding: 0; margin-right: 1px; cursor: pointer; color: #64748B; display: inline-flex; align-items: center; flex-shrink: 0; }
.svc-expand-btn svg { transition: transform 0.15s; }
.svc-child-count { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 8px; background: #DBEAFE; color: #1D4ED8; white-space: nowrap; flex-shrink: 0; }
.prefix-pbcc   { background: #FFEDD5; color: #C2410C; border-color: #FDBA74; }
.prefix-pbct   { background: #FEF9C3; color: #A16207; border-color: #FDE047; }
.prefix-pbcb   { background: #F3E8FF; color: #7E22CE; border-color: #D8B4FE; }
.prefix-pbcp   { background: #FCE7F3; color: #BE185D; border-color: #F9A8D4; }
.prefix-method { background: #F0FDFA; color: #0F766E; border-color: #5EEAD4; }

.node-code { font-size: 12px; font-weight: 700; color: var(--node-code); font-family: monospace; }
.node-code-service { font-size: 11px; font-weight: 600; color: var(--node-svc-code); font-family: monospace; }
.node-name { font-size: 12px; color: var(--node-name); }
.node-table-code { font-size: 12px; font-weight: 600; color: #7950F2; font-family: monospace; }
.node-table-name { font-size: 11px; color: var(--text-faint); line-height: 1.4; }
.data-node-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.data-node-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 8px; }
.table-node-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  margin-top: auto;
  width: 100%;
  white-space: nowrap;
}
.table-node-name-inline {
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.node-check { flex-shrink: 0; }

/* 节点状态 */
.service-node.node-selected   { border-color: #12B886 !important; filter: brightness(0.92); }
.component-node.node-selected { border-color: #F76707 !important; filter: brightness(0.92); }

@keyframes callingPulse {
  0%   { box-shadow: 0 0 0 0   rgba(79,124,255,0.55); }
  50%  { box-shadow: 0 0 0 6px rgba(79,124,255,0); }
  100% { box-shadow: 0 0 0 0   rgba(79,124,255,0.55); }
}
@keyframes sharedPulse {
  0%   { box-shadow: 0 0 0 0   rgba(79,124,255,0.55); }
  50%  { box-shadow: 0 0 0 6px rgba(79,124,255,0); }
  100% { box-shadow: 0 0 0 0   rgba(79,124,255,0.55); }
}
.node-calling { border-color: #4F7CFF !important; background: linear-gradient(135deg, rgba(79,124,255,0.18), rgba(79,124,255,0.1)) !important; animation: callingPulse 1.4s ease-in-out infinite; }
.node-shared  { border-color: #4F7CFF !important; background: linear-gradient(135deg, rgba(79,124,255,0.18), rgba(79,124,255,0.1)) !important; animation: sharedPulse 1.4s ease-in-out infinite; }

.calling-badge { margin-left: auto; font-size: 10px; font-weight: 600; border-radius: 4px; padding: 1px 5px; white-space: nowrap; flex-shrink: 0; color: #4F7CFF; background: rgba(79,124,255,0.1); border: 1px solid rgba(79,124,255,0.3); }

@media (max-width: 980px) {
  .data-panels {
    flex-direction: column;
  }

  .data-panel-table,
  .data-panel-dao {
    width: 100%;
    flex-basis: auto;
  }

  .dao-sub-layer {
    padding-left: 0;
    padding-top: 10px;
    border-left: 0;
    border-top: 1px dashed rgba(121,80,242,0.18);
  }
}

/* 服务层内嵌双子层 */
.svc-inner-canvas { position: relative; display: flex; flex-direction: row; align-items: flex-start; gap: 48px; padding: 12px 14px; overflow: visible; }
.service-call-svg { position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; z-index: 2; }
.svc-inner-layer { background: var(--layer-inner-bg); border: 1px solid var(--layer-bd); border-radius: 10px; overflow: hidden; min-width: 180px; flex-shrink: 0; display: flex; flex-direction: column; position: relative; z-index: 1; transition: background 0.3s; }
.svc-inner-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-top: 3px solid transparent; }
.pbs-inner-layer .svc-inner-header { border-top-color: #12B886; background: linear-gradient(to bottom, rgba(18,184,134,0.06), transparent); }
.pcs-inner-layer .svc-inner-header { border-top-color: #228BE6; background: linear-gradient(to bottom, rgba(34,139,230,0.06), transparent); }
.svc-inner-title { font-size: 12px; font-weight: 600; color: var(--layer-title); letter-spacing: 0.5px; }
.svc-inner-nodes { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--inner-nodes-bd); flex: 1; }

/* 跨领域标签 */
.cross-domain-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 4px; margin-top: 4px; width: fit-content; white-space: nowrap; }

/* 节点头部右侧操作区 */
.node-header-actions { margin-left: auto; display: flex; align-items: center; gap: 3px; }
.node-check { flex-shrink: 0; }
/* 交易层首行布局 */
.node-first-row { display: flex; align-items: center; justify-content: space-between; }

/* 代码查看按钮（hover 显示） */
.code-view-btn {
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent; border-radius: 4px;
  cursor: pointer; color: var(--text-faint); opacity: 0; transition: all 0.15s;
  flex-shrink: 0; padding: 0;
}
.chain-node:hover .code-view-btn { opacity: 1; }
.code-view-btn:hover { background: rgba(79,124,255,0.12); color: #4F7CFF; border-color: rgba(79,124,255,0.3); }
.code-view-btn.test-btn:hover { background: rgba(18,184,134,0.12); color: #12B886; border-color: rgba(18,184,134,0.3); }

/* ── 代码查看弹窗（跟随日/夜主题） ── */
.code-modal-backdrop {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.60);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 28px;
  transition: background 0.24s ease, backdrop-filter 0.24s ease;
}
.code-modal-backdrop.code-modal-backdrop-drawer-right {
  justify-content: flex-start;
  padding-right: calc(28px + var(--code-modal-reserved-width, 0px));
}
.code-modal-backdrop.code-modal-backdrop-ai-fullscreen {
  background: rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(12px);
}
.code-modal {
  background: var(--code-modal-bg);
  border: 1px solid var(--code-modal-bd);
  border-radius: 6px;
  width: min(960px, 100%); max-height: 86vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 80px rgba(0,0,0,0.50);
  overflow: hidden;
  transition: transform 0.24s ease, opacity 0.24s ease, filter 0.24s ease, box-shadow 0.24s ease;
}
/* Monaco 版弹窗需要明确高度，让编辑器能计算尺寸 */
.code-modal.monaco-modal {
  height: 80vh;
}
.code-modal.monaco-modal.monaco-modal-external-right {
  width: min(1400px, calc(100vw - 56px - var(--code-modal-reserved-width, 0px)));
  max-width: calc(100vw - 56px - var(--code-modal-reserved-width, 0px));
}
.code-modal.monaco-modal.monaco-modal-ai-background {
  opacity: 0.1;
  transform: scale(0.96);
  filter: blur(6px) saturate(0.7);
  box-shadow: none;
  pointer-events: none;
}
.code-modal.monaco-modal.monaco-modal-ai-hidden {
  opacity: 0;
  visibility: hidden;
  width: 0 !important;
  max-width: 0 !important;
  height: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  border: none !important;
  box-shadow: none !important;
  overflow: hidden;
}
/* 全屏模式 */
.code-modal-backdrop-fs {
  padding: 0 !important;
}
.code-modal.monaco-modal-fs {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  border-radius: 0 !important;
  border: none !important;
}

/* ── 标题栏 ── */
.code-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 10px 16px; border-bottom: 1px solid var(--code-header-bd); gap: 10px;
  background: var(--code-header-bg); flex-shrink: 0; user-select: none;
}
.code-modal-title { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; overflow: hidden; }
.code-modal-name { font-size: 12.5px; font-weight: 600; color: var(--code-text); font-family: 'Consolas','SF Mono',monospace; white-space: nowrap; }
.code-modal-sep  { color: var(--code-ln); font-size: 13px; flex-shrink: 0; }
.code-modal-desc { font-size: 12px; color: var(--code-ln); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.code-modal-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.code-modal-close {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: 4px; cursor: pointer; color: var(--code-ln); transition: all 0.12s; flex-shrink: 0;
}
.code-modal-close:hover { background: var(--code-copy-hover); color: var(--code-text); }

/* 复制 & 入口跳转 */
.code-copy-btn {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--code-annotation);
  background: transparent; border: 1px solid rgba(128,128,128,0.2);
  border-radius: 3px; padding: 3px 9px; cursor: pointer;
  transition: all 0.12s; font-family: inherit;
}
.code-copy-btn:hover { background: var(--code-copy-hover); }
.code-copy-btn.copied { color: var(--code-type); }
.code-jump-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid rgba(128,128,128,0.2);
  border-radius: 3px; cursor: pointer; color: var(--code-jump-color); transition: all 0.12s;
}
.code-jump-btn:hover { background: var(--code-jump-hover); }

/* ── IDE 风格 Tab 标签栏 ── */
.code-tab-bar {
  display: flex; align-items: stretch;
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--code-header-bd);
  flex-shrink: 0; height: 36px; overflow: hidden;
}

/* 左右滚动箭头 */
.tab-bar-arrow {
  flex-shrink: 0; width: 24px;
  display: flex; align-items: center; justify-content: center;
  background: var(--code-header-bg);
  border: none; border-right: 1px solid var(--code-header-bd);
  cursor: pointer; color: var(--code-ln);
  transition: background 0.12s, color 0.12s;
  z-index: 1;
}
.tab-bar-arrow.right { border-right: none; border-left: 1px solid var(--code-header-bd); }
.tab-bar-arrow:hover { background: var(--code-copy-hover); color: var(--code-text); }

/* Tab 滚动区域（隐藏系统滚动条） */
.tabs-scroll-area {
  flex: 1; display: flex; align-items: stretch;
  overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none;  /* Firefox */
}
.tabs-scroll-area::-webkit-scrollbar { display: none; }  /* Chrome/Safari */

/* 单个 Tab */
.code-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px 0 12px;
  flex-shrink: 0;
  cursor: pointer;
  border-right: 1px solid var(--code-header-bd);
  color: var(--code-ln);
  font-size: 12px;
  font-family: 'Consolas','SF Mono', system-ui, monospace;
  transition: background 0.12s, color 0.12s;
  position: relative;
  user-select: none;
  max-width: 220px;
}
.code-tab:hover { background: var(--code-copy-hover); color: var(--code-text); }
/* 激活 Tab：底部蓝线 + 高亮背景 */
.code-tab.active {
  background: var(--code-body-bg);
  color: var(--code-text);
  border-bottom: 2px solid var(--code-file-tab-bd);
  padding-bottom: 2px;
}
.tab-icon { flex-shrink: 0; color: var(--code-annotation); }
.code-tab.active .tab-icon { color: var(--code-type); }
.tab-label {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 140px;
}
/* ── IDEA 风格 C / I / E 类型徽章 ── */
.kind-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; border-radius: 50%;
  font-size: 9px; font-weight: 800; line-height: 1;
  color: #fff; flex-shrink: 0;
  font-family: 'SF Pro Text', system-ui, -apple-system, sans-serif;
  letter-spacing: 0;
  user-select: none;
}
.kind-badge.kind-sm { width: 13px; height: 13px; font-size: 8px; }
/* class / abstract class → 蓝色 (#3573F0) */
.kind-class     { background: #3573F0; }
/* interface → 绿色 (#3D8C5A) */
.kind-interface { background: #3D8C5A; }
/* enum → 橙色 (#C07B3E) */
.kind-enum      { background: #C07B3E; }
.tab-close {
  flex-shrink: 0; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 3px;
  cursor: pointer; color: var(--code-ln);
  opacity: 0; transition: all 0.12s; padding: 0;
}
.code-tab:hover .tab-close { opacity: 0.6; }
.tab-close:hover { background: rgba(255,80,80,0.15); color: #FF5555; opacity: 1 !important; }

/* 包路径行（外部类 Tab 时展示） */
.code-pkg-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 16px;
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--code-header-bd);
  flex-shrink: 0;
}
.pkg-label {
  font-size: 10px; color: var(--code-ln);
  font-family: 'Consolas','SF Mono',monospace;
}

/* 代码区 */
.cross-nav-toast {
  padding: 5px 16px; font-size: 12px;
  background: var(--code-header-bg);
  border-bottom: 1px solid rgba(78,201,176,0.3);
  color: #4EC9B0; flex-shrink: 0;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }

.code-no-source {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  background: var(--code-body-bg); color: var(--text-faint);
  padding: 40px 24px; text-align: center;
}
.code-no-source .no-source-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.code-no-source .no-source-sub   { font-size: 12px; max-width: 300px; line-height: 1.6; }
.code-no-source .spin-icon { animation: spin 1.2s linear infinite; opacity: 0.6; }
@keyframes spin { to { transform: rotate(360deg); } }
.code-no-source .no-source-icon { opacity: 0.45; }

.code-modal-body {
  flex: 1; overflow: auto; padding: 8px 0; margin: 0;
  font-family: 'Consolas','Cascadia Code','JetBrains Mono','Fira Code',monospace;
  font-size: 13px; line-height: 1.6;
  color: var(--code-text); background: var(--code-body-bg);
  white-space: normal;
  scrollbar-width: thin; scrollbar-color: var(--code-ln) transparent;
  tab-size: 4;
  transition: background 0.3s, color 0.3s;
}
.code-modal-body::-webkit-scrollbar { width: 10px; height: 10px; }
.code-modal-body::-webkit-scrollbar-track { background: var(--code-body-bg); }
.code-modal-body::-webkit-scrollbar-thumb { background: var(--code-ln); }
.code-modal-body::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }
.code-modal-body code { display: block; min-width: max-content; }

/* 行容器 */
.code-line {
  display: flex; align-items: baseline;
  padding: 0; min-height: 1.6em; transition: background 0.06s;
}

/* 行号 */
.ln {
  display: flex; align-items: center; justify-content: flex-end;
  min-width: 48px; padding-right: 18px;
  color: var(--code-ln); font-size: 12px;
  user-select: none; flex-shrink: 0;
  line-height: 1.6em;
}
/* 行内容 */
.lc { flex: 1; padding: 0 20px 0 0; white-space: pre; }

/* ── 语法高亮（:deep 穿透 v-html 内容，颜色从 CSS 变量读取） ── */
:deep(.code-line) {
  display: flex; align-items: baseline;
  min-height: 1.6em; padding: 0; transition: background 0.06s;
}
:deep(.code-line:hover) { background: var(--code-internal-bg); }
:deep(.ln) {
  display: flex; align-items: center; justify-content: flex-end;
  min-width: 48px; padding-right: 18px;
  color: var(--code-ln); font-size: 12px; line-height: 1.6em;
  user-select: none; flex-shrink: 0;
}
:deep(.lc) { flex: 1; padding: 0 20px 0 0; white-space: pre; }

:deep(.hl-comment)    { color: var(--code-comment); }
:deep(.hl-annotation) { color: var(--code-annotation); }
:deep(.hl-keyword)    { color: var(--code-keyword); }
:deep(.hl-type)       { color: var(--code-type); }
:deep(.hl-string)     { color: var(--code-string); }
:deep(.hl-number)     { color: var(--code-number); }
:deep(.hl-fn)         { color: var(--code-fn); }
:deep(.hl-fn-entry)   { color: var(--code-fn-entry); font-weight: 700; }
:deep(.hl-fn-call)    { color: var(--code-fn); }
:deep(.hl-var)        { color: var(--code-var); }

/* 同文件内部方法调用（橙黄色）*/
:deep(.hl-internal-call) {
  color: var(--code-internal);
  cursor: pointer;
  border-bottom: 1px solid var(--code-internal);
  transition: background 0.12s;
  opacity: 0.85;
}
:deep(.hl-internal-call:hover) {
  background: var(--code-internal-bg);
  border-radius: 2px;
  opacity: 1;
}
/* 跨文件方法调用（青绿色，与内部方法区分）*/
:deep(.hl-cross-call) {
  color: #4EC9B0;
  cursor: pointer;
  border-bottom: 1px dashed #4EC9B0;
  transition: background 0.12s;
  opacity: 0.9;
}
:deep(.hl-cross-call:hover) {
  background: rgba(78, 201, 176, 0.12);
  border-radius: 2px;
  opacity: 1;
}

/* 整行跳转高亮 */
@keyframes lineFlash {
  0%   { background: var(--code-line-flash); }
  60%  { background: var(--code-line-flash); }
  100% { background: transparent; }
}
:deep(.line-flash) { animation: lineFlash 2s ease-out forwards; }

/* ── 外部可导航类（高亮 + 可点击） ── */
:deep(.hl-ext-ref) {
  cursor: pointer;
  border-bottom: 1px dashed var(--code-type);
  transition: background 0.12s, color 0.12s;
}
:deep(.hl-ext-ref:hover) {
  background: rgba(78,201,176,0.1);
  color: var(--code-type) !important;
  border-bottom-style: solid;
  border-radius: 2px;
}

/* 方法定义处可点击（反向跳转） */
:deep(.hl-fn-def) {
  cursor: pointer;
  text-decoration: underline dotted currentColor;
  text-underline-offset: 3px;
}
:deep(.hl-fn-def:hover) {
  background: var(--code-internal-bg);
  border-radius: 2px;
  text-decoration: underline solid currentColor;
}

/* ── 调用位置弹窗（反向跳转 IDE 风格） ── */
.csp-popup {
  position: fixed;
  z-index: 3000;
  min-width: 320px;
  max-width: 520px;
  background: var(--code-modal-bg);
  border: 1px solid var(--code-header-bd);
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
  font-family: 'Consolas','Cascadia Code','JetBrains Mono','Fira Code', monospace;
  font-size: 12px;
  overflow: hidden;
  animation: cspFadeIn 0.12s ease-out;
}

@keyframes cspFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.csp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 7px;
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--code-header-bd);
  user-select: none;
}

.csp-title {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--code-fn);
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.csp-method-name { color: var(--code-fn); }
.csp-paren { color: var(--code-text); opacity: 0.5; }

.csp-count {
  font-size: 11px;
  color: var(--code-ln);
  background: var(--code-internal-bg);
  padding: 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.csp-close {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: 3px; cursor: pointer;
  color: var(--code-ln); transition: all 0.12s;
  flex-shrink: 0; padding: 0;
}
.csp-close:hover { background: var(--code-copy-hover); color: var(--code-text); }

.csp-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  color: var(--code-ln);
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--code-header-bd);
  font-size: 11px;
}

.csp-filename { color: var(--code-annotation); font-size: 11px; }

.csp-item {
  display: flex;
  align-items: baseline;
  gap: 0;
  padding: 0;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--code-header-bd);
}
.csp-item:last-child { border-bottom: none; }
.csp-item:hover { background: var(--code-internal-bg); }

.csp-line-badge {
  flex-shrink: 0;
  min-width: 40px;
  padding: 6px 8px 6px 10px;
  text-align: right;
  color: var(--code-ln);
  font-size: 11px;
  background: var(--code-header-bg);
  border-right: 1px solid var(--code-header-bd);
  user-select: none;
  line-height: 1.5;
}

.csp-preview {
  flex: 1;
  padding: 6px 12px;
  color: var(--code-text);
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 1.5;
}

.csp-item:hover .csp-preview { color: var(--code-internal); }

.csp-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  color: var(--code-ln);
  font-size: 11px;
  font-family: inherit;
}
</style>
