<script setup lang="ts">
import type { Job } from '../types'
import { formatJobStatus, getStatusClass } from '../utils/status'

const { job, formattedTime, title, assignedName } = defineProps<{
  job: Job
  formattedTime: string
  title: string
  assignedName: string
}>()
</script>

<template>
  <div
    class="card job-card"
    draggable="true"
    @dragstart="$event.dataTransfer?.setData('jobId', job.id)"
  >
    <strong>{{ formattedTime }} - {{ title }}</strong>
    <p>📍 {{ job.address ?? job.adress ?? 'No address provided' }}</p>
    <p>👤 Assigned: {{ assignedName }}</p>
    <small
      class="status-pill"
      :class="getStatusClass(job.status ?? 'scheduled')"
    >
      {{ formatJobStatus(job.status ?? 'scheduled') }}
    </small>
  </div>
</template>
