# Supabase Email Setup Guide

This guide explains how to set up email functionality using Supabase's built-in features and Edge Functions.

## 🚀 Quick Setup

### Option 1: Simple Database Queue (Current Implementation)
The current implementation stores emails in a database table and logs them to the console. This is perfect for development and testing.

### Option 2: Supabase Edge Functions (Production)
For production, you can use Supabase Edge Functions to process the email queue and send real emails.

## 📋 Current Implementation

### What's Working Now:
1. **User Invitations** - Creates invitation records in `user_invitations` table
2. **Email Templates** - Beautiful HTML email templates for invitations
3. **Database Queue** - Emails are stored in `email_queue` table
4. **Console Logging** - In development, emails are logged to console

### Files Created:
- `src/lib/emailService.ts` - Email service using Supabase
- `backend/database/email-queue-schema.sql` - Email queue table schema
- `supabase/functions/send-email/index.ts` - Edge function for sending emails

## 🔧 Setup Steps

### Step 1: Create Email Queue Table
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `backend/database/email-queue-schema.sql`
4. Click **Run** to create the table

### Step 2: Test Email Functionality
1. Go to your app: http://localhost:5173
2. Navigate to **Settings**
3. Click **Invite Team Member**
4. Fill in the form and click **Send Invitation**
5. Check the browser console for email logs

### Step 3: View Email Queue (Optional)
1. Go to your Supabase Dashboard
2. Navigate to **Table Editor**
3. Select the `email_queue` table
4. You'll see all queued emails with their status

## 📧 Email Templates

The system includes beautiful HTML email templates for:

### User Invitations
- **Subject**: "You're invited to join [Company] on Compass"
- **Content**: Professional invitation with company branding
- **Features**: Role badges, invitation links, expiration info

### Password Reset
- **Subject**: "Reset your Compass password"
- **Content**: Secure password reset with clear instructions
- **Features**: Reset links, expiration warnings

## 🚀 Production Setup (Optional)

### Option 1: Use Supabase Edge Functions
1. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy send-email
   ```

2. **Set up a cron job** to call the function every few minutes:
   ```bash
   # Add to your server or use a service like cron-job.org
   curl -X POST https://your-project.supabase.co/functions/v1/send-email \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

### Option 2: Integrate with Email Service
Update the Edge Function to use a real email service:

#### Using Resend (Recommended)
```typescript
// In supabase/functions/send-email/index.ts
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'noreply@yourcompany.com',
    to: email.to_email,
    subject: email.subject,
    html: email.html_content,
  }),
});
```

#### Using SendGrid
```typescript
// In supabase/functions/send-email/index.ts
const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: email.to_email }] }],
    from: { email: 'noreply@yourcompany.com', name: 'Compass Team' },
    subject: email.subject,
    content: [
      { type: 'text/html', value: email.html_content }
    ],
  }),
});
```

## 🧪 Testing

### Test User Invitation
1. **Send Invitation**: Use the Settings page to invite a user
2. **Check Console**: Look for email logs in browser console
3. **Check Database**: View the `email_queue` table in Supabase
4. **Verify Data**: Ensure invitation record is created in `user_invitations`

### Test Email Queue
1. **View Queue**: Check `email_queue` table in Supabase Dashboard
2. **Process Queue**: Call the Edge Function to process pending emails
3. **Check Status**: Verify emails are marked as sent

## 🔍 Troubleshooting

### Email Not Appearing in Queue
- Check browser console for errors
- Verify `email_queue` table exists
- Check Supabase RLS policies

### Edge Function Not Working
- Verify function is deployed: `supabase functions list`
- Check function logs: `supabase functions logs send-email`
- Ensure environment variables are set

### Email Templates Not Rendering
- Check variable replacement in `emailService.ts`
- Verify template variables are passed correctly
- Test with simple text content first

## 📊 Monitoring

### Database Queries
```sql
-- View pending emails
SELECT * FROM email_queue WHERE status = 'pending';

-- View failed emails
SELECT * FROM email_queue WHERE status = 'failed';

-- View sent emails (last 24 hours)
SELECT * FROM email_queue 
WHERE status = 'sent' 
AND sent_at > NOW() - INTERVAL '24 hours';

-- Clean up old emails
SELECT cleanup_old_emails();
```

### Edge Function Logs
```bash
# View function logs
supabase functions logs send-email

# Test function locally
supabase functions serve send-email
```

## 🎯 Next Steps

1. **Set up email service** (Resend, SendGrid, etc.)
2. **Deploy Edge Function** for production
3. **Set up monitoring** for email delivery
4. **Add email analytics** and tracking
5. **Implement email preferences** for users

## 🔗 Related Files

- `src/lib/emailService.ts` - Main email service
- `src/lib/auth.ts` - Invitation logic with email sending
- `backend/database/email-queue-schema.sql` - Database schema
- `supabase/functions/send-email/index.ts` - Edge function
- `src/components/auth/InviteTeamMember.tsx` - Invitation UI
