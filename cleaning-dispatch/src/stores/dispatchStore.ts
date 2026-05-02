import { defineStore } from 'pinia'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Job, Worker, WorkerStatus } from '../types'

type DispatchTable = 'jobs' | 'workers'
type DispatchRealtimeRow = Record<string, unknown>

let dispatchRealtimeChannel: RealtimeChannel | null = null

const sortJobs = (jobs: Job[]) =>
  [...jobs].sort((a, b) =>
    (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '')
  )

const sortWorkers = (workers: Worker[]) =>
  [...workers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

const upsertById = <T extends { id: string }>(rows: T[], row: T) => {
  const index = rows.findIndex((existingRow) => existingRow.id === row.id)
  if (index === -1) return [...rows, row]

  const nextRows = [...rows]
  nextRows[index] = row
  return nextRows
}

const removeById = <T extends { id: string }>(rows: T[], id: string) =>
  rows.filter((row) => row.id !== id)

const isMissingCurrentJobIdError = (message: string) =>
  message.includes("'current_job_id' column") ||
  message.includes('"current_job_id" column')

const isMissingAssignedWorkerIdError = (message: string) =>
  message.includes("'assigned_worker_id' column") ||
  message.includes('"assigned_worker_id" column')

export const useDispatchStore = defineStore('dispatch', {
  state: () => ({
    jobs: [] as Job[],
    workers: [] as Worker[],
    loading: false,
    error: '' as string,
  }),

  actions: {
    async fetchData() {
      this.loading = true
      this.error = ''

      const [jobsResult, workersResult] = await Promise.all([
        supabase.from('jobs').select('*').order('scheduled_time'),
        supabase.from('workers').select('*').order('name'),
      ])

      if (jobsResult.error) {
        console.error('Jobs fetch failed:', jobsResult.error)
        this.error = `Jobs fetch failed: ${jobsResult.error.message}`
      }
      if (workersResult.error) {
        console.error('Workers fetch failed:', workersResult.error)
        this.error = `Workers fetch failed: ${workersResult.error.message}`
      }

      this.jobs = jobsResult.data ?? []
      this.workers = workersResult.data ?? []
      this.loading = false
    },

    applyRealtimeChange(
      table: DispatchTable,
      payload: RealtimePostgresChangesPayload<DispatchRealtimeRow>
    ) {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id as string | undefined
        if (!deletedId) {
          void this.fetchData()
          return
        }

        if (table === 'jobs') {
          this.jobs = removeById(this.jobs, deletedId)
        } else {
          this.workers = removeById(this.workers, deletedId)
        }
        return
      }

      if (table === 'jobs') {
        this.jobs = sortJobs(upsertById(this.jobs, payload.new as unknown as Job))
      } else {
        this.workers = sortWorkers(upsertById(this.workers, payload.new as unknown as Worker))
      }
    },

    async updateWorkerStatus(
      workerId: string,
      status: WorkerStatus,
      currentJobId: string | null
    ) {
      const workerUpdate = await supabase
        .from('workers')
        .update({
          status,
          current_job_id: currentJobId ?? null,
        })
        .eq('id', workerId)

      if (
        workerUpdate.error &&
        isMissingCurrentJobIdError(workerUpdate.error.message)
      ) {
        return supabase
          .from('workers')
          .update({ status })
          .eq('id', workerId)
      }

      return workerUpdate
    },

    async updateJobAssignment(
      jobId: string,
      workerId: string | null,
      status: Job['status']
    ) {
      const jobUpdate = await supabase
        .from('jobs')
        .update({
          assigned_worker_id: workerId,
          status,
        })
        .eq('id', jobId)

      if (jobUpdate.error && isMissingAssignedWorkerIdError(jobUpdate.error.message)) {
        return supabase
          .from('jobs')
          .update({
            worker_id: workerId,
            status,
          })
          .eq('id', jobId)
      }

      return jobUpdate
    },

    async assignJob(jobId: string, workerId: string) {
      if (!jobId || !workerId) return

      const job = this.jobs.find((j) => j.id === jobId)
      const worker = this.workers.find((w) => w.id === workerId)

      if (!job || !worker) return

      const previousJob = { ...job }
      const previousWorker = { ...worker }

      job.worker_id = workerId
      job.assigned_worker_id = workerId
      job.status = 'assigned'
      worker.status = 'on_the_way'
      worker.current_job_id = jobId

      const jobUpdate = await this.updateJobAssignment(jobId, workerId, 'assigned')

      if (jobUpdate.error) {
        console.error('Job update failed:', jobUpdate.error)
        this.error = `Job update failed: ${jobUpdate.error.message}`
        Object.assign(job, previousJob)
        Object.assign(worker, previousWorker)
        return
      }

      const workerUpdate = await this.updateWorkerStatus(workerId, 'on_the_way', jobId)

      if (workerUpdate.error) {
        console.error('Worker update failed:', workerUpdate.error)
        this.error = `Worker update failed: ${workerUpdate.error.message}`
        Object.assign(job, previousJob)
        Object.assign(worker, previousWorker)
        return
      }
      this.error = ''
    },

    async markOnTheWay(jobId: string, workerId: string) {
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'on_the_way' })
        .eq('id', jobId)

      if (jobError) {
        console.error('Job update failed:', jobError)
        this.error = `Job update failed: ${jobError.message}`
        return
      }

      const { error: workerError } = await this.updateWorkerStatus(
        workerId,
        'on_the_way',
        jobId
      )

      if (workerError) {
        console.error('Worker update failed:', workerError)
        this.error = `Worker update failed: ${workerError.message}`
        return
      }

      await supabase.from('events').insert({
        type: 'worker_on_the_way',
        job_id: jobId,
        worker_id: workerId,
      })

      this.error = ''
      await this.fetchData()
    },

    async startJob(jobId: string, workerId: string) {
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'in_progress' })
        .eq('id', jobId)

      if (jobError) {
        console.error('Job update failed:', jobError)
        this.error = `Job update failed: ${jobError.message}`
        return
      }

      const { error: workerError } = await this.updateWorkerStatus(
        workerId,
        'busy',
        jobId
      )

      if (workerError) {
        console.error('Worker update failed:', workerError)
        this.error = `Worker update failed: ${workerError.message}`
        return
      }

      await supabase.from('events').insert({
        type: 'job_started',
        job_id: jobId,
        worker_id: workerId,
      })

      this.error = ''
      await this.fetchData()
    },

    async markDone(jobId: string, workerId: string) {
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'done' })
        .eq('id', jobId)

      if (jobError) {
        console.error('Job update failed:', jobError)
        this.error = `Job update failed: ${jobError.message}`
        return
      }

      const { error: workerError } = await this.updateWorkerStatus(
        workerId,
        'free',
        null
      )

      if (workerError) {
        console.error('Worker update failed:', workerError)
        this.error = `Worker update failed: ${workerError.message}`
        return
      }

      await supabase.from('events').insert({
        type: 'job_completed',
        job_id: jobId,
        worker_id: workerId,
      })

      this.error = ''
      await this.fetchData()
    },

    async unassignJob(jobId: string) {
      const job = this.jobs.find((j) => j.id === jobId)
      if (!job) return

      const workerId = job.worker_id ?? job.assigned_worker_id
      const worker = workerId
        ? this.workers.find((w) => w.id === workerId)
        : null
      const previousJob = { ...job }
      const previousWorker = worker ? { ...worker } : null

      job.worker_id = null
      job.assigned_worker_id = null
      job.status = 'scheduled'
      if (worker?.current_job_id === jobId) {
        worker.current_job_id = null
      }

      const hasOtherAssignedJobs = this.jobs.some(
        (otherJob) =>
          otherJob.id !== jobId &&
          (otherJob.worker_id === workerId || otherJob.assigned_worker_id === workerId)
      )

      if (worker && !hasOtherAssignedJobs) {
        worker.status = 'free'
      }

      const jobUpdate = await this.updateJobAssignment(jobId, null, 'scheduled')

      if (jobUpdate.error) {
        console.error('Job unassign failed:', jobUpdate.error)
        this.error = `Job unassign failed: ${jobUpdate.error.message}`
        Object.assign(job, previousJob)
        if (worker && previousWorker) Object.assign(worker, previousWorker)
        return
      }

      if (worker && !hasOtherAssignedJobs) {
        const workerUpdate = await this.updateWorkerStatus(worker.id, 'free', null)

        if (workerUpdate.error) {
          console.error('Worker reset failed:', workerUpdate.error)
          this.error = `Worker reset failed: ${workerUpdate.error.message}`
          Object.assign(job, previousJob)
          if (previousWorker) Object.assign(worker, previousWorker)
          return
        }
      }

      this.error = ''
    },

    subscribeRealtime() {
      if (dispatchRealtimeChannel) return

      dispatchRealtimeChannel = supabase
        .channel('dispatch-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs' },
          (payload) => this.applyRealtimeChange('jobs', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workers' },
          (payload) => this.applyRealtimeChange('workers', payload)
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.error = `Realtime sync failed: ${status}`
          }
        })
    },

    unsubscribeRealtime() {
      if (!dispatchRealtimeChannel) return

      void supabase.removeChannel(dispatchRealtimeChannel)
      dispatchRealtimeChannel = null
    },
  },
})
