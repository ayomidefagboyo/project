import type { SupabaseClient } from '@supabase/supabase-js';

type ServiceResult<T> = { data: T | null; error: string | null };
type ServiceListResult<T> = { data: T[] | null; error: string | null };

export class DataServiceBase {
  protected readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  protected async create<T>(table: string, data: Partial<T>): Promise<ServiceResult<T>> {
    try {
      const { data: result, error } = await this.supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return { data: result as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : `Failed to create ${table}`,
      };
    }
  }

  protected async read<T>(table: string, id: string): Promise<ServiceResult<T>> {
    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data: data as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : `Failed to read ${table}`,
      };
    }
  }

  protected async update<T>(table: string, id: string, data: Partial<T>): Promise<ServiceResult<T>> {
    try {
      const { data: result, error } = await this.supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: result as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : `Failed to update ${table}`,
      };
    }
  }

  protected async delete(table: string, id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : `Failed to delete ${table}`,
      };
    }
  }

  protected async list<T>(table: string, filters?: Record<string, unknown>): Promise<ServiceListResult<T>> {
    try {
      let query = this.supabase.from(table).select('*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: data as T[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : `Failed to list ${table}`,
      };
    }
  }
}
