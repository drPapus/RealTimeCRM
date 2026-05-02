import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type { Job, Worker } from '../types'

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
      supabase
        .channel('dispatch-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs' },
          () => this.fetchData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workers' },
          () => this.fetchData()
        )
        .subscribe()
    },
  },
})
