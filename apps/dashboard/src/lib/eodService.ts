import { supabase, TABLES } from './supabase';
import { EnhancedDailyReport } from '@/types';

interface EODData {
  outlet_id: string;
  date: string;
  sales_cash: number;
  sales_transfer: number;
  sales_pos: number;
  expenses: number;
  notes?: string;
  images?: File[];
}

interface EODImage {
  id: string;
  report_id: string;
  outlet_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  image_type: string;
  description?: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export class EODService {
  // Create new EOD report
  async createReport(eodData: EODData): Promise<{ data: EnhancedDailyReport | null; error: string | null }> {
    try {
      // Calculate total sales
      const totalSales = eodData.sales_cash + eodData.sales_transfer + eodData.sales_pos;
      
      // Create the report first
      const reportData = {
        outlet_id: eodData.outlet_id,
        date: eodData.date,
        sales_cash: eodData.sales_cash,
        sales_transfer: eodData.sales_transfer,
        sales_pos: eodData.sales_pos,
        expenses: eodData.expenses,
        total_sales: totalSales,
        notes: eodData.notes || '',
        status: 'submitted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: report, error: reportError } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .insert(reportData)
        .select()
        .single();

      if (reportError) {
        console.error('EOD report creation error:', reportError);
        return { data: null, error: reportError.message };
      }

      // Upload images if any
      if (eodData.images && eodData.images.length > 0) {
        const imageUrls = await this.uploadImages(eodData.images, report.id, eodData.outlet_id);
        
        // Update the report with image URLs for backward compatibility
        if (imageUrls.length > 0) {
          await supabase
            .from(TABLES.DAILY_REPORTS)
            .update({ images: imageUrls })
            .eq('id', report.id);
        }
      }

      return { data: report as EnhancedDailyReport, error: null };
    } catch (error) {
      console.error('EOD report creation error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create EOD report' 
      };
    }
  }

  // Upload images to Supabase Storage and create image records
  private async uploadImages(images: File[], reportId: string, outletId: string): Promise<string[]> {
    const imageUrls: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const fileExt = image.name.split('.').pop();
      const fileName = `${Date.now()}-${i}.${fileExt}`;
      const filePath = `eod-reports/${fileName}`;

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('eod-images')
          .upload(filePath, image);

        if (uploadError) {
          console.error('Image upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data } = supabase.storage
          .from('eod-images')
          .getPublicUrl(filePath);

        // Create image record in database
        const imageRecord = {
          report_id: reportId,
          outlet_id: outletId,
          file_name: image.name,
          file_path: filePath,
          file_url: data.publicUrl,
          file_size: image.size,
          mime_type: image.type,
          image_type: 'receipt', // Default type, can be customized
          description: `EOD report image ${i + 1}`,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || ''
        };

        const { error: dbError } = await supabase
          .from('eod_images')
          .insert(imageRecord);

        if (dbError) {
          console.error('Image record creation error:', dbError);
          continue;
        }

        imageUrls.push(data.publicUrl);
      } catch (error) {
        console.error('Image processing error:', error);
        continue;
      }
    }

    return imageUrls;
  }

  // Get images for a specific report
  async getReportImages(reportId: string): Promise<{ data: EODImage[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('eod_images')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('EOD images fetch error:', error);
        return { data: null, error: error.message };
      }

      return { data: data as EODImage[], error: null };
    } catch (error) {
      console.error('EOD images fetch error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch EOD images' 
      };
    }
  }

  // Delete an image
  async deleteImage(imageId: string): Promise<{ error: string | null }> {
    try {
      // Get image record first
      const { data: image, error: fetchError } = await supabase
        .from('eod_images')
        .select('file_path')
        .eq('id', imageId)
        .single();

      if (fetchError) {
        return { error: fetchError.message };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('eod-images')
        .remove([image.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('eod_images')
        .delete()
        .eq('id', imageId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        return { error: dbError.message };
      }

      return { error: null };
    } catch (error) {
      console.error('Image deletion error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to delete image' 
      };
    }
  }

  // Get reports for an outlet
  async getReports(outletId: string): Promise<{ data: EnhancedDailyReport[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('outlet_id', outletId)
        .order('date', { ascending: false });

      if (error) {
        console.error('EOD reports fetch error:', error);
        return { data: null, error: error.message };
      }

      return { data: data as EnhancedDailyReport[], error: null };
    } catch (error) {
      console.error('EOD reports fetch error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch EOD reports' 
      };
    }
  }

  // Get single report with images
  async getReport(reportId: string): Promise<{ data: EnhancedDailyReport | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        console.error('EOD report fetch error:', error);
        return { data: null, error: error.message };
      }

      return { data: data as EnhancedDailyReport, error: null };
    } catch (error) {
      console.error('EOD report fetch error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch EOD report' 
      };
    }
  }

  // Update report
  async updateReport(reportId: string, updates: Partial<EODData>): Promise<{ data: EnhancedDailyReport | null; error: string | null }> {
    try {
      const updateData: any = {
          ...updates,
          updated_at: new Date().toISOString()
      };

      // Recalculate total sales if sales data is updated
      if (updates.sales_cash !== undefined || updates.sales_transfer !== undefined || 
          updates.sales_pos !== undefined) {
        const { data: existingReport } = await this.getReport(reportId);
        if (existingReport) {
          const totalSales = (updates.sales_cash ?? existingReport.sales_cash) + 
                           (updates.sales_transfer ?? existingReport.sales_transfer) + 
                           (updates.sales_pos ?? existingReport.sales_pos);
          updateData.total_sales = totalSales;
        }
      }

      const { data, error } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .update(updateData)
        .eq('id', reportId)
        .select()
        .single();

      if (error) {
        console.error('EOD report update error:', error);
        return { data: null, error: error.message };
      }

      return { data: data as EnhancedDailyReport, error: null };
    } catch (error) {
      console.error('EOD report update error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update EOD report' 
      };
    }
  }

  // Delete report
  async deleteReport(reportId: string): Promise<{ error: string | null }> {
    try {
      // Delete associated images first
      const { data: images } = await this.getReportImages(reportId);
      if (images) {
        for (const image of images) {
          await this.deleteImage(image.id);
        }
      }

      // Delete the report
      const { error } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('EOD report deletion error:', error);
        return { error: error.message };
      }

      return { error: null };
    } catch (error) {
      console.error('EOD report deletion error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to delete EOD report' 
      };
    }
  }

  // Get analytics for outlet
  async getAnalytics(outletId: string, startDate?: string, endDate?: string): Promise<{ data: any | null; error: string | null }> {
    try {
      let query = supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('outlet_id', outletId);

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('EOD analytics fetch error:', error);
        return { data: null, error: error.message };
      }

      // Calculate analytics
      const analytics = this.calculateAnalytics(data || []);
      return { data: analytics, error: null };
    } catch (error) {
      console.error('EOD analytics fetch error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch EOD analytics' 
      };
    }
  }

  // Calculate analytics from report data
  private calculateAnalytics(reports: EnhancedDailyReport[]) {
    if (reports.length === 0) {
      return {
        totalReports: 0,
        totalSales: 0,
        averageDailySales: 0,
        paymentMethodBreakdown: {
          cash: 0,
          transfer: 0,
          pos: 0,
          credit: 0
        }
      };
    }

    const totalSales = reports.reduce((sum, report) => sum + (report.total_sales || 0), 0);
    const averageDailySales = totalSales / reports.length;

    const paymentMethodBreakdown = reports.reduce((acc, report) => {
      acc.cash += report.sales_cash || 0;
      acc.transfer += report.sales_transfer || 0;
      acc.pos += report.sales_pos || 0;
      acc.expenses += report.expenses || 0;
      return acc;
    }, { cash: 0, transfer: 0, pos: 0, expenses: 0 });

    return {
      totalReports: reports.length,
      totalSales,
      averageDailySales,
      paymentMethodBreakdown
    };
  }

  // Get EOD summary for an outlet (used by DailyReports and Analytics)
  async getEODSummary(outletId?: string): Promise<any> {
    try {
      if (!outletId) {
        // Return mock data if no outlet ID provided (for backward compatibility)
        return {
          today_sales: 0,
          today_profit: 0,
          week_sales: 0,
          week_profit: 0,
          month_sales: 0,
          month_profit: 0,
          pending_reports: 0,
          last_report_date: null,
          cash_variance_today: null
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get today's reports
      const { data: todayReports } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('outlet_id', outletId)
        .eq('date', today);

      // Get this week's reports
      const { data: weekReports } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('outlet_id', outletId)
        .gte('date', weekAgo);

      // Get this month's reports
      const { data: monthReports } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('outlet_id', outletId)
        .gte('date', monthAgo);

      // Calculate totals
      const todaySales = todayReports?.reduce((sum, r) => sum + (r.total_sales || 0), 0) || 0;
      const todayExpenses = todayReports?.reduce((sum, r) => sum + (r.expenses || 0), 0) || 0;
      const todayProfit = todaySales - todayExpenses;

      const weekSales = weekReports?.reduce((sum, r) => sum + (r.total_sales || 0), 0) || 0;
      const weekExpenses = weekReports?.reduce((sum, r) => sum + (r.expenses || 0), 0) || 0;
      const weekProfit = weekSales - weekExpenses;

      const monthSales = monthReports?.reduce((sum, r) => sum + (r.total_sales || 0), 0) || 0;
      const monthExpenses = monthReports?.reduce((sum, r) => sum + (r.expenses || 0), 0) || 0;
      const monthProfit = monthSales - monthExpenses;

      // Get last report date
      const { data: lastReport } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('date')
        .eq('outlet_id', outletId)
        .order('date', { ascending: false })
        .limit(1);

      // Calculate cash variance (difference between expected and actual cash)
      const todayCashSales = todayReports?.reduce((sum, r) => sum + (r.sales_cash || 0), 0) || 0;
      const expectedCash = todayCashSales; // This would typically come from till counting
      const cashVariance = 0; // Placeholder - would need actual till count data

      return {
        today_sales: todaySales,
        today_profit: todayProfit,
        week_sales: weekSales,
        week_profit: weekProfit,
        month_sales: monthSales,
        month_profit: monthProfit,
        pending_reports: todayReports?.length ? 0 : 1, // 1 if no report today, 0 if has report
        last_report_date: lastReport?.[0]?.date || null,
        cash_variance_today: cashVariance
      };
    } catch (error) {
      console.error('EOD summary fetch error:', error);
      // Return default values on error
      return { 
        today_sales: 0,
        today_profit: 0,
        week_sales: 0,
        week_profit: 0,
        month_sales: 0,
        month_profit: 0,
        pending_reports: 1,
        last_report_date: null,
        cash_variance_today: null
      };
    }
  }
}

export const eodService = new EODService();