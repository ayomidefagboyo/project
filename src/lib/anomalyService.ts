import { supabase, TABLES } from './supabase';
import { Anomaly, AnomalyType, EnhancedInvoice, Payment, EnhancedVendor, PriceBenchmark } from '@/types';

interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  riskScore: number; // 0-100
  recommendations: string[];
}

interface DuplicatePaymentCheck {
  isDuplicate: boolean;
  originalPaymentId?: string;
  confidence: number;
  reason: string;
}

interface PriceSpikeAnalysis {
  isSpike: boolean;
  averagePrice: number;
  currentPrice: number;
  variancePercentage: number;
  confidence: number;
  historicalData: PriceBenchmark[];
}

export class AnomalyService {
  // Main anomaly detection function
  async detectAnomalies(outletId: string, entityType: string, entityId: string): Promise<AnomalyDetectionResult> {
    try {
      const anomalies: Anomaly[] = [];
      let riskScore = 0;
      const recommendations: string[] = [];

      switch (entityType) {
        case 'payment':
          const paymentAnomalies = await this.analyzePaymentAnomalies(outletId, entityId);
          anomalies.push(...paymentAnomalies.anomalies);
          riskScore += paymentAnomalies.riskScore;
          recommendations.push(...paymentAnomalies.recommendations);
          break;

        case 'invoice':
          const invoiceAnomalies = await this.analyzeInvoiceAnomalies(outletId, entityId);
          anomalies.push(...invoiceAnomalies.anomalies);
          riskScore += invoiceAnomalies.riskScore;
          recommendations.push(...invoiceAnomalies.recommendations);
          break;

        case 'eod_report':
          const eodAnomalies = await this.analyzeEODAnomalies(outletId, entityId);
          anomalies.push(...eodAnomalies.anomalies);
          riskScore += eodAnomalies.riskScore;
          recommendations.push(...eodAnomalies.recommendations);
          break;
      }

      // Normalize risk score
      riskScore = Math.min(100, riskScore);

      return {
        anomalies,
        riskScore,
        recommendations
      };
    } catch (error) {
      console.error('Anomaly detection error:', error);
      return {
        anomalies: [],
        riskScore: 0,
        recommendations: ['Anomaly detection service temporarily unavailable']
      };
    }
  }

  // Analyze payment-related anomalies
  private async analyzePaymentAnomalies(outletId: string, paymentId: string): Promise<AnomalyDetectionResult> {
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    try {
      // Get payment details
      const { data: payment } = await supabase
        .from('payments')
        .select(`
          *,
          invoices!inner(*, vendors!inner(*))
        `)
        .eq('id', paymentId)
        .single();

      if (!payment) return { anomalies, riskScore, recommendations };

      // 1. Check for duplicate payments
      const duplicateCheck = await this.checkDuplicatePayments(payment);
      if (duplicateCheck.isDuplicate) {
        anomalies.push(await this.createAnomalyRecord({
          outletId,
          type: 'duplicate_payment',
          relatedEntity: 'payment',
          relatedId: paymentId,
          description: `Potential duplicate payment detected. ${duplicateCheck.reason}`,
          severity: duplicateCheck.confidence > 80 ? 'high' : 'medium',
          aiConfidence: duplicateCheck.confidence
        }));
        riskScore += duplicateCheck.confidence > 80 ? 30 : 20;
        recommendations.push('Review payment for potential duplicate and verify with original transaction');
      }

      // 2. Check for unauthorized account payments
      const unauthorizedAccountCheck = await this.checkUnauthorizedAccount(payment);
      if (unauthorizedAccountCheck.isUnauthorized) {
        anomalies.push(await this.createAnomalyRecord({
          outletId,
          type: 'unauthorized_account',
          relatedEntity: 'payment',
          relatedId: paymentId,
          description: `Payment made to unregistered or suspicious account: ${unauthorizedAccountCheck.accountDetails}`,
          severity: 'high',
          aiConfidence: unauthorizedAccountCheck.confidence
        }));
        riskScore += 40;
        recommendations.push('Verify recipient account details and authorization for this payment');
      }

      // 3. Check for unusual payment amounts
      const amountAnomalyCheck = await this.checkUnusualPaymentAmount(outletId, payment);
      if (amountAnomalyCheck.isUnusual) {
        anomalies.push(await this.createAnomalyRecord({
          outletId,
          type: 'price_spike',
          relatedEntity: 'payment',
          relatedId: paymentId,
          description: `Unusual payment amount: ${amountAnomalyCheck.reason}`,
          severity: amountAnomalyCheck.severity,
          aiConfidence: amountAnomalyCheck.confidence
        }));
        riskScore += amountAnomalyCheck.severity === 'high' ? 25 : 15;
        recommendations.push('Review payment amount against historical patterns and verify invoice accuracy');
      }

    } catch (error) {
      console.error('Payment anomaly analysis error:', error);
    }

    return { anomalies, riskScore, recommendations };
  }

  // Analyze invoice-related anomalies
  private async analyzeInvoiceAnomalies(outletId: string, invoiceId: string): Promise<AnomalyDetectionResult> {
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    try {
      // Get invoice details
      const { data: invoice } = await supabase
        .from(TABLES.INVOICES)
        .select(`
          *,
          vendors(*)
        `)
        .eq('id', invoiceId)
        .single();

      if (!invoice) return { anomalies, riskScore, recommendations };

      // 1. Check for price spikes
      if (invoice.vendor_id) {
        const priceSpike = await this.analyzePriceSpike(outletId, invoice.vendor_id, invoice.total);
        if (priceSpike.isSpike) {
          anomalies.push(await this.createAnomalyRecord({
            outletId,
            type: 'price_spike',
            relatedEntity: 'invoice',
            relatedId: invoiceId,
            description: `Price spike detected: ${priceSpike.variancePercentage.toFixed(1)}% above average (${priceSpike.averagePrice} vs ${priceSpike.currentPrice})`,
            severity: priceSpike.variancePercentage > 100 ? 'high' : priceSpike.variancePercentage > 50 ? 'medium' : 'low',
            aiConfidence: priceSpike.confidence
          }));
          riskScore += priceSpike.variancePercentage > 100 ? 30 : priceSpike.variancePercentage > 50 ? 20 : 10;
          recommendations.push('Investigate price increase with vendor and verify invoice accuracy');
        }
      }

      // 2. Check for missing information
      const missingInfoCheck = this.checkMissingInvoiceInfo(invoice);
      if (missingInfoCheck.hasMissingInfo) {
        anomalies.push(await this.createAnomalyRecord({
          outletId,
          type: 'missing_info',
          relatedEntity: 'invoice',
          relatedId: invoiceId,
          description: `Missing critical information: ${missingInfoCheck.missingFields.join(', ')}`,
          severity: missingInfoCheck.missingFields.length > 2 ? 'medium' : 'low',
          aiConfidence: 90
        }));
        riskScore += missingInfoCheck.missingFields.length * 5;
        recommendations.push('Complete missing invoice information for proper record keeping');
      }

      // 3. Check for duplicate invoices
      const duplicateInvoiceCheck = await this.checkDuplicateInvoices(outletId, invoice);
      if (duplicateInvoiceCheck.isDuplicate) {
        anomalies.push(await this.createAnomalyRecord({
          outletId,
          type: 'duplicate_payment',
          relatedEntity: 'invoice',
          relatedId: invoiceId,
          description: `Potential duplicate invoice detected: Similar amount and vendor within recent timeframe`,
          severity: 'high',
          aiConfidence: duplicateInvoiceCheck.confidence
        }));
        riskScore += 35;
        recommendations.push('Verify invoice uniqueness and check for potential duplicate submissions');
      }

    } catch (error) {
      console.error('Invoice anomaly analysis error:', error);
    }

    return { anomalies, riskScore, recommendations };
  }

  // Analyze EOD report anomalies
  private async analyzeEODAnomalies(outletId: string, reportId: string): Promise<AnomalyDetectionResult> {
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    try {
      // Get EOD report details
      const { data: report } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('*')
        .eq('id', reportId)
        .single();

      if (!report) return { anomalies, riskScore, recommendations };

      // 1. Check for sales anomalies
      const salesAnomalies = await this.checkEODSalesAnomalies(outletId, report);
      anomalies.push(...salesAnomalies.anomalies);
      riskScore += salesAnomalies.riskScore;
      recommendations.push(...salesAnomalies.recommendations);

      // 2. Check for cash flow anomalies
      const cashAnomalies = this.checkEODCashAnomalies(report);
      anomalies.push(...cashAnomalies.anomalies);
      riskScore += cashAnomalies.riskScore;
      recommendations.push(...cashAnomalies.recommendations);

    } catch (error) {
      console.error('EOD anomaly analysis error:', error);
    }

    return { anomalies, riskScore, recommendations };
  }

  // Check for duplicate payments
  private async checkDuplicatePayments(payment: any): Promise<DuplicatePaymentCheck> {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: similarPayments } = await supabase
        .from('payments')
        .select('id, amount, created_at')
        .eq('vendor_id', payment.vendor_id)
        .gte('created_at', threeDaysAgo)
        .neq('id', payment.id);

      if (!similarPayments) return { isDuplicate: false, confidence: 0, reason: 'No similar payments found' };

      // Check for exact amount matches
      const exactMatches = similarPayments.filter(p => 
        Math.abs(p.amount - payment.amount) < 0.01 && 
        Math.abs(new Date(p.created_at).getTime() - new Date(payment.created_at).getTime()) < 24 * 60 * 60 * 1000
      );

      if (exactMatches.length > 0) {
        return {
          isDuplicate: true,
          originalPaymentId: exactMatches[0].id,
          confidence: 95,
          reason: `Exact amount match ($${payment.amount}) found within 24 hours`
        };
      }

      // Check for very similar amounts (within 5%)
      const similarAmounts = similarPayments.filter(p => {
        const variance = Math.abs(p.amount - payment.amount) / payment.amount;
        return variance < 0.05;
      });

      if (similarAmounts.length > 0) {
        return {
          isDuplicate: true,
          originalPaymentId: similarAmounts[0].id,
          confidence: 75,
          reason: `Similar amount found within 5% variance in past 3 days`
        };
      }

      return { isDuplicate: false, confidence: 0, reason: 'No duplicate patterns detected' };
    } catch (error) {
      console.error('Duplicate payment check error:', error);
      return { isDuplicate: false, confidence: 0, reason: 'Error checking for duplicates' };
    }
  }

  // Check for unauthorized account payments
  private async checkUnauthorizedAccount(payment: any): Promise<{
    isUnauthorized: boolean;
    confidence: number;
    accountDetails: string;
  }> {
    try {
      // Get vendor details
      const vendor = payment.invoices?.vendors;
      if (!vendor) return { isUnauthorized: false, confidence: 0, accountDetails: 'N/A' };

      // Check if payment account matches vendor's registered account
      const paymentAccount = payment.bank_reference || payment.payment_method;
      const vendorAccount = vendor.account_number;

      if (!vendorAccount && paymentAccount) {
        return {
          isUnauthorized: true,
          confidence: 60,
          accountDetails: paymentAccount
        };
      }

      if (vendorAccount && paymentAccount && !paymentAccount.includes(vendorAccount.slice(-4))) {
        return {
          isUnauthorized: true,
          confidence: 80,
          accountDetails: paymentAccount
        };
      }

      return { isUnauthorized: false, confidence: 0, accountDetails: 'Account verified' };
    } catch (error) {
      console.error('Unauthorized account check error:', error);
      return { isUnauthorized: false, confidence: 0, accountDetails: 'Error checking account' };
    }
  }

  // Check for unusual payment amounts
  private async checkUnusualPaymentAmount(outletId: string, payment: any): Promise<{
    isUnusual: boolean;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }> {
    try {
      // Get historical payments for this vendor
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: historicalPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('vendor_id', payment.vendor_id)
        .eq('outlet_id', outletId)
        .gte('created_at', thirtyDaysAgo)
        .neq('id', payment.id);

      if (!historicalPayments || historicalPayments.length < 3) {
        return { isUnusual: false, confidence: 0, severity: 'low', reason: 'Insufficient historical data' };
      }

      const amounts = historicalPayments.map(p => p.amount);
      const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const variance = (payment.amount - average) / average;

      if (Math.abs(variance) > 2.0) { // 200% variance
        return {
          isUnusual: true,
          confidence: 90,
          severity: 'high',
          reason: `${(Math.abs(variance) * 100).toFixed(0)}% variance from average ($${average.toFixed(2)})`
        };
      }

      if (Math.abs(variance) > 1.0) { // 100% variance
        return {
          isUnusual: true,
          confidence: 75,
          severity: 'medium',
          reason: `${(Math.abs(variance) * 100).toFixed(0)}% variance from average ($${average.toFixed(2)})`
        };
      }

      return { isUnusual: false, confidence: 0, severity: 'low', reason: 'Amount within normal range' };
    } catch (error) {
      console.error('Unusual payment amount check error:', error);
      return { isUnusual: false, confidence: 0, severity: 'low', reason: 'Error checking payment amount' };
    }
  }

  // Analyze price spikes
  private async analyzePriceSpike(outletId: string, vendorId: string, currentAmount: number): Promise<PriceSpikeAnalysis> {
    try {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: historicalInvoices } = await supabase
        .from(TABLES.INVOICES)
        .select('total, created_at')
        .eq('outlet_id', outletId)
        .eq('vendor_id', vendorId)
        .gte('created_at', sixMonthsAgo)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!historicalInvoices || historicalInvoices.length < 3) {
        return {
          isSpike: false,
          averagePrice: currentAmount,
          currentPrice: currentAmount,
          variancePercentage: 0,
          confidence: 0,
          historicalData: []
        };
      }

      const amounts = historicalInvoices.map(inv => inv.total);
      const averagePrice = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const variancePercentage = ((currentAmount - averagePrice) / averagePrice) * 100;

      const isSpike = variancePercentage > 30; // 30% increase threshold
      const confidence = Math.min(95, Math.abs(variancePercentage) * 2);

      return {
        isSpike,
        averagePrice,
        currentPrice: currentAmount,
        variancePercentage,
        confidence,
        historicalData: []
      };
    } catch (error) {
      console.error('Price spike analysis error:', error);
      return {
        isSpike: false,
        averagePrice: currentAmount,
        currentPrice: currentAmount,
        variancePercentage: 0,
        confidence: 0,
        historicalData: []
      };
    }
  }

  // Check for missing invoice information
  private checkMissingInvoiceInfo(invoice: any): {
    hasMissingInfo: boolean;
    missingFields: string[];
  } {
    const requiredFields = [
      { field: 'vendor_id', name: 'Vendor' },
      { field: 'invoice_number', name: 'Invoice Number' },
      { field: 'due_date', name: 'Due Date' },
      { field: 'total', name: 'Total Amount' }
    ];

    const missingFields = requiredFields
      .filter(rf => !invoice[rf.field] || invoice[rf.field] === '')
      .map(rf => rf.name);

    return {
      hasMissingInfo: missingFields.length > 0,
      missingFields
    };
  }

  // Check for duplicate invoices
  private async checkDuplicateInvoices(outletId: string, invoice: any): Promise<{
    isDuplicate: boolean;
    confidence: number;
  }> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentInvoices } = await supabase
        .from(TABLES.INVOICES)
        .select('id, total, invoice_number')
        .eq('outlet_id', outletId)
        .eq('vendor_id', invoice.vendor_id)
        .gte('created_at', sevenDaysAgo)
        .neq('id', invoice.id);

      if (!recentInvoices) return { isDuplicate: false, confidence: 0 };

      // Check for exact invoice number match
      const exactInvoiceMatch = recentInvoices.find(inv => 
        inv.invoice_number && invoice.invoice_number && 
        inv.invoice_number.toLowerCase() === invoice.invoice_number.toLowerCase()
      );

      if (exactInvoiceMatch) {
        return { isDuplicate: true, confidence: 95 };
      }

      // Check for same amount within 24 hours
      const exactAmountMatch = recentInvoices.find(inv => 
        Math.abs(inv.total - invoice.total) < 0.01
      );

      if (exactAmountMatch) {
        return { isDuplicate: true, confidence: 80 };
      }

      return { isDuplicate: false, confidence: 0 };
    } catch (error) {
      console.error('Duplicate invoice check error:', error);
      return { isDuplicate: false, confidence: 0 };
    }
  }

  // Check EOD sales anomalies
  private async checkEODSalesAnomalies(outletId: string, report: any): Promise<{
    anomalies: Anomaly[];
    riskScore: number;
    recommendations: string[];
  }> {
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    try {
      // Get historical reports for comparison
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: historicalReports } = await supabase
        .from(TABLES.DAILY_REPORTS)
        .select('total_sales, date')
        .eq('outlet_id', outletId)
        .gte('date', thirtyDaysAgo)
        .neq('id', report.id);

      if (historicalReports && historicalReports.length > 7) {
        const avgSales = historicalReports.reduce((sum, r) => sum + (r.total_sales || 0), 0) / historicalReports.length;
        const variance = ((report.total_sales - avgSales) / avgSales) * 100;

        if (Math.abs(variance) > 50) {
          anomalies.push(await this.createAnomalyRecord({
            outletId,
            type: 'eod_mismatch',
            relatedEntity: 'eod_report',
            relatedId: report.id,
            description: `Unusual sales variance: ${variance.toFixed(1)}% ${variance > 0 ? 'above' : 'below'} average`,
            severity: Math.abs(variance) > 100 ? 'high' : 'medium',
            aiConfidence: 85
          }));
          riskScore += Math.abs(variance) > 100 ? 25 : 15;
          recommendations.push('Review sales figures and verify accuracy of daily transactions');
        }
      }
    } catch (error) {
      console.error('EOD sales anomaly check error:', error);
    }

    return { anomalies, riskScore, recommendations };
  }

  // Check EOD cash anomalies
  private checkEODCashAnomalies(report: any): {
    anomalies: Anomaly[];
    riskScore: number;
    recommendations: string[];
  } {
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    // Check if cash reconciliation has significant variance
    if (report.discrepancies && report.discrepancies.cash_variance) {
      const cashVariance = Math.abs(report.discrepancies.cash_variance);
      
      if (cashVariance > 100) {
        // This would be created async in a real implementation
        const severity = cashVariance > 500 ? 'high' : cashVariance > 200 ? 'medium' : 'low';
        riskScore += severity === 'high' ? 30 : severity === 'medium' ? 20 : 10;
        recommendations.push('Investigate cash handling procedures and recount physical cash');
      }
    }

    return { anomalies, riskScore, recommendations };
  }

  // Create anomaly record
  private async createAnomalyRecord(anomalyData: {
    outletId: string;
    type: AnomalyType;
    relatedEntity: string;
    relatedId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    aiConfidence: number;
  }): Promise<Anomaly> {
    try {
      const { data, error } = await supabase
        .from('anomalies')
        .insert({
          outlet_id: anomalyData.outletId,
          type: anomalyData.type,
          related_entity: anomalyData.relatedEntity,
          related_id: anomalyData.relatedId,
          description: anomalyData.description,
          severity: anomalyData.severity,
          ai_confidence: anomalyData.aiConfidence,
          resolved: false
        })
        .select()
        .single();

      if (error) throw error;
      return data as Anomaly;
    } catch (error) {
      console.error('Create anomaly record error:', error);
      // Return a mock anomaly if database insert fails
      return {
        id: 'temp-' + Date.now(),
        outletId: anomalyData.outletId,
        type: anomalyData.type,
        relatedEntity: anomalyData.relatedEntity,
        relatedId: anomalyData.relatedId,
        description: anomalyData.description,
        severity: anomalyData.severity,
        detectedAt: new Date().toISOString(),
        resolved: false,
        aiConfidence: anomalyData.aiConfidence,
        createdAt: new Date().toISOString()
      };
    }
  }

  // Get anomalies for outlet
  async getAnomalies(
    outletId: string,
    filters?: {
      type?: AnomalyType;
      severity?: string;
      resolved?: boolean;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ data: Anomaly[] | null; error: string | null }> {
    try {
      let query = supabase
        .from('anomalies')
        .select('*')
        .eq('outlet_id', outletId);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.resolved !== undefined) {
        query = query.eq('resolved', filters.resolved);
      }
      if (filters?.dateFrom) {
        query = query.gte('detected_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('detected_at', filters.dateTo);
      }

      const { data, error } = await query.order('detected_at', { ascending: false });

      if (error) throw error;
      return { data: data as Anomaly[], error: null };
    } catch (error) {
      console.error('Get anomalies error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get anomalies' 
      };
    }
  }

  // Resolve anomaly
  async resolveAnomaly(
    anomalyId: string, 
    resolvedBy: string, 
    resolutionNotes: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('anomalies')
        .update({
          resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', anomalyId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Resolve anomaly error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to resolve anomaly' 
      };
    }
  }

  // Get anomaly statistics
  async getAnomalyStats(outletId: string, days: number = 30): Promise<{
    data: {
      totalAnomalies: number;
      unresolvedAnomalies: number;
      riskScore: number;
      anomaliesByType: Record<AnomalyType, number>;
      anomaliesBySeverity: Record<string, number>;
      resolutionRate: number;
    } | null;
    error: string | null;
  }> {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: anomalies, error } = await this.getAnomalies(outletId, { dateFrom });
      
      if (error || !anomalies) {
        throw new Error(error || 'No anomalies found');
      }

      const totalAnomalies = anomalies.length;
      const unresolvedAnomalies = anomalies.filter(a => !a.resolved).length;
      const resolvedAnomalies = totalAnomalies - unresolvedAnomalies;
      const resolutionRate = totalAnomalies > 0 ? (resolvedAnomalies / totalAnomalies) * 100 : 0;

      // Calculate risk score based on unresolved high-severity anomalies
      const riskScore = anomalies
        .filter(a => !a.resolved)
        .reduce((score, anomaly) => {
          switch (anomaly.severity) {
            case 'critical': return score + 25;
            case 'high': return score + 15;
            case 'medium': return score + 8;
            case 'low': return score + 3;
            default: return score;
          }
        }, 0);

      const anomaliesByType = anomalies.reduce((acc, anomaly) => {
        acc[anomaly.type] = (acc[anomaly.type] || 0) + 1;
        return acc;
      }, {} as Record<AnomalyType, number>);

      const anomaliesBySeverity = anomalies.reduce((acc, anomaly) => {
        acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        data: {
          totalAnomalies,
          unresolvedAnomalies,
          riskScore: Math.min(100, riskScore),
          anomaliesByType,
          anomaliesBySeverity,
          resolutionRate
        },
        error: null
      };
    } catch (error) {
      console.error('Get anomaly stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get anomaly statistics' 
      };
    }
  }
}

export const anomalyService = new AnomalyService();