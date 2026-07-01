import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqrbjiyqazarlomycdzc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcmJqaXlxYXphcmxvbXljZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODIzMDAsImV4cCI6MjA5ODM1ODMwMH0.dne7GGb29XICld8a5A9T0OyWsns-ChdII8GFJ2q4k08'

export const supabase = createClient(supabaseUrl, supabaseKey)
