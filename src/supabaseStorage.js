import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const storage = {
  async list(prefix, skipError) {
    try {
      const { data, error } = await supabase
        .from('nsmaps')
        .select('id, data')
      
      if (error) throw error
      return data
    } catch (e) {
      if (!skipError) console.error(e)
      return []
    }
  },
  
  async set(key, value, skipError) {
    try {
      const id = key.replace('nsmap:', '')
      const parsed = JSON.parse(value)
      
      const { error } = await supabase
        .from('nsmaps')
        .upsert({ id, data: parsed, updated_at: new Date() })
      
      if (error) throw error
      return true
    } catch (e) {
      if (!skipError) console.error(e)
      return false
    }
  },
  
  async delete(key, skipError) {
    try {
      const id = key.replace('nsmap:', '')
      const { error } = await supabase
        .from('nsmaps')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return true
    } catch (e) {
      if (!skipError) console.error(e)
      return false
    }
  }
}

export default supabase
