export type WorkerStatus = 'free' | 'on_the_way' | 'busy' | 'on_break'

export type JobStatus = 'scheduled' | 'assigned' | 'in_progress' | 'done' | 'cancelled'

export interface Worker {
  id: string
  name: string
  status: WorkerStatus
  current_job_id?: string | null
}

export interface Job {
  id: string
  title?: string
  address?: string
  adress?: string
  scheduled_time: string
  status?: JobStatus
  worker_id?: string | null
  assigned_worker_id?: string | null
}
