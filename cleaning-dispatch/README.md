# Cleaning Dispatch

## Supabase Setup

If dragging a job shows this error:

```text
Job update failed: no matching job row was updated. Check the jobs table RLS update policy.
```

the frontend can read `public.jobs`, but the Supabase anon role cannot update that row.

Run [supabase-dispatch-policies.sql](./supabase-dispatch-policies.sql) in the Supabase SQL editor for the project used by `VITE_SUPABASE_URL`. The file grants read/update privileges and creates development RLS policies for `public.jobs` and `public.workers`.

These policies are intentionally open for a demo. Replace them with authenticated, user-scoped policies before production.
