<template>
  <div class="ifd-scroll">
    <div class="ifd-canvas" :style="{ width: `${ly.totalWidth}px`, height: `${ly.totalHeight}px` }">
      <!-- 子列浅底 -->
      <template v-for="(_, colIdx) in ly.allLevels" :key="'bgw-' + colIdx">
        <template v-if="ly.splitMap[colIdx]">
          <div
            v-for="(subCol, subIdx) in ly.splitMap[colIdx]"
            :key="'bg-' + colIdx + '-' + subCol.def.key"
            class="ifd-subcol-bg"
            :style="subcolBgStyle(colIdx, subIdx, subCol, ly)"
          />
        </template>
      </template>

      <!-- 子列间调用方向圆标 -->
      <template v-for="(_, colIdx) in ly.allLevels" :key="'jw-' + colIdx">
        <template v-if="ly.splitMap[colIdx]">
          <div
            v-for="(subCol, subIdx) in ly.splitMap[colIdx].slice(0, -1)"
            :key="'junc-' + colIdx + '-' + subIdx"
            v-show="subCol.def.callsRightward"
            class="ifd-junction"
            :style="junctionStyle(colIdx, subIdx, ly)"
            :title="junctionTitle(subCol, colIdx, subIdx, ly)"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2,5 L7,5 M5,2 L8,5 L5,8"
                fill="none"
                :stroke="ly.splitMap[colIdx][subIdx + 1]?.def.color ?? subCol.def.color"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </template>
      </template>

      <!-- 主层标题 -->
      <div
        v-for="(nodes, colIdx) in ly.allLevels"
        :key="'hdr-' + colIdx"
        class="ifd-col-head"
        :style="colHeadStyle(colIdx, ly)"
      >
        <div class="ifd-col-pill" :style="pillStyle(nodes[0]?.nodeType || 'table')">
          <span>{{ layerIcons[nodes[0]?.nodeType || 'table'] }}</span>
          <span>{{ layerLabels[nodes[0]?.nodeType || 'table'] }}</span>
          <span class="ifd-col-count" :style="{ background: layerColors[nodes[0]?.nodeType || '#8C8C8C'], color: 'white' }">
            {{ nodes.length }}
          </span>
        </div>
        <span v-if="colIdx === 0" class="ifd-root-tag">目标</span>
        <div
          v-if="hasCallChainBadge(colIdx, ly)"
          class="ifd-chain-anno"
        >
          <span>pbcb/pbcp</span>
          <span class="ifd-chain-arr">→</span>
          <span>pbcc</span>
          <span class="ifd-chain-arr">→</span>
          <span>pbct</span>
        </div>
      </div>

      <!-- 子列标题 -->
      <template v-for="(_, colIdx) in ly.allLevels" :key="'sh-' + colIdx">
        <template v-if="ly.splitMap[colIdx]">
          <div
            v-for="(subCol, subIdx) in ly.splitMap[colIdx]"
            :key="'subh-' + colIdx + '-' + subCol.def.key"
            class="ifd-subcol-head"
            :style="subcolHeadStyle(colIdx, subIdx, ly)"
          >
            <span v-if="subCol.def.typeTag" class="ifd-type-tag" :style="typeTagStyle(subCol.def)">{{ subCol.def.typeTag }}</span>
            <span class="ifd-subcol-title" :style="{ color: subCol.def.color }">{{ subCol.def.title }}</span>
            <span class="ifd-subcol-n" :style="{ background: subCol.def.color }">{{ subCol.nodes.length }}</span>
          </div>
        </template>
      </template>

      <!-- 列间装饰箭头 -->
      <svg
        v-for="(_, colIdx) in ly.allLevels.slice(0, -1)"
        :key="'arr-' + colIdx"
        class="ifd-arrow-svg"
        :style="arrowBetweenStyle(colIdx, ly)"
        width="40"
        height="16"
      >
        <path
          d="M4,8 H32 M26,3 L32,8 L26,13"
          fill="none"
          stroke="#D0D0D0"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <!-- 图例 -->
      <div v-if="hasIntraEdges" class="ifd-legend">
        <div class="ifd-leg-item">
          <svg width="28" height="10">
            <line x1="2" y1="5" x2="22" y2="5" stroke="#C8C8C8" stroke-width="1.5" stroke-dasharray="5,3" />
            <path d="M20,2 L24,5 L20,8" fill="none" stroke="#C8C8C8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>跨层调用</span>
        </div>
        <div class="ifd-leg-item">
          <svg width="32" height="12">
            <path d="M4,3 C4,10 28,10 28,3" fill="none" stroke="#FA8C16" stroke-width="1.5" />
            <path d="M25,1 L28,4 L25,7" fill="none" stroke="#FA8C16" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>层内调用（左→右）</span>
        </div>
        <div class="ifd-leg-item">
          <svg width="20" height="12">
            <path d="M6,3 C14,3 14,9 6,9" fill="none" stroke="#FA8C16" stroke-width="1.5" stroke-dasharray="4,2.5" />
            <path d="M6,6 L6,9 L9,6" fill="none" stroke="#FA8C16" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>同类构件调用</span>
        </div>
      </div>

      <svg class="ifd-edges-svg" :width="ly.totalWidth" :height="ly.totalHeight">
        <defs>
          <marker
            v-for="(color, type) in layerColors"
            :id="'ifd-arr-' + type"
            :key="'m-' + type"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 Z" :fill="color" />
          </marker>
          <marker
            v-for="(color, type) in layerColors"
            :id="'ifd-intra-' + type"
            :key="'mi-' + type"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 Z" :fill="color" />
          </marker>
        </defs>
        <path
          v-for="seg in crossEdgePaths"
          :key="seg.key"
          :d="seg.d"
          fill="none"
          :stroke="seg.stroke"
          :stroke-width="seg.sw"
          :stroke-opacity="seg.so"
          :stroke-dasharray="seg.dash"
          :marker-end="seg.marker"
          class="ifd-edge-path"
        />
        <path
          v-for="seg in intraEdgePaths"
          :key="'intra-' + seg.key"
          :d="seg.d"
          fill="none"
          :stroke="seg.stroke"
          :stroke-width="seg.sw"
          :stroke-opacity="seg.so"
          :stroke-dasharray="seg.dash"
          :marker-end="seg.marker"
          class="ifd-edge-path"
        />
      </svg>

      <div
        v-for="node in allNodes"
        :key="node.id"
        class="ifd-node"
        :class="{
          'ifd-node--root': node.id === root.id,
          'ifd-node--dim': hoveredId && !connectedIds.has(node.id),
          'ifd-node--hi': hoveredId && connectedIds.has(node.id),
        }"
        :style="nodeCardStyle(node)"
        @mouseenter="hoveredId = node.id"
        @mouseleave="hoveredId = null"
      >
        <div class="ifd-node-badges">
          <span class="ifd-badge-layer" :style="badgeLayer(node.nodeType)">{{ layerLabels[node.nodeType] }}</span>
          <span v-if="typeCfg(node.type)" class="ifd-badge-type" :style="typeStyle(node.type)">{{ node.type }}</span>
          <span v-if="node.domainId" class="ifd-badge-domain" :style="badgeDomain(node.domainId)">{{ domainShort[node.domainId] || node.domainId }}</span>
        </div>
        <div class="ifd-node-name" :class="{ 'ifd-node-name--sm': nodeSubColMap.has(node.id) }">{{ node.name }}</div>
        <div class="ifd-node-foot">
          <span v-if="node.code" class="ifd-tx-code">{{ node.code }}</span>
          <span class="ifd-node-id">{{ node.id }}</span>
        </div>
        <div v-if="node.id === root.id" class="ifd-root-dot" :style="rootDotStyle(node.nodeType)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { LAYER_COLORS as LC, DOMAIN_COLORS as DC } from './constants.js'

const NODE_W = 186
const SUB_NODE_W = 162
const NODE_H = 76
const V_GAP = 10
const COL_GAP = 100
const SUBCOL_GAP = 20
const SUBCOL_BG_PAD = 4
const PAD_H = 32
const PAD_V = 44
const HEADER_H = 36
const SUB_HEADER_H = 32
const INTRA_EXTRA_H = 72

const layerColors = LC

const layerLabels = {
  table: '数据层',
  component: '构件层',
  service: '服务层',
  orchestration: '流程编排层',
  transaction: '联机交易',
}

const layerIcons = {
  table: '\uD83D\uDDC3\uFE0F',
  component: '\uD83E\uDDE9',
  service: '\u2699\uFE0F',
  orchestration: '\uD83D\uDD00',
  transaction: '\uD83D\uDCB3',
}

const domainShort = {
  common: '公共',
  loan: '贷款',
  deposit: '存款',
  settlement: '结算',
  public: '公共',
  ap: '平台',
  platform: '平台',
  dept: '机构',
  unvr: '通用',
  stmt: '账单',
  medu: '介质',
  inbu: '内部',
  aggr: '聚合',
}

const domainColors = DC

const TYPE_CONFIG = {
  method: { color: '#2F54EB', bg: '#F0F5FF' },
  pbf: { color: '#096DD9', bg: '#E6F7FF' },
  pbs: { color: '#006D75', bg: '#E6FFFB' },
  pcs: { color: '#531DAB', bg: '#F9F0FF' },
  service: { color: '#1D39C4', bg: '#F0F5FF' },
  pbcb: { color: '#AD4E00', bg: '#FFF7E6' },
  pbcp: { color: '#C41D7F', bg: '#FFF0F6' },
  pbcc: { color: '#0050B3', bg: '#E6F7FF' },
  pbct: { color: '#434343', bg: '#F5F5F5' },
}

const COMP_SUBCOLS = [
  {
    key: 'biz',
    title: '业务/产品构件',
    typeTag: 'pbcb / pbcp',
    types: ['pbcb', 'pbcp'],
    color: '#AD4E00',
    bg: '#FFF7E6',
    border: '#FFD591',
    isCatchAll: true,
    callsRightward: true,
  },
  {
    key: 'pbcc',
    title: '公共构件',
    typeTag: 'pbcc',
    types: ['pbcc'],
    color: '#0050B3',
    bg: '#E6F7FF',
    border: '#91D5FF',
    callsRightward: true,
  },
  {
    key: 'pbct',
    title: '技术构件',
    typeTag: 'pbct',
    types: ['pbct'],
    color: '#434343',
    bg: '#F5F5F5',
    border: '#D9D9D9',
  },
]

const SERVICE_SUBCOLS = [
  {
    key: 'pbs',
    title: '编码调用',
    typeTag: 'pbs',
    types: ['pbs'],
    color: '#006D75',
    bg: '#E6FFFB',
    border: '#87E8DE',
  },
  {
    key: 'pcs',
    title: '编码调用',
    typeTag: 'pcs',
    types: ['pcs'],
    color: '#531DAB',
    bg: '#F9F0FF',
    border: '#D3ADF7',
  },
  {
    key: 'flow',
    title: '流程编排',
    typeTag: '',
    types: ['method'],
    color: '#2F54EB',
    bg: '#F0F5FF',
    border: '#ADC6FF',
    isCatchAll: true,
  },
]

const LAYER_SUBCOLS = {
  component: COMP_SUBCOLS,
  service: SERVICE_SUBCOLS,
  orchestration: [
    {
      key: 'method',
      title: '流程方法',
      typeTag: 'method',
      types: ['method'],
      color: '#2F54EB',
      bg: '#F0F5FF',
      border: '#ADC6FF',
    },
    {
      key: 'pbs',
      title: 'PBS 服务',
      typeTag: 'pbs',
      types: ['pbs'],
      color: '#006D75',
      bg: '#E6FFFB',
      border: '#87E8DE',
    },
    {
      key: 'pcs',
      title: 'PCS 服务',
      typeTag: 'pcs',
      types: ['pcs'],
      color: '#531DAB',
      bg: '#F9F0FF',
      border: '#D3ADF7',
    },
    {
      key: 'service',
      title: '通用服务',
      typeTag: 'service',
      types: ['service'],
      color: '#1D39C4',
      bg: '#F0F5FF',
      border: '#ADC6FF',
      isCatchAll: true,
    },
  ],
}

function getActiveSubCols(nodes, defs) {
  const claimed = new Set()
  const explicit = []
  let catchAllDef = null
  for (const def of defs) {
    if (def.isCatchAll) {
      catchAllDef = def
      continue
    }
    const subNodes = nodes.filter((n) => def.types.includes(n.type || ''))
    subNodes.forEach((n) => claimed.add(n.id))
    if (subNodes.length) explicit.push({ def, nodes: subNodes })
  }
  if (catchAllDef) {
    const subNodes = nodes.filter((n) => !claimed.has(n.id))
    if (subNodes.length) explicit.unshift({ def: catchAllDef, nodes: subNodes })
  }
  return explicit
}

function splitLayerWidth(activeCount) {
  return activeCount * SUB_NODE_W + Math.max(0, activeCount - 1) * SUBCOL_GAP
}

function computeLayout(root, levels, hasIntraEdges) {
  const allLevels = [[root], ...levels].filter((nodes) => nodes.length > 0)
  const splitMap = {}
  allLevels.forEach((nodes, colIdx) => {
    if (colIdx === 0) return
    const nodeType = nodes[0]?.nodeType
    const defs = nodeType ? LAYER_SUBCOLS[nodeType] : undefined
    if (!defs) return
    const active = getActiveSubCols(nodes, defs)
    if (active.length > 0) splitMap[colIdx] = active
  })

  const hasSplitLevels = Object.keys(splitMap).length > 0
  const extraH = hasSplitLevels ? SUB_HEADER_H : 0

  const colWidths = allLevels.map((_nodes, colIdx) => {
    const active = splitMap[colIdx]
    return active ? splitLayerWidth(active.length) : NODE_W
  })

  const colXs = []
  let curX = PAD_H
  allLevels.forEach((_, i) => {
    colXs.push(curX)
    curX += colWidths[i] + COL_GAP
  })
  const totalWidth = curX - COL_GAP + PAD_H

  const maxNodes = Math.max(
    ...allLevels.map((nodes, colIdx) => {
      const active = splitMap[colIdx]
      if (active) return Math.max(...active.map((s) => s.nodes.length), 1)
      return nodes.length
    }),
    1
  )
  const colContentH = maxNodes * (NODE_H + V_GAP) - V_GAP
  const totalHeight = PAD_V * 2 + HEADER_H + extraH + colContentH + (hasIntraEdges ? INTRA_EXTRA_H : 0)
  const nodeStartY = PAD_V + HEADER_H + extraH

  const positions = {}
  allLevels.forEach((nodes, colIdx) => {
    const colX = colXs[colIdx]
    const active = splitMap[colIdx]
    if (active) {
      active.forEach((subCol, subIdx) => {
        const subX = colX + subIdx * (SUB_NODE_W + SUBCOL_GAP)
        const levelH = subCol.nodes.length * (NODE_H + V_GAP) - V_GAP
        const startY = nodeStartY + (colContentH - Math.max(levelH, 0)) / 2
        subCol.nodes.forEach((node, rowIdx) => {
          positions[node.id] = { x: subX, y: startY + rowIdx * (NODE_H + V_GAP) }
        })
      })
    } else {
      const levelH = nodes.length * (NODE_H + V_GAP) - V_GAP
      const startY = nodeStartY + (colContentH - levelH) / 2
      nodes.forEach((node, rowIdx) => {
        positions[node.id] = { x: colX, y: startY + rowIdx * (NODE_H + V_GAP) }
      })
    }
  })

  return {
    positions,
    allLevels,
    totalWidth,
    totalHeight,
    colXs,
    colWidths,
    splitMap,
    hasSplitLevels,
    colContentH,
    nodeStartY,
    hasIntraEdges,
  }
}

const props = defineProps({
  result: { type: Object, required: true },
})

const hoveredId = ref(null)

const hasIntraEdges = computed(() => (props.result.edges || []).some((e) => e.isIntraLayer))

const ly = computed(() =>
  computeLayout(props.result.root, props.result.levels || [], hasIntraEdges.value)
)

const root = computed(() => props.result.root)
const edges = computed(() => props.result.edges || [])
const allNodes = computed(() => ly.value.allLevels.flat())

const nodeSubColMap = computed(() => {
  const m = new Map()
  ly.value.allLevels.forEach((_nodes, colIdx) => {
    const active = ly.value.splitMap[colIdx]
    if (active) {
      active.forEach((subCol, subIdx) => {
        subCol.nodes.forEach((n) => m.set(n.id, subIdx))
      })
    }
  })
  return m
})

const highlightedEdgeKeys = computed(() => {
  const hid = hoveredId.value
  if (!hid) return new Set()
  const hi = new Set()
  for (const e of edges.value) {
    if (e.from === hid || e.to === hid) hi.add(`${e.from}\u2192${e.to}`)
  }
  return hi
})

const connectedIds = computed(() => {
  const hid = hoveredId.value
  if (!hid) return new Set()
  const set = new Set([hid])
  for (const e of edges.value) {
    if (e.from === hid || e.to === hid) {
      set.add(e.from)
      set.add(e.to)
    }
  }
  return set
})

function nodeNw(node) {
  return nodeSubColMap.value.has(node.id) ? SUB_NODE_W : NODE_W
}

const intraArcBaseY = computed(() => {
  const l = ly.value
  const extraH = l.hasSplitLevels ? SUB_HEADER_H : 0
  const nodeAreaBottom =
    PAD_V +
    HEADER_H +
    extraH +
    (l.totalHeight - PAD_V * 2 - HEADER_H - extraH - (l.hasIntraEdges ? INTRA_EXTRA_H : 0))
  return nodeAreaBottom + 20
})

const crossEdgePaths = computed(() => {
  const pos = ly.value.positions
  const hid = hoveredId.value
  const hi = highlightedEdgeKeys.value
  const nodes = allNodes.value
  const nscm = nodeSubColMap.value
  return edges.value
    .filter((e) => !e.isIntraLayer)
    .map((edge) => {
      const p1 = pos[edge.from]
      const p2 = pos[edge.to]
      if (!p1 || !p2) return null
      const fromNode = nodes.find((n) => n.id === edge.from)
      const toNode = nodes.find((n) => n.id === edge.to)
      const fromIsSplit = fromNode && nscm.has(fromNode.id)
      const x1 = p1.x + (fromIsSplit ? SUB_NODE_W : NODE_W)
      const y1 = p1.y + NODE_H / 2
      const x2 = p2.x
      const y2 = p2.y + NODE_H / 2
      const key = `${edge.from}\u2192${edge.to}`
      const isH = hid && hi.has(key)
      const isDim = hid && !hi.has(key)
      const edgeColor = toNode ? layerColors[toNode.nodeType] : '#AAAAAA'
      const mx = (x1 + x2) / 2
      return {
        key,
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        stroke: isH ? edgeColor : '#C8C8C8',
        sw: isH ? 2 : 1.5,
        so: isDim ? 0.08 : isH ? 0.9 : 0.4,
        dash: isH ? undefined : '6,4',
        marker: isH && toNode ? `url(#ifd-arr-${toNode.nodeType})` : undefined,
      }
    })
    .filter(Boolean)
})

const intraEdgePaths = computed(() => {
  const pos = ly.value.positions
  const hid = hoveredId.value
  const hi = highlightedEdgeKeys.value
  const nodes = allNodes.value
  const nscm = nodeSubColMap.value
  const arcY0 = intraArcBaseY.value
  return edges.value
    .filter((e) => e.isIntraLayer)
    .map((edge, edgeIdx) => {
      const p1 = pos[edge.from]
      const p2 = pos[edge.to]
      if (!p1 || !p2) return null
      const fromNode = nodes.find((n) => n.id === edge.from)
      const toNode = nodes.find((n) => n.id === edge.to)
      const fromIsSplit = fromNode && nscm.has(fromNode.id)
      const toIsSplit = toNode && nscm.has(toNode.id)
      const snw = fromIsSplit ? SUB_NODE_W : NODE_W
      const tnw = toIsSplit ? SUB_NODE_W : NODE_W
      const key = `${edge.from}\u2192${edge.to}`
      const isH = hid && hi.has(key)
      const isDim = hid && !hi.has(key)
      const layerColor = fromNode ? layerColors[fromNode.nodeType] : '#FA8C16'
      const fromSubIdx = nscm.get(edge.from) ?? -1
      const toSubIdx = nscm.get(edge.to) ?? -1
      const isSameSubCol = fromSubIdx !== -1 && fromSubIdx === toSubIdx
      let pathD
      if (isSameSubCol) {
        const R = 26 + edgeIdx * 2
        const xStart = p1.x + snw
        const yStart = p1.y + NODE_H / 2
        const xEnd = p2.x + tnw
        const yEnd = p2.y + NODE_H / 2
        pathD = `M${xStart},${yStart} C${xStart + R},${yStart} ${xEnd + R},${yEnd} ${xEnd},${yEnd}`
      } else {
        const fx = p1.x + snw / 2
        const fy = p1.y + NODE_H
        const txc = p2.x + tnw / 2
        const tyc = p2.y + NODE_H
        const subColDist = Math.abs(fromSubIdx - toSubIdx)
        const depthOffset = subColDist > 0 ? subColDist * 16 : 12
        const yStagger = (edgeIdx % 3) * 5
        const arcY = arcY0 + depthOffset + yStagger
        pathD = `M${fx},${fy} C${fx},${arcY} ${txc},${arcY} ${txc},${tyc}`
      }
      return {
        key,
        d: pathD,
        stroke: isH ? layerColor : '#C8C8C8',
        sw: isH ? 2.4 : 1.5,
        so: isDim ? 0.04 : isH ? 1 : 0.45,
        dash: isH ? undefined : '6,4',
        marker: isH && toNode ? `url(#ifd-intra-${toNode.nodeType})` : undefined,
      }
    })
    .filter(Boolean)
})

function pillStyle(nodeType) {
  const c = layerColors[nodeType] || '#8C8C8C'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '3px 12px',
    background: c + '18',
    border: `1px solid ${c}50`,
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    color: c,
    letterSpacing: '0.3px',
  }
}

function colHeadStyle(colIdx, layout) {
  return {
    position: 'absolute',
    left: `${layout.colXs[colIdx]}px`,
    top: `${PAD_V}px`,
    width: `${layout.colWidths[colIdx]}px`,
    height: `${HEADER_H - 4}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    zIndex: 3,
  }
}

function hasCallChainBadge(colIdx, layout) {
  const active = layout.splitMap[colIdx]
  return active?.some((s) => s.def.callsRightward)
}

function subcolBgStyle(colIdx, subIdx, subCol, layout) {
  const colX = layout.colXs[colIdx]
  const subX = colX + subIdx * (SUB_NODE_W + SUBCOL_GAP)
  const active = layout.splitMap[colIdx]
  const isFirst = subIdx === 0
  const isLast = subIdx === active.length - 1
  const bgTop = PAD_V + HEADER_H
  const bgH = layout.totalHeight - bgTop - PAD_V - (layout.hasIntraEdges ? INTRA_EXTRA_H : 0)
  return {
    position: 'absolute',
    left: `${subX - SUBCOL_BG_PAD}px`,
    top: `${bgTop}px`,
    width: `${SUB_NODE_W + SUBCOL_BG_PAD * 2}px`,
    height: `${bgH}px`,
    background: subCol.def.bg + 'BB',
    borderRadius: `${isFirst ? 8 : 0}px ${isLast ? 8 : 0}px ${isLast ? 8 : 0}px ${isFirst ? 8 : 0}px`,
    borderTop: `2px solid ${subCol.def.border}`,
    borderLeft: isFirst ? `2px solid ${subCol.def.border}` : `1px dashed ${subCol.def.border}`,
    borderRight: isLast ? `2px solid ${subCol.def.border}` : `1px dashed ${subCol.def.border}`,
    borderBottom: `2px solid ${subCol.def.border}`,
    pointerEvents: 'none',
    zIndex: 0,
    boxSizing: 'border-box',
  }
}

function junctionStyle(colIdx, subIdx, layout) {
  const colX = layout.colXs[colIdx]
  const subX = colX + subIdx * (SUB_NODE_W + SUBCOL_GAP)
  const gapCenterX = subX + SUB_NODE_W + SUBCOL_GAP / 2
  const junctionY = PAD_V + HEADER_H + SUB_HEADER_H / 2
  return {
    position: 'absolute',
    left: `${gapCenterX - 10}px`,
    top: `${junctionY - 10}px`,
    width: '20px',
    height: '20px',
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'white',
    borderRadius: '50%',
    border: `1px solid ${layout.splitMap[colIdx][subIdx].def.border}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  }
}

function junctionTitle(subCol, colIdx, subIdx, layout) {
  const next = layout.splitMap[colIdx][subIdx + 1]?.def
  return `${subCol.def.typeTag} 调用 ${next?.typeTag ?? ''}`
}

function subcolHeadStyle(colIdx, subIdx, layout) {
  const colX = layout.colXs[colIdx]
  const subX = colX + subIdx * (SUB_NODE_W + SUBCOL_GAP)
  const subHeaderTop = PAD_V + HEADER_H
  return {
    position: 'absolute',
    left: `${subX - SUBCOL_BG_PAD}px`,
    top: `${subHeaderTop}px`,
    width: `${SUB_NODE_W + SUBCOL_BG_PAD * 2}px`,
    height: `${SUB_HEADER_H}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    zIndex: 3,
  }
}

function typeTagStyle(def) {
  return {
    fontSize: '10px',
    fontWeight: 700,
    color: def.color,
    background: 'white',
    border: `1px solid ${def.border}`,
    borderRadius: '4px',
    padding: '1px 6px',
    lineHeight: '16px',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
  }
}

function arrowBetweenStyle(colIdx, layout) {
  const midX = layout.colXs[colIdx] + layout.colWidths[colIdx] + COL_GAP / 2
  const y = PAD_V + HEADER_H / 2 - 2
  return { position: 'absolute', left: `${midX - 20}px`, top: `${y}px`, zIndex: 3 }
}

function subcolBorderForNode(node) {
  const defs = LAYER_SUBCOLS[node.nodeType]
  if (!defs || !nodeSubColMap.value.has(node.id)) return layerColors[node.nodeType]
  const match =
    defs.find((d) => !d.isCatchAll && d.types.includes(node.type || '')) || defs.find((d) => d.isCatchAll)
  return match ? match.color : layerColors[node.nodeType]
}

function nodeCardStyle(node) {
  const pos = ly.value.positions[node.id]
  if (!pos) return { display: 'none' }
  const nw = nodeNw(node)
  const lc = layerColors[node.nodeType]
  const leftBorder = subcolBorderForNode(node)
  const isRoot = node.id === root.value.id
  const isH = hoveredId.value === node.id
  const conn = hoveredId.value && connectedIds.value.has(node.id)
  return {
    position: 'absolute',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${nw}px`,
    height: `${NODE_H}px`,
    zIndex: 2,
    background: isRoot ? `linear-gradient(135deg, white 0%, ${lc}08 100%)` : 'white',
    borderRadius: '8px',
    border: `1px solid ${isH || conn ? lc + '60' : isRoot ? lc + '40' : '#E4E4E4'}`,
    borderLeft: `4px solid ${leftBorder}`,
    boxShadow: isH
      ? `0 4px 24px ${lc}35, 0 2px 8px rgba(0,0,0,0.1)`
      : isRoot
        ? `0 2px 12px rgba(0,0,0,0.1), 0 0 0 2px ${lc}20`
        : conn
          ? `0 2px 12px ${lc}20`
          : '0 1px 4px rgba(0,0,0,0.06)',
    opacity: hoveredId.value && !connectedIds.value.has(node.id) ? 0.25 : 1,
    transition: 'all 0.18s ease',
    cursor: 'default',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    userSelect: 'none',
    boxSizing: 'border-box',
  }
}

function badgeLayer(nodeType) {
  const c = layerColors[nodeType]
  return { color: c, background: c + '15', border: `1px solid ${c}40` }
}

function typeCfg(t) {
  return t ? TYPE_CONFIG[t] : null
}

function typeStyle(t) {
  const cfg = TYPE_CONFIG[t]
  if (!cfg) return {}
  return { color: cfg.color, background: cfg.bg }
}

function badgeDomain(domainId) {
  const c = domainColors[domainId] || '#8C8C8C'
  return { color: c, background: c + '12', border: `1px solid ${c}30` }
}

function rootDotStyle(nodeType) {
  const c = layerColors[nodeType]
  return { background: c, boxShadow: `0 0 6px ${c}` }
}
</script>

<style scoped>
.ifd-scroll {
  overflow: auto;
  flex: 1;
  background: radial-gradient(circle, #d0d0d0 1px, transparent 1px);
  background-size: 20px 20px;
  background-color: #f8fafb;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  min-height: 300px;
  position: relative;
}

[data-theme='dark'] .ifd-scroll {
  background-color: var(--bg-card, #1a1d24);
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  border-color: var(--border, #333);
}

.ifd-canvas {
  position: relative;
  min-width: 100%;
}

.ifd-col-head {
  flex-wrap: wrap;
}

.ifd-col-pill {
  flex-shrink: 0;
}

.ifd-col-count {
  border-radius: 10px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.ifd-root-tag {
  font-size: 10px;
  color: #bfbfbf;
  font-style: italic;
}

.ifd-chain-anno {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  font-size: 9px;
  color: #ad4e00;
  font-weight: 600;
  white-space: nowrap;
}

.ifd-chain-arr {
  color: #fa8c16;
}

.ifd-subcol-head {
  flex-wrap: wrap;
}

.ifd-subcol-title {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.ifd-subcol-n {
  font-size: 10px;
  font-weight: 700;
  color: white;
  border-radius: 8px;
  padding: 0 5px;
  line-height: 15px;
}

.ifd-arrow-svg {
  position: absolute;
}

.ifd-legend {
  position: absolute;
  right: 32px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 4;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 4px 10px;
}

.ifd-leg-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #8c8c8c;
  white-space: nowrap;
}

.ifd-edges-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.ifd-edge-path {
  transition: stroke-opacity 0.2s, stroke-width 0.2s;
}

.ifd-node-badges {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.ifd-badge-layer {
  font-size: 9px;
  font-weight: 600;
  border-radius: 3px;
  padding: 1px 4px;
  flex-shrink: 0;
  line-height: 15px;
  letter-spacing: 0.2px;
}

.ifd-badge-type {
  font-size: 9px;
  font-weight: 700;
  border-radius: 3px;
  padding: 1px 4px;
  flex-shrink: 0;
  line-height: 15px;
}

.ifd-badge-domain {
  font-size: 9px;
  border-radius: 3px;
  padding: 1px 4px;
  line-height: 15px;
  margin-left: auto;
  flex-shrink: 0;
}

.ifd-node-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.35;
  flex: 1;
  padding: 3px 0 2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ifd-node-name--sm {
  font-size: 12px;
}

[data-theme='dark'] .ifd-node-name {
  color: var(--text-primary, #e8e8e8);
}

.ifd-node-foot {
  font-size: 9px;
  color: #aaa;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ifd-tx-code {
  background: rgba(114, 46, 209, 0.15);
  color: #722ed1;
  border-radius: 3px;
  padding: 0 3px;
  font-size: 8px;
  font-weight: 700;
  line-height: 14px;
}

.ifd-node-id {
  overflow: hidden;
  text-overflow: ellipsis;
}

.ifd-root-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
