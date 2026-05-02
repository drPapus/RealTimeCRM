import type { JobStatus, WorkerStatus } from '../types'

export function formatJobStatus(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    scheduled: 'Scheduled',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    done: 'Done',
    cancelled: 'Cancelled',
  }

  return labels[status]
}

export function formatWorkerStatus(status: WorkerStatus): string {
  const labels: Record<WorkerStatus, string> = {
    free: 'Free',
    on_the_way: 'On the way',
    busy: 'Busy',
    on_break: 'On break',
  }

  return labels[status]
}

export function getStatusClass(status: JobStatus | WorkerStatus): string {
  const classes: Record<string, string> = {
    scheduled: 'status-gray',
    assigned: 'status-yellow',
    in_progress: 'status-blue',
    done: 'status-green',
    cancelled: 'status-red',

    free: 'status-green',
    on_the_way: 'status-blue',
    busy: 'status-red',
    on_break: 'status-yellow',
  }

  return classes[status] ?? 'status-gray'
}
