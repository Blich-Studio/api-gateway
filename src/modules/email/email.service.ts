import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { escapeHtml } from '../../common/utils/html.util'
import { AppConfigService } from '../../common/config'
import sgMail from '@sendgrid/mail'

export const EMAIL_SERVICE = 'EMAIL_SERVICE'

export interface EmailVerificationData {
  email: string
  name: string
  token: string
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name)
  private sendgridApiKey: string | undefined
  private emailFrom: string | undefined

  constructor(private readonly appConfig: AppConfigService) {}

  onModuleInit(): void {
    this.sendgridApiKey = this.appConfig.sendgridApiKey
    this.emailFrom = this.appConfig.emailFrom

    if (this.sendgridApiKey && this.emailFrom) {
      sgMail.setApiKey(this.sendgridApiKey)
      // Note: setDataResidency('eu') is documented in SendGrid examples but not yet available in v8.1.6
      // Uncomment below when upgrading to a version that supports it:
      // sgMail.setDataResidency('eu')
      this.logger.log('SendGrid email provider initialized')
    } else if (!this.appConfig.isDevelopment) {
      this.logger.warn(
        'SendGrid is not configured. Set SENDGRID_API_KEY and EMAIL_FROM environment variables for email functionality.'
      )
    }
  }

  async sendVerificationEmail(data: EmailVerificationData): Promise<void> {
    const { email, name, token } = data
    const verificationUrl = `${this.appConfig.publicWebUrl}/auth/verify?token=${token}`

    this.logger.log(`Preparing to send verification email to: ${email}`)

    // If SendGrid is configured, use it to send the email
    if (this.sendgridApiKey && this.emailFrom) {
      try {
        const msg = {
          to: email,
          from: this.emailFrom,
          subject: 'Verify your email address',
          html: this.getVerificationEmailTemplate(name, verificationUrl),
        }
        await sgMail.send(msg)
        this.logger.log(`Verification email sent successfully to: ${email}`)
        return
      } catch (error) {
        this.logger.error(
          `Failed to send verification email via SendGrid to ${email}`,
          error instanceof Error ? error.stack : error
        )
        throw error
      }
    }

    // For development: Log the verification URL (with redacted token)
    if (this.appConfig.isDevelopment) {
      // Redact the token from URL to prevent exposure in log aggregation systems
      const redactedUrl = verificationUrl.replace(
        /token=[^&]+/,
        `token=${token.substring(0, 8)}...`
      )
      this.logger.log('='.repeat(80))
      this.logger.log('VERIFICATION EMAIL (Development Mode)')
      this.logger.log(`To: ${email}`)
      this.logger.log(`Name: ${name}`)
      this.logger.log(`Token: ${token.substring(0, 8)}... (redacted)`)
      this.logger.log(`Verification URL: ${redactedUrl}`)
      this.logger.log('='.repeat(80))
    } else {
      // Warn in non-development environments that emails are not actually being sent
      this.logger.warn(
        `Email provider not fully configured - verification email NOT sent to: ${email}. ` +
          `Set SENDGRID_API_KEY and EMAIL_FROM environment variables for production use.`
      )
    }

    this.logger.log(`Verification email processing completed for: ${email}`)

    return Promise.resolve()
  }

  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    // Escape HTML to prevent XSS attacks
    const safeName = escapeHtml(name)
    const safeUrlText = escapeHtml(verificationUrl)
    const { companyName } = this.appConfig

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #007bff;
              color: #ffffff;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome, ${safeName}!</h2>
            <p>Thank you for registering. Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${safeUrlText}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <div class="footer">
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>© ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}
