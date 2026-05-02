export type WorkerStatus = 'free' | 'on_the_way' | 'busy' | 'on_break'

export type JobStatus =
  | 'scheduled'
  | 'assigned'
  | 'on_the_way'
  | 'in_progress'
  | 'done'
  | 'cancelled'

export interface Worker {
  id: string
  name: string | null
  status: WorkerStatus
  current_job_id?: string | null
}

export interface Job {
  id: string
  title?: string | null
  address?: string | null
  adress?: string | null
  scheduled_time?: string | null
  status?: JobStatus
  worker_id?: string | null
  assigned_worker_id?: string | null
}
