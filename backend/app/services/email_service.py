"""
Email service using Resend for reliable email delivery
"""

import logging
import os
from typing import Dict, Any, Optional
import resend

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending invitations and notifications using Resend"""

    def __init__(self):
        # Initialize Resend with API key
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("FROM_EMAIL", "onboarding@compazz.app")

        if self.resend_api_key and self.resend_api_key != "your_resend_api_key_here":
            resend.api_key = self.resend_api_key
            self.resend_enabled = True
            logger.info("✅ Resend email service initialized")
        else:
            self.resend_enabled = False
            logger.warning("⚠️ Resend API key not configured - using mock mode")

    async def send_invitation_email(
        self,
        email: str,
        name: str,
        inviter_name: str,
        company_name: str,
        invitation_token: str,
        role: str
    ) -> Dict[str, Any]:
        """
        Send invitation email using Supabase

        Args:
            email: Recipient email address
            name: Recipient name
            inviter_name: Name of person sending invitation
            company_name: Company name
            invitation_token: Secure invitation token
            role: Role being invited for

        Returns:
            Dict with success status and message
        """
        try:
            # Create invitation acceptance URL
            # Note: Update this URL to match your frontend domain
            invitation_url = f"https://compazz.app/invite/accept/{invitation_token}"

            # Email subject
            subject = f"You're invited to join {company_name} on Compazz"

            # Email HTML content
            html_content = self._create_invitation_email_html(
                name=name,
                inviter_name=inviter_name,
                company_name=company_name,
                role=role,
                invitation_url=invitation_url
            )

            if self.resend_enabled:
                try:
                    # Send email using Resend
                    response = resend.Emails.send({
                        "from": self.from_email,
                        "to": [email],
                        "subject": subject,
                        "html": html_content
                    })

                    logger.info(f"✅ Invitation email sent via Resend to {email}")
                    logger.info(f"📧 Resend Email ID: {response.get('id', 'N/A')}")
                    logger.info(f"📧 Subject: {subject}")
                    logger.info(f"📧 Invitation URL: {invitation_url}")
                    logger.info(f"📧 Company: {company_name}, Role: {role}, Invited by: {inviter_name}")

                    return {
                        "success": True,
                        "message": f"Invitation email sent to {email}",
                        "email_id": response.get('id'),
                        "method": "resend"
                    }

                except Exception as resend_error:
                    logger.error(f"❌ Resend email failed: {str(resend_error)}")
                    # Fall back to logging mode
                    return self._log_invitation_details(email, subject, invitation_url, company_name, role, inviter_name)
            else:
                # Mock mode - log invitation details
                return self._log_invitation_details(email, subject, invitation_url, company_name, role, inviter_name)

        except Exception as e:
            logger.error(f"❌ Error sending invitation email to {email}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send invitation: {str(e)}"
            }

    def _log_invitation_details(self, email: str, subject: str, invitation_url: str, company_name: str, role: str, inviter_name: str) -> Dict[str, Any]:
        """Log invitation details when email sending is not available"""
        logger.info(f"📧 MOCK MODE: Invitation would be sent to {email}")
        logger.info(f"📧 Subject: {subject}")
        logger.info(f"📧 Invitation URL: {invitation_url}")
        logger.info(f"📧 Company: {company_name}, Role: {role}, Invited by: {inviter_name}")
        logger.info("📧 To enable real email sending, add your Resend API key to RESEND_API_KEY environment variable")

        return {
            "success": True,
            "message": f"Invitation created for {email} (Mock mode - check server logs for invitation URL)",
            "invitation_url": invitation_url,
            "method": "mock"
        }

    def _create_invitation_email_html(
        self,
        name: str,
        inviter_name: str,
        company_name: str,
        role: str,
        invitation_url: str
    ) -> str:
        """Create HTML content for invitation email"""

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to join {company_name}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <!-- Header -->
                <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #f0f0f0;">
                    <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Compazz</h1>
                    <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Financial Management Platform</p>
                </div>

                <!-- Main Content -->
                <div style="padding: 30px 0;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0;">You're Invited!</h2>

                    <p style="font-size: 16px; margin: 0 0 15px 0;">Hi {name},</p>

                    <p style="font-size: 16px; margin: 0 0 15px 0;">
                        <strong>{inviter_name}</strong> has invited you to join <strong>{company_name}</strong>
                        as a <strong>{role.replace('_', ' ').title()}</strong> on Compazz.
                    </p>

                    <p style="font-size: 16px; margin: 0 0 25px 0;">
                        Compazz helps businesses manage their finances, track expenses, and generate reports.
                        Click the button below to accept your invitation and set up your account.
                    </p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_url}"
                           style="background-color: #2563eb; color: white; text-decoration: none;
                                  padding: 12px 30px; border-radius: 6px; font-weight: bold;
                                  display: inline-block; font-size: 16px;">
                            Accept Invitation
                        </a>
                    </div>

                    <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                        If the button doesn't work, you can copy and paste this link into your browser:<br>
                        <a href="{invitation_url}" style="color: #2563eb; word-break: break-all;">{invitation_url}</a>
                    </p>

                    <p style="font-size: 14px; color: #666; margin: 20px 0 0 0;">
                        This invitation will expire in 7 days. If you have any questions,
                        please contact {inviter_name} or reply to this email.
                    </p>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid #e5e7eb; padding: 20px 0; text-align: center;">
                    <p style="font-size: 14px; color: #666; margin: 0;">
                        This email was sent by Compazz. If you weren't expecting this invitation,
                        you can safely ignore this email.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """


# Create singleton instance
email_service = EmailService()