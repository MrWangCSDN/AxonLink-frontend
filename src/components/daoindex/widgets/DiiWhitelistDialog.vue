<template>
  <!-- V16：SQL 白名单审批工作流统一弹窗
       根据 mode 自动切换显示与操作：
         apply   - 申请人首次申请
         view    - 任意角色查看（read-only，状态终态时）
         l1      - 一级审批人审批
         l2      - 二级审批人审批
       open / mode 由父级控制 -->
  <div v-if="open" class="dii-modal-mask" @click.self="onClose">
    <div class="dii-modal" role="dialog">
      <div class="dii-modal-header">
        <h3>{{ titleText }}</h3>
        <button class="dii-modal-close" @click="onClose">×</button>
      </div>

      <div class="dii-modal-body">
        <!-- 类型 -->
        <div class="dii-form-row">
          <label class="dii-form-label">类型</label>
          <span class="dii-form-value">
            <span class="source-tag" :class="`source-${(rowType||'odb').toLowerCase()}`">
              {{ (rowType || 'odb').toLowerCase() }}
            </span>
          </span>
        </div>

        <!-- SQL 语句 -->
        <div class="dii-form-row dii-form-row-block">
          <label class="dii-form-label">SQL 语句</label>
          <pre class="dii-sql-snippet">{{ sqlPreview }}</pre>
        </div>

        <!-- nsql 类型才显示「包含 nsql 原始语句」 -->
        <div v-if="isNsql" class="dii-form-row">
          <label class="dii-form-label">包含 nsql 原始语句</label>
          <span class="dii-form-value">
            <label class="dii-check">
              <input
                type="checkbox"
                v-model="includeNamedSql"
                :disabled="!isEditableApply"
              />
              <span class="dii-check-text">
                同名 nsql 共享白名单
                <span class="dii-help" title="若勾选，该命名 SQL 所属的全部 nsql 均通过白名单验证（即按 named_sql 匹配；不勾选则按 sql_hash 精确匹配）"
                >?</span>
              </span>
            </label>
          </span>
        </div>

        <!-- V16+：申请作用域提示——非申请态显示「这是单条 SQL 白名单」还是「同名 nsql 共享白名单」 -->
        <div v-if="application?.target_type" class="dii-form-row">
          <label class="dii-form-label">作用域</label>
          <span class="dii-form-value">
            <span v-if="application.target_type === 'NAMED_SQL'" class="dii-scope dii-scope-named">
              同名 nsql 共享 ·  <code>{{ application.named_sql }}</code>
            </span>
            <span v-else class="dii-scope dii-scope-hash">
              单条 SQL（按 sql_hash 精确匹配）
            </span>
          </span>
        </div>

        <!-- 申请人 -->
        <div v-if="showApplicant" class="dii-form-row">
          <label class="dii-form-label">申请人</label>
          <span class="dii-form-value">{{ application?.applicant || currentUser || '—' }}</span>
        </div>

        <!-- 申请原因 -->
        <div class="dii-form-row dii-form-row-block">
          <label class="dii-form-label">申请原因</label>
          <textarea
            v-if="isEditableApply"
            v-model="applyReason"
            class="dii-form-input dii-form-textarea"
            placeholder="请填写申请白名单的业务原因"
            rows="3"
          />
          <span v-else class="dii-form-value">{{ application?.apply_reason || '—' }}</span>
        </div>

        <!-- 一级审批人（apply 时下拉；view/l1/l2 时显示已选） -->
        <div class="dii-form-row">
          <label class="dii-form-label">一级审批人</label>
          <select
            v-if="isEditableApply"
            v-model="l1Approver"
            class="dii-form-input"
          >
            <option value="">请选择</option>
            <option v-for="a in l1List" :key="a.username" :value="a.username">{{ a.display }}</option>
          </select>
          <span v-else class="dii-form-value">{{ displayApprover(application?.l1_approver, 'l1') }}</span>
        </div>

        <!-- L1 意见（view/l2 时只读显示） -->
        <div v-if="application && (application.status==='PENDING_L2'||application.status==='APPROVED'||application.status==='REJECTED_L1'||application.l1_opinion)" class="dii-form-row dii-form-row-block">
          <label class="dii-form-label">一级意见</label>
          <span class="dii-form-value">{{ application?.l1_opinion || '—' }}</span>
        </div>

        <!-- 二级审批人（仅 L1 通过时填；L2/view 显示已选） -->
        <div v-if="showL2Approver" class="dii-form-row">
          <label class="dii-form-label">二级审批人</label>
          <select
            v-if="mode==='l1' && !readOnly"
            v-model="l2Approver"
            class="dii-form-input"
          >
            <option value="">请选择</option>
            <option v-for="a in l2List" :key="a.username" :value="a.username">{{ a.display }}</option>
          </select>
          <span v-else class="dii-form-value">{{ displayApprover(application?.l2_approver, 'l2') }}</span>
        </div>

        <!-- L2 意见 -->
        <div v-if="application && (application.status==='APPROVED'||application.l2_opinion)" class="dii-form-row dii-form-row-block">
          <label class="dii-form-label">二级意见</label>
          <span class="dii-form-value">{{ application?.l2_opinion || '—' }}</span>
        </div>

        <!-- 审批意见输入（仅 L1 / L2 模式可编辑） -->
        <div v-if="mode==='l1' || mode==='l2'" class="dii-form-row dii-form-row-block">
          <label class="dii-form-label">审批意见</label>
          <textarea
            v-model="approvalOpinion"
            class="dii-form-input dii-form-textarea"
            placeholder="请填写审批意见"
            rows="3"
          />
        </div>

        <!-- 当前状态 badge -->
        <div v-if="application" class="dii-form-row">
          <label class="dii-form-label">当前状态</label>
          <span class="dii-form-value">
            <span class="status-badge" :class="`st-${(application.status||'').toLowerCase()}`">
              {{ statusLabel(application.status) }}
            </span>
          </span>
        </div>

        <div v-if="errorMsg" class="dii-form-error">{{ errorMsg }}</div>
      </div>

      <div class="dii-modal-footer">
        <!-- Apply 模式 -->
        <template v-if="mode==='apply'">
          <button class="dii-btn dii-btn-ghost" @click="onClose" :disabled="submitting">取消申请</button>
          <button class="dii-btn dii-btn-primary"
                  :disabled="!canApply || submitting"
                  @click="onApply">
            {{ submitting ? '提交中...' : '确认申请' }}
          </button>
        </template>
        <!-- L1 / L2 审批模式 -->
        <template v-else-if="mode==='l1' || mode==='l2'">
          <button class="dii-btn dii-btn-danger" :disabled="submitting" @click="onReject">退回申请</button>
          <button class="dii-btn dii-btn-primary"
                  :disabled="!canApprove || submitting"
                  @click="onApprove">
            {{ submitting ? '处理中...' : '确认申请' }}
          </button>
        </template>
        <!-- View 模式 + 申请人 + PENDING_L1/REJECTED_L1 可取消 -->
        <template v-else>
          <button v-if="canCancel"
                  class="dii-btn dii-btn-danger"
                  :disabled="submitting"
                  @click="onCancel">
            {{ submitting ? '取消中...' : '取消申请' }}
          </button>
          <button class="dii-btn dii-btn-ghost" @click="onClose">关闭</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  getWhitelistApprovers,
  applyWhitelist,
  l1Approve as apiL1Approve,
  l1Reject as apiL1Reject,
  l2Approve as apiL2Approve,
  l2Reject as apiL2Reject,
  cancelWhitelist,
} from '../../../api/daoIndex.js'

/**
 * Props:
 *   open       - boolean，控制显示
 *   mode       - 'apply' | 'view' | 'l1' | 'l2'
 *   row        - 当前 SQL 行（item 或 pool）{ id, sql_hash, sql_text, source, class_fqn... }
 *   application - 已存在的 application 对象（mode=view/l1/l2 时必填）
 *   currentUser - 当前登录用户名（用于 fallback 申请人 / 审批人）
 * Emits:
 *   update:open   - 关闭
 *   action-done   - 操作完成（父级刷新列表）
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'apply' },
  row: { type: Object, default: null },
  application: { type: Object, default: null },
  currentUser: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'action-done'])

const l1List = ref([])
const l2List = ref([])
const submitting = ref(false)
const errorMsg = ref('')

const includeNamedSql = ref(false)
const applyReason = ref('')
const l1Approver = ref('')
const l2Approver = ref('')
const approvalOpinion = ref('')

/* ─────────── derived ─────────── */
const rowType = computed(() => props.row?.source || 'odb')
const isNsql = computed(() => rowType.value === 'nsql')
const sqlPreview = computed(() => {
  const t = props.row?.sql_text || ''
  return t.length > 1500 ? t.slice(0, 1500) + '…' : t
})
const isEditableApply = computed(() => props.mode === 'apply')
const readOnly = computed(() => props.mode === 'view')
const showApplicant = computed(() => props.mode !== 'apply')
const showL2Approver = computed(() => props.mode === 'l1' || props.mode === 'l2' || (props.mode === 'view' && props.application?.l2_approver))

const canApply = computed(() => !!applyReason.value && !!l1Approver.value)
const canApprove = computed(() => {
  if (!approvalOpinion.value) return false
  if (props.mode === 'l1' && !l2Approver.value) return false
  return true
})
const canCancel = computed(() => {
  if (props.mode !== 'view') return false
  if (!props.application) return false
  if (props.application.applicant !== props.currentUser) return false
  return ['PENDING_L1', 'REJECTED_L1'].includes(props.application.status)
})

const titleText = computed(() => {
  switch (props.mode) {
    case 'apply': return '申请白名单'
    case 'l1':    return '一级审批 · 白名单申请'
    case 'l2':    return '二级审批 · 白名单申请'
    default:      return '白名单申请详情'
  }
})

/* ─────────── 打开时同步状态 + 拉名单 ─────────── */
watch(() => props.open, async (v) => {
  if (!v) return
  errorMsg.value = ''
  submitting.value = false
  approvalOpinion.value = ''
  // 申请模式重置；其他模式 prefill 当前申请
  if (props.mode === 'apply') {
    includeNamedSql.value = false
    applyReason.value = ''
    l1Approver.value = ''
    l2Approver.value = ''
  } else if (props.application) {
    includeNamedSql.value = props.application.target_type === 'NAMED_SQL'
    applyReason.value = props.application.apply_reason || ''
    l1Approver.value = props.application.l1_approver || ''
    l2Approver.value = props.application.l2_approver || ''
  }
  try {
    const data = await getWhitelistApprovers()
    l1List.value = data?.l1Approvers || []
    l2List.value = data?.l2Approvers || []
  } catch (e) {
    errorMsg.value = `加载审批人名单失败：${e?.message || e}`
  }
})

/* ─────────── 提交 / 审批 / 退回 / 取消 ─────────── */
function onClose() {
  if (submitting.value) return
  emit('update:open', false)
}

async function onApply() {
  if (!canApply.value || submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const body = {
      sqlHash: props.row?.sql_hash,
      namedSql: isNsql.value ? (props.row?.class_fqn || props.row?.named_sql) : null,
      sqlText: props.row?.sql_text,
      projectName: props.row?.project_name,
      env: props.row?.env,
      kindSource: rowType.value,
      includeNamedSql: isNsql.value && includeNamedSql.value,
      applyReason: applyReason.value,
      l1Approver: l1Approver.value,
      sourceTable: rowType.value === 'nsql' ? 'sql_pool' : 'item',
      sourceId: Number(props.row?.id) || 0,
      applicant: props.currentUser,
    }
    await applyWhitelist(body)
    emit('action-done')
    emit('update:open', false)
  } catch (e) {
    errorMsg.value = e?.message || '申请失败'
  } finally {
    submitting.value = false
  }
}

async function onApprove() {
  if (!canApprove.value || submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const body = {
      opinion: approvalOpinion.value,
      currentUser: props.currentUser,
      ...(props.mode === 'l1' ? { l2Approver: l2Approver.value } : {}),
    }
    const fn = props.mode === 'l1' ? apiL1Approve : apiL2Approve
    await fn(props.application.id, body)
    emit('action-done')
    emit('update:open', false)
  } catch (e) {
    errorMsg.value = e?.message || '审批失败'
  } finally {
    submitting.value = false
  }
}

async function onReject() {
  if (submitting.value) return
  if (!approvalOpinion.value) {
    errorMsg.value = '退回需填写审批意见'
    return
  }
  submitting.value = true
  errorMsg.value = ''
  try {
    const body = { opinion: approvalOpinion.value, currentUser: props.currentUser }
    const fn = props.mode === 'l1' ? apiL1Reject : apiL2Reject
    await fn(props.application.id, body)
    emit('action-done')
    emit('update:open', false)
  } catch (e) {
    errorMsg.value = e?.message || '退回失败'
  } finally {
    submitting.value = false
  }
}

async function onCancel() {
  if (submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    await cancelWhitelist(props.application.id, { currentUser: props.currentUser })
    emit('action-done')
    emit('update:open', false)
  } catch (e) {
    errorMsg.value = e?.message || '取消失败'
  } finally {
    submitting.value = false
  }
}

function displayApprover(username, level) {
  if (!username) return '—'
  const list = level === 'l1' ? l1List.value : l2List.value
  const hit = list.find((a) => a.username === username)
  return hit ? hit.display : username
}

function statusLabel(s) {
  return ({
    PENDING_L1: '一审中',
    PENDING_L2: '二审中',
    APPROVED:   '已通过',
    REJECTED_L1: '一审已退回',
    CANCELLED:  '已取消',
  })[s] || s || '—'
}
</script>

<style scoped>
.dii-modal-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dii-modal {
  width: 540px; max-width: 92vw;
  background: var(--bg-card, #fff);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-height: 92vh; overflow: auto;
}
.dii-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
}
.dii-modal-header h3 {
  margin: 0; font-size: 15px; font-weight: 600;
  color: var(--text-primary, #14171c);
}
.dii-modal-close {
  width: 28px; height: 28px;
  background: transparent; border: none;
  font-size: 20px; cursor: pointer;
  color: var(--text-secondary, #5a6172);
}
.dii-modal-body { padding: 16px 18px; }
.dii-form-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px;
}
.dii-form-row-block { align-items: flex-start; }
.dii-form-label {
  width: 100px; flex-shrink: 0;
  font-size: 12.5px;
  color: var(--text-secondary, #5a6172);
}
.dii-form-input {
  flex: 1;
  padding: 7px 10px; font-size: 13px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #14171c);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  outline: none;
}
.dii-form-textarea { font-family: inherit; }
.dii-form-input:focus { border-color: var(--text-link, #2563eb); }
.dii-form-value {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #14171c);
  word-break: break-all;
}
.dii-sql-snippet {
  flex: 1;
  margin: 0;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 1.5;
  background: var(--bg-domain-hover, #f5f7fa);
  border: 1px solid var(--border-subtle, #ebeef2);
  border-radius: 4px;
  color: var(--text-primary, #14171c);
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap; word-break: break-all;
}
.dii-check {
  display: inline-flex; align-items: center; gap: 6px;
  cursor: pointer;
}
.dii-check input[type="checkbox"] { margin: 0; }
.dii-check-text {
  font-size: 12.5px;
  color: var(--text-primary, #14171c);
  display: inline-flex; align-items: center; gap: 6px;
}
.dii-help {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--bg-domain-hover, #f5f7fa);
  border: 1px solid var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
  font-size: 10px; cursor: help;
}

.source-tag {
  padding: 1px 6px; border-radius: 3px;
  font-size: 10.5px; font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

.status-badge {
  padding: 2px 8px; font-size: 11.5px;
  border-radius: 3px;
}

/* V16+：作用域显示徽章——区分两种白名单模式 */
.dii-scope {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px; font-size: 12px;
  border-radius: 3px;
  border: 1px solid var(--border, #d4d8dd);
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-secondary, #5a6172);
}
.dii-scope code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  padding: 0 4px; border-radius: 2px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-subtle, #ebeef2);
}
.dii-scope-named {
  background: var(--c-accent-bg, #e6fcf2);
  color: var(--c-accent-text, #0a8559);
  border-color: var(--c-accent-border, #a7e4c8);
}
.dii-scope-hash {
  background: var(--c-info-bg, #e6f0fc);
  color: var(--c-info-text, #0b70db);
  border-color: var(--c-info-border, #b6d4f5);
}
[data-theme="dark"] .dii-scope-named {
  background: var(--c-accent-bg-dark, #1d3329);
  color: var(--c-accent-text-dark, #6ec78a);
  border-color: var(--c-accent-border-dark, #2f5a3c);
}
[data-theme="dark"] .dii-scope-hash {
  background: var(--c-info-bg-dark, #1f3050);
  color: var(--c-info-text-dark, #7eb8fd);
  border-color: var(--c-info-border-dark, #2f4a78);
}
.st-pending_l1, .st-pending_l2 {
  background: var(--bg-warning-soft, #fffbe6);
  color: var(--text-warning, #c08c00);
  border: 1px solid var(--border-warning, #ffd591);
}
.st-rejected_l1 {
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
}
.st-approved {
  background: var(--bg-success-soft, #f6ffed);
  color: var(--text-success, #137333);
  border: 1px solid var(--border-success, #b7eb8f);
}
.st-cancelled {
  background: var(--bg-domain-hover, #f5f7fa);
  color: var(--text-secondary, #5a6172);
  border: 1px solid var(--border, #d4d8dd);
}

.dii-form-error {
  margin-top: 6px; padding: 8px 10px;
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
  border-radius: 4px;
  font-size: 12.5px;
}

.dii-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 10px 18px 14px;
  border-top: 1px solid var(--border-subtle, #ebeef2);
}
.dii-btn {
  padding: 6px 16px; font-size: 13px;
  border-radius: 4px; cursor: pointer;
  border: 1px solid transparent;
}
.dii-btn-ghost {
  background: transparent;
  border-color: var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
}
.dii-btn-ghost:hover:not(:disabled) { background: var(--bg-domain-hover, #f5f7fa); }
.dii-btn-primary {
  background: var(--text-link, #2563eb);
  color: #fff;
}
.dii-btn-primary:hover:not(:disabled) { background: var(--text-link-hover, #1d4ed8); }
.dii-btn-danger {
  background: var(--text-error, #cf1124);
  color: #fff;
}
.dii-btn-danger:hover:not(:disabled) { background: var(--text-error-hover, #b00d20); }
.dii-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* dark 主题：亮一档 */
[data-theme="dark"] .dii-modal-mask { background: rgba(0, 0, 0, 0.6); }
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
[data-theme="dark"] .st-pending_l1, [data-theme="dark"] .st-pending_l2 {
  background: var(--bg-warning-soft-dark, #3a2e15);
  color: var(--text-warning-dark, #f5c062);
  border-color: var(--border-warning-dark, #7a5e1f);
}
[data-theme="dark"] .st-rejected_l1 {
  background: var(--bg-error-soft-dark, #3d1f1f);
  color: var(--text-error-dark, #ff7a7e);
  border-color: var(--border-error-dark, #6b3030);
}
[data-theme="dark"] .st-approved {
  background: var(--bg-success-soft-dark, #1e3320);
  color: var(--text-success-dark, #6ec78a);
  border-color: var(--border-success-dark, #2f5a32);
}
[data-theme="dark"] .dii-form-error {
  background: var(--bg-error-soft-dark, #3d1f1f);
  border-color: var(--border-error-dark, #6b3030);
  color: var(--text-error-dark, #ff7a7e);
}
[data-theme="dark"] .dii-btn-primary {
  background: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
[data-theme="dark"] .dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover-dark, #93bbfd);
}
</style>
