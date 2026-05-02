<script setup lang="ts">
import { ref } from 'vue'
import type { Job, Worker } from '../types'

const { worker, assignedJob } = defineProps<{
  worker: Worker
  assignedJob?: Job
}>()

const emit = defineEmits<{
  (e: 'drop', event: DragEvent): void
  (e: 'jobDragStart', event: DragEvent, jobId: string): void
}>()

const isDragOver = ref(false)

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  emit('drop', event)
}

const formatTime = (scheduledTime: string) => {
  const date = new Date(scheduledTime)
  if (Number.isNaN(date.getTime())) return scheduledTime
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getTitle = (job: Job) => job.title || job.address || job.adress || 'Untitled job'

const handleJobDragStart = (event: DragEvent) => {
  if (assignedJob) {
    emit('jobDragStart', event, assignedJob.id)
  }
}
</script>

<template>
  <div
    class="card worker-card"
    :class="{ 'drop-active': isDragOver, 'worker-busy': worker.status === 'busy' }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <strong>{{ worker.name }}</strong>
    <p class="worker-status">Status: {{ worker.status }}</p>
    <div
      v-if="assignedJob"
      class="assigned-job"
      draggable="true"
      @dragstart="handleJobDragStart"
    >
      <strong>{{ formatTime(assignedJob.scheduled_time) }} - {{ getTitle(assignedJob) }}</strong>
      <p>📍 {{ assignedJob.address || assignedJob.adress || 'No address provided' }}</p>
      <small>Status: {{ assignedJob.status ?? 'assigned' }}</small>
    </div>
    <div v-if="isDragOver" class="drop-text">Drop job here</div>
  </div>
</template>
