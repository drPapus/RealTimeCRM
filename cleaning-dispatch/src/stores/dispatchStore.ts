import { defineStore } from 'pinia'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Job, Worker } from '../types'

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

    async assignJob(jobId: string, workerId: string) {
      const job = this.jobs.find((j) => j.id === jobId)
      const worker = this.workers.find((w) => w.id === workerId)

      if (!job || !worker) return

      const previousJob = { ...job }
      const previousWorker = { ...worker }

      job.worker_id = workerId
      job.status = 'assigned'
      worker.status = 'busy'

      const jobUpdate = await supabase
        .from('jobs')
        .update({
          worker_id: workerId,
          status: 'assigned',
        })
        .eq('id', jobId)
        .select()

        console.log('jobUpdate:', jobUpdate)
        console.log('assignJob params:', { jobId, workerId })

      if (jobUpdate.error) {
        console.error('Job update failed:', jobUpdate.error)
        this.error = `Job update failed: ${jobUpdate.error.message}`
        Object.assign(job, previousJob)
        Object.assign(worker, previousWorker)
        return
      }

      const workerUpdate = await supabase
        .from('workers')
        .update({
          status: 'busy',
        })
        .eq('id', workerId)

      if (workerUpdate.error) {
        console.error('Worker update failed:', workerUpdate.error)
        this.error = `Worker update failed: ${workerUpdate.error.message}`
        Object.assign(job, previousJob)
        Object.assign(worker, previousWorker)
        return
      }
      this.error = ''
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

      const hasOtherAssignedJobs = this.jobs.some(
        (otherJob) =>
          otherJob.id !== jobId &&
          (otherJob.worker_id === workerId || otherJob.assigned_worker_id === workerId)
      )

      if (worker && !hasOtherAssignedJobs) {
        worker.status = 'free'
      }

      const jobUpdate = await supabase
        .from('jobs')
        .update({
          worker_id: null,
          status: 'scheduled',
        })
        .eq('id', jobId)
        .select()
        
        console.log('jobUpdate:', jobUpdate)

      if (jobUpdate.error) {
        console.error('Job unassign failed:', jobUpdate.error)
        this.error = `Job unassign failed: ${jobUpdate.error.message}`
        Object.assign(job, previousJob)
        if (worker && previousWorker) Object.assign(worker, previousWorker)
        return
      }

      if (worker && !hasOtherAssignedJobs) {
        const workerUpdate = await supabase
          .from('workers')
          .update({
            status: 'free',
          })
          .eq('id', worker.id)

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
