<template>
  <div class="user-page">
    <div class="dii-sticky">
      <div class="dii-breadcrumb">
        <span class="dii-bc-home">系统管理</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M5 3.5L8.5 7L5 10.5" stroke="#C5CBD7" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="dii-bc-current">用户管理</span>
      </div>
      <div class="dii-header">
        <div>
          <h2 class="dii-title">用户管理</h2>
          <p class="dii-subtitle">共 {{ total }} 个用户</p>
        </div>
        <div class="dii-header-right">
          <button class="btn-primary" @click="showAdd">+ 新增用户</button>
        </div>
      </div>
    </div>

    <div class="dii-scroll">
      <div class="filter-bar">
        <input
          v-model="keyword"
          class="filter-input"
          placeholder="搜索用户名 / 姓名 / 工号"
          @keyup.enter="onSearch"
        />
        <select v-model="statusFilter" class="filter-select" @change="onSearch">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
        <button class="btn-default" @click="onSearch">查询</button>
        <button class="btn-link" @click="onReset">重置</button>
      </div>

      <div v-if="loading" class="state-text">加载中...</div>
      <div v-else-if="errorMsg" class="state-text error">{{ errorMsg }}</div>
      <div v-else-if="rows.length === 0" class="state-text">暂无用户数据</div>
      <table v-else class="user-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>姓名</th>
            <th>工号</th>
            <th>部门</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>状态</th>
            <th>创建时间</th>
            <th class="col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in rows" :key="u.id">
            <td class="cell-name">{{ u.username }}</td>
            <td>{{ u.realName || '—' }}</td>
            <td>{{ u.empNo || '—' }}</td>
            <td>{{ u.department || '—' }}</td>
            <td>{{ u.email || '—' }}</td>
            <td>{{ u.phone || '—' }}</td>
            <td>
              <span :class="['status-tag', u.status === 1 ? 'on' : 'off']">
                {{ u.status === 1 ? '启用' : '禁用' }}
              </span>
            </td>
            <td class="cell-time">{{ formatTime(u.createTime) }}</td>
            <td class="col-op">
              <button class="btn-link" @click="showEdit(u)">编辑</button>
              <button v-if="u.status === 1" class="btn-link danger" @click="onToggle(u)">禁用</button>
              <button v-else class="btn-link" @click="onToggle(u)">启用</button>
              <button class="btn-link danger" @click="onDelete(u)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > size" class="pager">
        <button class="pager-btn" :disabled="page === 1" @click="page--">‹</button>
        <span class="pager-info">第 {{ page }} / {{ totalPages }} 页（{{ total }} 条）</span>
        <button class="pager-btn" :disabled="page === totalPages" @click="page++">›</button>
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span>{{ dialogMode === 'add' ? '新增用户' : '编辑用户' }}</span>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>用户名<span class="required">*</span></label>
            <input
              v-model="form.username"
              class="form-input"
              :disabled="dialogMode === 'edit'"
              placeholder="请输入用户名"
            />
          </div>
          <div class="form-row">
            <label>真实姓名</label>
            <input v-model="form.realName" class="form-input" placeholder="请输入真实姓名" />
          </div>
          <div class="form-row">
            <label>工号</label>
            <input v-model="form.empNo" class="form-input" placeholder="请输入工号" />
          </div>
          <div class="form-row">
            <label>部门</label>
            <input v-model="form.department" class="form-input" placeholder="请输入部门" />
          </div>
          <div class="form-row">
            <label>邮箱</label>
            <input v-model="form.email" class="form-input" placeholder="请输入邮箱" />
          </div>
          <div class="form-row">
            <label>手机号</label>
            <input v-model="form.phone" class="form-input" placeholder="请输入手机号" />
          </div>
          <div class="form-row" v-if="dialogMode === 'add'">
            <label>状态</label>
            <select v-model="form.status" class="form-input">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="form.remark" class="form-input" rows="2" placeholder="可选" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-default" @click="dialogVisible = false">取消</button>
          <button class="btn-primary" :disabled="saving" @click="onSave">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  getUserPage, createUser, updateUser, updateUserStatus, deleteUser,
} from '../../api/user.js'

const keyword = ref('')
const statusFilter = ref('')
const page = ref(1)
const size = ref(20)
const total = ref(0)
const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')

const dialogVisible = ref(false)
const dialogMode = ref('add')
const saving = ref(false)
const form = ref(blankForm())

function blankForm() {
  return {
    id: null,
    username: '',
    realName: '',
    empNo: '',
    department: '',
    email: '',
    phone: '',
    status: 1,
    remark: '',
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await getUserPage({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === '' ? undefined : Number(statusFilter.value),
      page: page.value,
      size: size.value,
    })
    rows.value = data.list || []
    total.value = data.total || 0
  } catch (e) {
    errorMsg.value = '加载失败：' + (e?.message || e)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}
function onReset() {
  keyword.value = ''
  statusFilter.value = ''
  onSearch()
}

function showAdd() {
  form.value = blankForm()
  dialogMode.value = 'add'
  dialogVisible.value = true
}
function showEdit(row) {
  form.value = { ...blankForm(), ...row }
  dialogMode.value = 'edit'
  dialogVisible.value = true
}

async function onSave() {
  if (!form.value.username.trim()) {
    alert('用户名不能为空')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    delete payload.id
    delete payload.createTime
    delete payload.updateTime
    delete payload.creatorId
    delete payload.updaterId
    if (dialogMode.value === 'add') {
      await createUser(payload)
    } else {
      await updateUser(form.value.id, payload)
    }
    dialogVisible.value = false
    await load()
  } catch (e) {
    alert(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onToggle(row) {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '禁用'
  if (!confirm(`确定要${action}用户「${row.username}」吗？`)) return
  try {
    await updateUserStatus(row.id, newStatus)
    await load()
  } catch (e) {
    alert(e?.message || '操作失败')
  }
}

async function onDelete(row) {
  if (!confirm(`确定要删除用户「${row.username}」吗？此操作不可恢复。`)) return
  try {
    await deleteUser(row.id)
    await load()
  } catch (e) {
    alert(e?.message || '删除失败')
  }
}

function formatTime(s) {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 19)
}

onMounted(load)
</script>

<style scoped>
.user-page { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

.dii-sticky { flex-shrink: 0; padding: 18px 24px 14px; background: var(--bg-sticky, #fff); border-bottom: 1px solid var(--border-subtle, #ebeef2); }
.dii-breadcrumb { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; font-size: 12.5px; color: var(--text-faint, #8990a0); }
.dii-bc-current { color: var(--text-primary, #14171c); font-weight: 500; }
.dii-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dii-title { margin: 0; font-size: 18px; font-weight: 600; }
.dii-subtitle { margin: 4px 0 0; font-size: 12.5px; color: var(--text-secondary, #5a6172); }

.dii-scroll { flex: 1; overflow-y: auto; padding: 16px 24px 32px; }

.filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.filter-input, .filter-select, .form-input {
  height: 30px; padding: 0 10px; border: 1px solid var(--border, #d4d8dd);
  border-radius: 6px; font-size: 12.5px; color: var(--text-primary, #14171c);
  background: var(--bg-input, #fff); outline: none; transition: border-color 0.15s;
}
.filter-input { width: 240px; }
.filter-select { padding: 0 8px; cursor: pointer; }
.filter-input:focus, .filter-select:focus, .form-input:focus { border-color: var(--accent, #6366f1); }

.btn-primary, .btn-default, .btn-link {
  height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12.5px;
  cursor: pointer; transition: all 0.15s; border: 1px solid transparent;
}
.btn-primary { background: var(--accent, #6366f1); color: #fff; border-color: var(--accent, #6366f1); }
.btn-primary:hover { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-default { background: var(--bg-card, #fff); color: var(--text-secondary, #5a6172); border-color: var(--border, #d4d8dd); }
.btn-default:hover { border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); }
.btn-link { background: transparent; color: var(--accent, #6366f1); height: auto; padding: 0 4px; border: none; }
.btn-link:hover { text-decoration: underline; }
.btn-link.danger { color: #cf1124; }

.state-text { padding: 60px 0; text-align: center; color: var(--text-secondary, #5a6172); font-size: 13px; }
.state-text.error { color: #cf1124; }

.user-table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: var(--bg-card, #fff); }
.user-table th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 500; color: var(--text-muted, #8c94a6); border-bottom: 1px solid var(--border-subtle, #ebeef2); white-space: nowrap; }
.user-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-subtle, #ebeef2); vertical-align: middle; }
.user-table tr:hover td { background: var(--bg-hover, #f7f8fa); }
.cell-name { font-weight: 500; }
.cell-time { font-family: ui-monospace, monospace; color: var(--text-secondary, #5a6172); white-space: nowrap; }
.col-op { white-space: nowrap; }

.status-tag { display: inline-block; padding: 1px 8px; border-radius: 20px; font-size: 11px; }
.status-tag.on { background: #ecfdf5; color: #15803d; border: 1px solid #bbf7d0; }
.status-tag.off { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }

.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle, #ebeef2); }
.pager-btn { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border, #d4d8dd); border-radius: 6px; background: var(--bg-card, #fff); color: var(--text-secondary, #5a6172); font-size: 16px; cursor: pointer; }
.pager-btn:hover:not(:disabled) { border-color: var(--accent, #6366f1); color: var(--accent, #6366f1); }
.pager-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pager-info { font-size: 12.5px; color: var(--text-secondary, #5a6172); }

/* Dialog */
.dialog-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { width: 480px; max-height: 90vh; background: var(--bg-card, #fff); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.dialog-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle, #ebeef2); font-size: 14px; font-weight: 600; }
.dialog-close { background: transparent; border: none; font-size: 18px; color: var(--text-muted, #8c94a6); cursor: pointer; }
.dialog-body { padding: 16px; overflow-y: auto; flex: 1; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 12px; gap: 8px; }
.form-row label { width: 80px; flex-shrink: 0; font-size: 12.5px; color: var(--text-secondary, #5a6172); padding-top: 6px; text-align: right; }
.form-row .form-input { flex: 1; min-width: 0; }
.required { color: #cf1124; margin-left: 2px; }
.dialog-footer { padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-subtle, #ebeef2); }
</style>
