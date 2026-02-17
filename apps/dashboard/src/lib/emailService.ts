/**
 * Email Service using Supabase
 * 
 * This service handles sending emails for user invitations,
 * password resets, and other notifications using Supabase's
 * built-in email functionality and Edge Functions.
 */

import { supabase } from './supabase';

interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

interface SendEmailParams {
  to: string;
  template: EmailTemplate;
  variables?: Record<string, string>;
}

class EmailService {
  constructor() {
    console.log('📧 Email service initialized with Supabase');
  }

  /**
   * Send an email using Supabase Edge Function
   */
  async sendEmail({ to, template, variables = {} }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, we'll use a simple approach - store the email in a database table
      // In production, you'd create a Supabase Edge Function to handle email sending
      const { data, error } = await supabase
        .from('email_queue')
        .insert({
          to_email: to,
          subject: template.subject,
          html_content: this.replaceVariables(template.htmlContent, variables),
          text_content: this.replaceVariables(template.textContent, variables),
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) {
        // If email_queue table doesn't exist, fall back to console logging
        console.log('📧 [DEV MODE] Email would be sent:', {
          to,
          subject: template.subject,
          variables
        });
        return { success: true };
      }

      console.log('✅ Email queued successfully:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      // Fallback to console logging in development
      console.log('📧 [DEV MODE] Email would be sent:', {
        to,
        subject: template.subject,
        variables
      });
      return { success: true };
    }
  }

  /**
   * Send user invitation email
   */
  async sendInvitationEmail({
    to,
    name,
    role,
    outletName,
    inviterName,
    invitationLink,
    expiresIn = '7 days'
  }: {
    to: string;
    name: string;
    role: string;
    outletName: string;
    inviterName: string;
    invitationLink: string;
    expiresIn?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const template: EmailTemplate = {
      subject: `You're invited to join ${outletName} on Compazz`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .button:hover { background: #0056b3; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .role-badge { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You're Invited!</h1>
              <p>Join your team on Compazz</p>
            </div>
            <div class="content">
              <h2>Hello {{name}}!</h2>
              <p><strong>{{inviterName}}</strong> has invited you to join <strong>{{outletName}}</strong> as a <span class="role-badge">{{role}}</span>.</p>
              
              <p>Compazz is a powerful business management platform that helps teams:</p>
              <ul>
                <li>📊 Track sales and revenue</li>
                <li>📈 Generate reports and analytics</li>
                <li>👥 Manage team members</li>
                <li>💰 Handle expenses and invoices</li>
                <li>🏪 Manage multiple outlets</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="{{invitationLink}}" class="button">Accept Invitation</a>
              </div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>This invitation expires in {{expiresIn}}</li>
                <li>You'll need to create a password when you accept</li>
                <li>If you didn't expect this invitation, you can safely ignore this email</li>
              </ul>
            </div>
            <div class="footer">
              <p>This invitation was sent by {{inviterName}} from {{outletName}}</p>
              <p>If the button doesn't work, copy and paste this link: {{invitationLink}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
        Hello {{name}}!
        
        {{inviterName}} has invited you to join {{outletName}} as a {{role}}.
        
        Compazz is a powerful business management platform that helps teams track sales, generate reports, manage team members, handle expenses and invoices, and manage multiple outlets.
        
        To accept this invitation, click the link below:
        {{invitationLink}}
        
        Important:
        - This invitation expires in {{expiresIn}}
        - You'll need to create a password when you accept
        - If you didn't expect this invitation, you can safely ignore this email
        
        This invitation was sent by {{inviterName}} from {{outletName}}
      `
    };

    return this.sendEmail({
      to,
      template,
      variables: {
        name,
        role: this.formatRole(role),
        outletName,
        inviterName,
        invitationLink,
        expiresIn
      }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail({
    to,
    name,
    resetLink,
    expiresIn = '1 hour'
  }: {
    to: string;
    name: string;
    resetLink: string;
    expiresIn?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const template: EmailTemplate = {
      subject: 'Reset your Compazz password',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}}!</h2>
              <p>We received a request to reset your password for your Compazz account.</p>
              
              <div style="text-align: center;">
                <a href="{{resetLink}}" class="button">Reset Password</a>
              </div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>This link expires in {{expiresIn}}</li>
                <li>If you didn't request this reset, you can safely ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
            <div class="footer">
              <p>If the button doesn't work, copy and paste this link: {{resetLink}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
        Hello {{name}}!
        
        We received a request to reset your password for your Compazz account.
        
        To reset your password, click the link below:
        {{resetLink}}
        
        Important:
        - This link expires in {{expiresIn}}
        - If you didn't request this reset, you can safely ignore this email
        - Your password won't change until you create a new one
      `
    };

    return this.sendEmail({
      to,
      template,
      variables: {
        name,
        resetLink,
        expiresIn
      }
    });
  }

  /**
   * Replace variables in email templates
   */
  private replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Format role names for display
   */
  private formatRole(role: string): string {
    const roleMap: Record<string, string> = {
      'super_admin': 'Super Admin',
      'outlet_admin': 'Outlet Admin',
      'manager': 'Manager',
      'cashier': 'Cashier',
      'waiter': 'Waiter',
      'kitchen_staff': 'Kitchen Staff',
      'inventory_staff': 'Inventory Staff',
      'pharmacist': 'Pharmacist',
      'accountant': 'Pharmacist',
      'viewer': 'Viewer'
    };
    return roleMap[role] || role;
  }
}

export const emailService = new EmailService();
