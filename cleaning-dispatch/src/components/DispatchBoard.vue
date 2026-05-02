<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useDispatchStore } from '../stores/dispatchStore'
import JobCard from './JobCard.vue'
import WorkerCard from './WorkerCard.vue'
import type { Job } from '../types'

const store = useDispatchStore()
const isJobsDragOver = ref(false)

const formatTime = (scheduledTime?: string | null) => {
  if (!scheduledTime) return 'No time'

  const date = new Date(scheduledTime)
  if (Number.isNaN(date.getTime())) return scheduledTime
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getAssignedName = (job: Job) => {
  const assignedId = job.worker_id ?? job.assigned_worker_id
  const worker = store.workers.find((worker) => worker.id === assignedId)
  return worker?.name ?? '-'
}

const getTitle = (job: Job) => job.title || job.address || job.adress || 'Untitled job'

const unassignedJobs = computed(() =>
  store.jobs.filter((job) => !job.worker_id && !job.assigned_worker_id)
)

const isActiveJob = (job: Job) => job.status !== 'done' && job.status !== 'cancelled'

const getAssignedJob = (workerId: string) => {
  const worker = store.workers.find((worker) => worker.id === workerId)
  const currentJob = worker?.current_job_id
    ? store.jobs.find((job) => job.id === worker.current_job_id && isActiveJob(job))
    : null

  return currentJob ?? store.jobs.find(
    (job) =>
      isActiveJob(job) &&
      (job.worker_id === workerId || job.assigned_worker_id === workerId)
  )
}

const handleWorkerDrop = async (event: DragEvent, workerId: string) => {
  const jobId = event.dataTransfer?.getData('jobId')
  if (jobId) await store.assignJob(jobId, workerId)
}

const handleJobsDragOver = (event: DragEvent) => {
  event.preventDefault()
  isJobsDragOver.value = true
}

const handleJobsDragLeave = () => {
  isJobsDragOver.value = false
}

const handleJobsDrop = (event: DragEvent) => {
  event.preventDefault()
  isJobsDragOver.value = false

  const jobId = event.dataTransfer?.getData('jobId')
  if (jobId) store.unassignJob(jobId)
}

onMounted(async () => {
  await store.fetchData()
  store.subscribeRealtime()
})

onUnmounted(() => {
  store.unsubscribeRealtime()
})
</script>

<template>
  <div>
    <section class="board">
      <div
        class="column jobs-column"
        :class="{ 'drop-active': isJobsDragOver }"
        @dragover="handleJobsDragOver"
        @dragleave="handleJobsDragLeave"
        @drop="handleJobsDrop"
      >
        <h2>Jobs</h2>
        <div v-if="isJobsDragOver" class="drop-text">Drop job here to unassign</div>
        <JobCard
          v-for="job in unassignedJobs"
          :key="job.id"
          :job="job"
          :formattedTime="formatTime(job.scheduled_time)"
          :title="getTitle(job)"
          :assignedName="getAssignedName(job)"
        />
      </div>

      <div class="column">
        <h2>Workers</h2>
        <WorkerCard
          v-for="worker in store.workers"
          :key="worker.id"
          :worker="worker"
          :assignedJob="getAssignedJob(worker.id)"
          @drop="event => handleWorkerDrop(event, worker.id)"
        />
      </div>
    </section>
  </div>
</template>
