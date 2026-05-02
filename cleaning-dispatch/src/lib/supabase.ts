import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error(
    'Missing or invalid environment variable VITE_SUPABASE_URL. Set it in .env with your Supabase project URL.'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing environment variable VITE_SUPABASE_ANON_KEY. Set it in .env with your Supabase anon key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)