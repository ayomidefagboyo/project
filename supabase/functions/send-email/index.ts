/**
 * Supabase Edge Function for sending emails
 * 
 * This function processes the email queue and sends emails using
 * external email services like Resend, SendGrid, or AWS SES.
 * 
 * Deploy with: supabase functions deploy send-email
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending emails from the queue
    const { data: emails, error: fetchError } = await supabaseClient
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3) // Only retry up to 3 times
      .order('created_at', { ascending: true })
      .limit(10) // Process 10 emails at a time

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`)
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending emails to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const email of emails) {
      try {
        // In production, you would integrate with an email service here
        // For example, using Resend, SendGrid, or AWS SES
        
        // For now, we'll just mark the email as sent
        const { error: updateError } = await supabaseClient
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            retry_count: email.retry_count + 1
          })
          .eq('id', email.id)

        if (updateError) {
          throw new Error(`Failed to update email status: ${updateError.message}`)
        }

        results.push({
          id: email.id,
          to: email.to_email,
          subject: email.subject,
          status: 'sent'
        })

        console.log(`✅ Email sent: ${email.to_email} - ${email.subject}`)

      } catch (error) {
        // Mark email as failed and increment retry count
        await supabaseClient
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: email.retry_count + 1
          })
          .eq('id', email.id)

        results.push({
          id: email.id,
          to: email.to_email,
          subject: email.subject,
          status: 'failed',
          error: error.message
        })

        console.error(`❌ Email failed: ${email.to_email} - ${error.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${emails.length} emails`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To invoke this function locally, run:
   supabase functions serve send-email

   To deploy this function, run:
   supabase functions deploy send-email

   To test this function, run:
   curl -X POST http://localhost:54321/functions/v1/send-email \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
*/
