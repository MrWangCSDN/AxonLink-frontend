<template>
  <section aria-label="重开人员统计">
    <p class="reopen-stat-total">
      <strong>{{ data.totalEvents || 0 }} 次</strong>
      总重开次数
    </p>
    <p>问题数按每次重开计 1，人员问题数可以加总。有调整权限的人员可点击问题数转移次数。</p>
    <div class="reopen-table-wrap">
      <table>
        <thead>
          <tr>
            <th>负责人</th>
            <th>问题数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="person in people" :key="person.username || 'unassigned'">
            <td>
              {{ person.realName || person.username || '待归属' }}
              <small v-if="person.username">{{ person.username }}</small>
            </td>
            <td>
              <button
                v-if="canTransferCounts && person.currentCount > 0"
                type="button"
                class="reopen-count-link"
                :data-testid="`transfer-count-${person.username || 'unassigned'}`"
                :aria-label="`转移${person.realName || person.username || '待归属'}的问题次数`"
                @click="$emit('transfer', person)"
              >{{ person.currentCount }}</button>
              <span v-else>{{ person.currentCount || 0 }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Object, required: true }, canTransferCounts: { type: Boolean, default: false } })
defineEmits(['transfer'])
const people = computed(() => [...(props.data.people || [])]
  .sort((left, right) => (Number(right.currentCount) || 0) - (Number(left.currentCount) || 0)))
</script>
