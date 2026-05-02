<script setup lang="ts">
import type { Job } from '../types'

const { job, formattedTime, title, assignedName } = defineProps<{
  job: Job
  formattedTime: string
  title: string
  assignedName: string
}>()

const emit = defineEmits<{
  (e: 'dragstart', event: DragEvent): void
}>()
</script>

<template>
  <div
    class="card job-card"
    draggable="true"
    @dragstart="emit('dragstart', $event)"
  >
    <strong>{{ formattedTime }} - {{ title }}</strong>
    <p>📍 {{ job.address ?? job.address ?? 'No address provided' }}</p>
    <p>👤 Assigned: {{ assignedName }}</p>
    <small>Status: {{ job.status ?? 'scheduled' }}</small>
  </div>
</template>
