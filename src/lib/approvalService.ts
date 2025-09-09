import { supabase, TABLES } from './supabase';
import { ApprovalWorkflow, UserRole } from '@/types';

interface ApprovalRule {
  entityType: 'invoice' | 'expense' | 'payment';
  condition: {
    field: string;
    operator: 'gt' | 'gte' | 'eq' | 'contains';
    value: any;
  };
  approverRole: UserRole;
  required: boolean;
}

interface ApprovalRequest {
  entityType: 'invoice' | 'expense' | 'payment';
  entityId: string;
  outletId: string;
  requestedBy: string;
  amount?: number;
  description?: string;
}

export class ApprovalService {
  // Default approval rules - can be customized per outlet
  private defaultRules: ApprovalRule[] = [
    // Invoice approval rules
    {
      entityType: 'invoice',
      condition: { field: 'total', operator: 'gt', value: 5000 },
      approverRole: 'outlet_admin',
      required: true
    },
    {
      entityType: 'invoice',
      condition: { field: 'total', operator: 'gt', value: 1000 },
      approverRole: 'manager',
      required: true
    },
    // Expense approval rules
    {
      entityType: 'expense',
      condition: { field: 'amount', operator: 'gt', value: 2000 },
      approverRole: 'outlet_admin',
      required: true
    },
    {
      entityType: 'expense',
      condition: { field: 'amount', operator: 'gt', value: 500 },
      approverRole: 'manager',
      required: true
    },
    {
      entityType: 'expense',
      condition: { field: 'category', operator: 'eq', value: 'equipment' },
      approverRole: 'outlet_admin',
      required: true
    },
    // Payment approval rules
    {
      entityType: 'payment',
      condition: { field: 'amount', operator: 'gt', value: 10000 },
      approverRole: 'outlet_admin',
      required: true
    },
    {
      entityType: 'payment',
      condition: { field: 'amount', operator: 'gt', value: 3000 },
      approverRole: 'manager',
      required: true
    }
  ];

  // Create approval workflow
  async createApprovalWorkflow(request: ApprovalRequest): Promise<{
    data: ApprovalWorkflow[] | null;
    error: string | null;
    autoApproved: boolean;
  }> {
    try {
      // Get entity data to evaluate approval rules
      const entityData = await this.getEntityData(request.entityType, request.entityId);
      if (!entityData) {
        return { data: null, error: 'Entity not found', autoApproved: false };
      }

      // Evaluate which approvals are needed
      const requiredApprovals = this.evaluateApprovalRules(request.entityType, entityData);
      
      if (requiredApprovals.length === 0) {
        // Auto-approve if no approvals needed
        await this.autoApproveEntity(request.entityType, request.entityId, request.requestedBy);
        return { data: [], error: null, autoApproved: true };
      }

      // Create approval workflow records
      const workflows: ApprovalWorkflow[] = [];
      
      for (let i = 0; i < requiredApprovals.length; i++) {
        const rule = requiredApprovals[i];
        
        // Find available approver
        const approver = await this.findApprover(request.outletId, rule.approverRole);
        
        const workflowData = {
          outlet_id: request.outletId,
          entity_type: request.entityType,
          entity_id: request.entityId,
          workflow_step: i + 1,
          approver_role: rule.approverRole,
          assigned_to: approver?.id,
          status: 'pending',
          comments: `Approval required: ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value}`
        };

        const { data, error } = await supabase
          .from('approval_workflows')
          .insert(workflowData)
          .select()
          .single();

        if (error) throw error;
        workflows.push(data as ApprovalWorkflow);
      }

      // Send notifications to approvers
      await this.sendApprovalNotifications(workflows, request);

      return { data: workflows, error: null, autoApproved: false };
    } catch (error) {
      console.error('Create approval workflow error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create approval workflow',
        autoApproved: false
      };
    }
  }

  // Process approval decision
  async processApproval(
    workflowId: string,
    decision: 'approved' | 'rejected',
    approvedBy: string,
    comments?: string
  ): Promise<{ data: ApprovalWorkflow | null; error: string | null; nextStep?: ApprovalWorkflow }> {
    try {
      // Update workflow status
      const { data: workflow, error } = await supabase
        .from('approval_workflows')
        .update({
          status: decision,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          comments: comments || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId)
        .select()
        .single();

      if (error) throw error;

      if (decision === 'rejected') {
        // Reject all subsequent steps and mark entity as rejected
        await this.rejectAllSubsequentSteps(workflow.entityId, workflow.workflowStep);
        await this.updateEntityStatus(workflow.entityType, workflow.entityId, 'rejected');
        
        return { data: workflow as ApprovalWorkflow, error: null };
      }

      // If approved, check if there are more steps
      const { data: nextStep } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('entity_type', workflow.entityType)
        .eq('entity_id', workflow.entityId)
        .eq('workflow_step', workflow.workflowStep + 1)
        .eq('status', 'pending')
        .single();

      if (nextStep) {
        // Send notification for next step
        await this.sendApprovalNotifications([nextStep as ApprovalWorkflow], {
          entityType: workflow.entityType,
          entityId: workflow.entityId,
          outletId: workflow.outletId,
          requestedBy: approvedBy
        });
        
        return { 
          data: workflow as ApprovalWorkflow, 
          error: null, 
          nextStep: nextStep as ApprovalWorkflow 
        };
      } else {
        // Final approval - mark entity as approved
        await this.updateEntityStatus(workflow.entityType, workflow.entityId, 'approved');
        
        return { data: workflow as ApprovalWorkflow, error: null };
      }
    } catch (error) {
      console.error('Process approval error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to process approval' 
      };
    }
  }

  // Get pending approvals for user
  async getPendingApprovals(
    outletId: string, 
    userId: string
  ): Promise<{ data: Array<ApprovalWorkflow & { entityData: any }> | null; error: string | null }> {
    try {
      const { data: workflows, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('assigned_to', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!workflows) return { data: [], error: null };

      // Enrich with entity data
      const enrichedWorkflows = await Promise.all(
        workflows.map(async (workflow) => {
          const entityData = await this.getEntityData(workflow.entityType, workflow.entityId);
          return {
            ...workflow,
            entityData
          };
        })
      );

      return { data: enrichedWorkflows as Array<ApprovalWorkflow & { entityData: any }>, error: null };
    } catch (error) {
      console.error('Get pending approvals error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get pending approvals' 
      };
    }
  }

  // Get approval history
  async getApprovalHistory(
    outletId: string, 
    entityType?: string, 
    entityId?: string
  ): Promise<{ data: Array<ApprovalWorkflow & { entityData: any; approverName: string }> | null; error: string | null }> {
    try {
      let query = supabase
        .from('approval_workflows')
        .select(`
          *,
          users!approval_workflows_approved_by_fkey(name)
        `)
        .eq('outlet_id', outletId);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data: workflows, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (!workflows) return { data: [], error: null };

      // Enrich with entity data
      const enrichedWorkflows = await Promise.all(
        workflows.map(async (workflow: any) => {
          const entityData = await this.getEntityData(workflow.entity_type, workflow.entity_id);
          return {
            ...workflow,
            entityData,
            approverName: workflow.users?.name || 'Unknown'
          };
        })
      );

      return { data: enrichedWorkflows, error: null };
    } catch (error) {
      console.error('Get approval history error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get approval history' 
      };
    }
  }

  // Get approval statistics
  async getApprovalStats(outletId: string, days: number = 30): Promise<{
    data: {
      totalApprovals: number;
      pendingApprovals: number;
      approvedCount: number;
      rejectedCount: number;
      averageApprovalTime: number; // in hours
      approvalsByType: Record<string, number>;
      approverPerformance: Array<{
        approverName: string;
        approverId: string;
        totalApprovals: number;
        averageTime: number;
      }>;
    } | null;
    error: string | null;
  }> {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: workflows, error } = await supabase
        .from('approval_workflows')
        .select(`
          *,
          users!approval_workflows_approved_by_fkey(name)
        `)
        .eq('outlet_id', outletId)
        .gte('created_at', dateFrom);

      if (error) throw error;

      if (!workflows) {
        return { 
          data: {
            totalApprovals: 0,
            pendingApprovals: 0,
            approvedCount: 0,
            rejectedCount: 0,
            averageApprovalTime: 0,
            approvalsByType: {},
            approverPerformance: []
          }, 
          error: null 
        };
      }

      const totalApprovals = workflows.length;
      const pendingApprovals = workflows.filter(w => w.status === 'pending').length;
      const approvedCount = workflows.filter(w => w.status === 'approved').length;
      const rejectedCount = workflows.filter(w => w.status === 'rejected').length;

      // Calculate average approval time
      const completedWorkflows = workflows.filter(w => w.approved_at);
      let totalApprovalTime = 0;
      
      completedWorkflows.forEach(workflow => {
        const createdTime = new Date(workflow.created_at).getTime();
        const approvedTime = new Date(workflow.approved_at).getTime();
        totalApprovalTime += (approvedTime - createdTime) / (1000 * 60 * 60); // Convert to hours
      });

      const averageApprovalTime = completedWorkflows.length > 0 ? 
        totalApprovalTime / completedWorkflows.length : 0;

      // Approvals by type
      const approvalsByType = workflows.reduce((acc, workflow) => {
        acc[workflow.entity_type] = (acc[workflow.entity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Approver performance
      const approverStats = workflows.reduce((acc, workflow: any) => {
        if (workflow.approved_by && workflow.approved_at) {
          const approverId = workflow.approved_by;
          const approverName = workflow.users?.name || 'Unknown';
          
          if (!acc[approverId]) {
            acc[approverId] = {
              approverName,
              approverId,
              totalApprovals: 0,
              totalTime: 0
            };
          }
          
          acc[approverId].totalApprovals++;
          
          const createdTime = new Date(workflow.created_at).getTime();
          const approvedTime = new Date(workflow.approved_at).getTime();
          acc[approverId].totalTime += (approvedTime - createdTime) / (1000 * 60 * 60);
        }
        return acc;
      }, {} as Record<string, any>);

      const approverPerformance = Object.values(approverStats).map((stats: any) => ({
        approverName: stats.approverName,
        approverId: stats.approverId,
        totalApprovals: stats.totalApprovals,
        averageTime: stats.totalApprovals > 0 ? stats.totalTime / stats.totalApprovals : 0
      }));

      return {
        data: {
          totalApprovals,
          pendingApprovals,
          approvedCount,
          rejectedCount,
          averageApprovalTime,
          approvalsByType,
          approverPerformance
        },
        error: null
      };
    } catch (error) {
      console.error('Get approval stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get approval statistics' 
      };
    }
  }

  // Private helper methods

  private async getEntityData(entityType: string, entityId: string): Promise<any> {
    try {
      let tableName: string;
      switch (entityType) {
        case 'invoice': tableName = TABLES.INVOICES; break;
        case 'expense': tableName = TABLES.EXPENSES; break;
        case 'payment': tableName = 'payments'; break;
        default: return null;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get entity data error:', error);
      return null;
    }
  }

  private evaluateApprovalRules(entityType: string, entityData: any): ApprovalRule[] {
    return this.defaultRules
      .filter(rule => rule.entityType === entityType)
      .filter(rule => {
        const fieldValue = entityData[rule.condition.field];
        switch (rule.condition.operator) {
          case 'gt': return fieldValue > rule.condition.value;
          case 'gte': return fieldValue >= rule.condition.value;
          case 'eq': return fieldValue === rule.condition.value;
          case 'contains': return fieldValue?.includes(rule.condition.value);
          default: return false;
        }
      })
      .sort((a, b) => {
        // Sort by role hierarchy (outlet_admin > manager > others)
        const roleOrder = { outlet_admin: 3, manager: 2, accountant: 1 };
        return (roleOrder[b.approverRole as keyof typeof roleOrder] || 0) - 
               (roleOrder[a.approverRole as keyof typeof roleOrder] || 0);
      });
  }

  private async findApprover(outletId: string, role: UserRole): Promise<{ id: string; name: string } | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('id, name')
        .eq('outlet_id', outletId)
        .eq('role', role)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Find approver error:', error);
      return null;
    }
  }

  private async autoApproveEntity(entityType: string, entityId: string, approvedBy: string): Promise<void> {
    await this.updateEntityStatus(entityType, entityId, 'approved');
    
    // Log auto-approval
    console.log(`Auto-approved ${entityType} ${entityId} by ${approvedBy}`);
  }

  private async updateEntityStatus(entityType: string, entityId: string, status: string): Promise<void> {
    try {
      let tableName: string;
      let statusField: string;
      
      switch (entityType) {
        case 'invoice': 
          tableName = TABLES.INVOICES; 
          statusField = 'approval_status';
          break;
        case 'expense': 
          tableName = TABLES.EXPENSES; 
          statusField = 'status';
          break;
        case 'payment': 
          tableName = 'payments'; 
          statusField = 'status';
          break;
        default: return;
      }

      await supabase
        .from(tableName)
        .update({ 
          [statusField]: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', entityId);
    } catch (error) {
      console.error('Update entity status error:', error);
    }
  }

  private async rejectAllSubsequentSteps(entityId: string, currentStep: number): Promise<void> {
    try {
      await supabase
        .from('approval_workflows')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('entity_id', entityId)
        .gt('workflow_step', currentStep)
        .eq('status', 'pending');
    } catch (error) {
      console.error('Reject subsequent steps error:', error);
    }
  }

  private async sendApprovalNotifications(
    workflows: ApprovalWorkflow[], 
    request: ApprovalRequest
  ): Promise<void> {
    try {
      // This would integrate with email/WhatsApp service
      // For now, we'll just log the notifications
      workflows.forEach(workflow => {
        console.log('Approval notification would be sent:', {
          approver: workflow.assignedTo,
          entityType: workflow.entityType,
          entityId: workflow.entityId,
          step: workflow.workflowStep
        });
      });
    } catch (error) {
      console.error('Send approval notifications error:', error);
    }
  }
}

export const approvalService = new ApprovalService();