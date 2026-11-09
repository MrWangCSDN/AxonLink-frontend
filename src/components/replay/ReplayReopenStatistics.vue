<template>
  <section aria-label="重开人员统计">
    <p class="reopen-stat-total">
      <strong>{{ data.totalEvents || 0 }} 次</strong>
      重开 · {{ data.distinctIssues || 0 }} 个问题 · {{ data.pendingEvents || 0 }} 次待审 · {{ unassignedCount }} 次待归属
    </p>
    <p>统计覆盖全部匹配事件。发生批次决定统计范围；责任调整不改变重开事实和总次数。人员问题数按 issue_key 去重，不能相加作为总问题数。</p>
    <div class="reopen-table-wrap">
      <table>
        <thead>
          <tr>
            <th>负责人</th>
            <th>默认次数</th>
            <th>调整转入</th>
            <th>调整转出</th>
            <th>当前次数</th>
            <th>待审次数</th>
            <th>问题数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="person in data.people || []" :key="person.username || 'unassigned'">
            <td>
              {{ person.realName || person.username || '待归属' }}
              <small v-if="person.username">{{ person.username }}</small>
            </td>
            <td>{{ person.defaultCount }}</td>
            <td>{{ person.adjustedIn }}</td>
            <td>{{ person.adjustedOut }}</td>
            <td>{{ person.currentCount }}</td>
            <td>{{ person.pendingCount || 0 }}</td>
            <td>{{ person.issueCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <h3>发生批次 × 当前负责人</h3>
    <div class="reopen-table-wrap">
      <table>
        <thead>
          <tr>
            <th>发生批次</th>
            <th>重开总次数</th>
            <th v-for="person in people" :key="person.username || 'unassigned'">{{ person.realName || person.username || '待归属' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="batch in data.batches || []" :key="batch.batchName">
            <td>{{ batch.batchName || '未记录批次' }}</td>
            <td>{{ batch.totalEvents }}</td>
            <td v-for="person in people" :key="person.username || 'unassigned'">{{ (batch.people || []).find(p => p.username === person.username)?.currentCount || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Object, required: true } })
const unassignedCount = computed(() => (props.data.people || []).filter(person => !person.username).reduce((sum, person) => sum + (person.currentCount || 0), 0))
const people = computed(() => {
  const result = new Map()
  for (const person of [...(props.data.people || []), ...(props.data.batches || []).flatMap(b => b.people || [])]) result.set(person.username, person)
  return [...result.values()]
})
</script>
