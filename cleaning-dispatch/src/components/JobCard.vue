<script setup lang="ts">
import { computed } from 'vue'
import type { Job } from '../types'
import { useDispatchStore } from '../stores/dispatchStore'
import { formatJobStatus, getStatusClass } from '../utils/status'

const props = withDefaults(defineProps<{
  job: Job
  formattedTime: string
  title: string
  assignedName: string
  showActions?: boolean
}>(), {
  showActions: false,
})

const store = useDispatchStore()
const assignedWorkerId = computed(() =>
  props.job.assigned_worker_id ?? props.job.worker_id ?? null
)
</script>

<template>
  <div
    class="card job-card"
    draggable="true"
    @dragstart="$event.dataTransfer?.setData('jobId', job.id)"
  >
    <p class="job-time">{{ formattedTime }}</p>
    <strong>{{ title }}</strong>
    <p>📍 {{ job.address ?? job.adress ?? 'No address provided' }}</p>
    <p :class="['status', getStatusClass(job.status ?? 'scheduled')]">
      {{ formatJobStatus(job.status ?? 'scheduled') }}
    </p>
    <p v-if="assignedName !== '-'">👤 Assigned: {{ assignedName }}</p>

    <div v-if="showActions && assignedWorkerId" class="quick-actions">
      <button
        type="button"
        @click.stop="store.markOnTheWay(job.id, assignedWorkerId)"
      >
        On the way
      </button>
      <button
        type="button"
        @click.stop="store.startJob(job.id, assignedWorkerId)"
      >
        Start
      </button>
      <button
        type="button"
        @click.stop="store.markDone(job.id, assignedWorkerId)"
      >
        Done
      </button>
    </div>
  </div>
</template>
