import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const EMAIL_SERVICE = 'EMAIL_SERVICE'

export interface EmailVerificationData {
  email: string
  name: string
  token: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(data: EmailVerificationData): Promise<void> {
    const { email, name, token } = data
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000')
    const verificationUrl = `${appUrl}/auth/verify?token=${token}`

    this.logger.log(`Preparing to send verification email to: ${email}`)

    // TODO: Replace with your email provider implementation
    // Example implementations below:

    // Using SendGrid:
    // const msg = {
    //   to: email,
    //   from: this.configService.getOrThrow<string>('EMAIL_FROM'),
    //   subject: 'Verify your email address',
    //   html: this.getVerificationEmailTemplate(name, verificationUrl),
    // }
    // await this.sendgridClient.send(msg)

    // Using AWS SES:
    // const params = {
    //   Source: this.configService.getOrThrow<string>('EMAIL_FROM'),
    //   Destination: { ToAddresses: [email] },
    //   Message: {
    //     Subject: { Data: 'Verify your email address' },
    //     Body: {
    //       Html: { Data: this.getVerificationEmailTemplate(name, verificationUrl) },
    //     },
    //   },
    // }
    // await this.sesClient.sendEmail(params).promise()

    // Using Nodemailer:
    // await this.transporter.sendMail({
    //   from: this.configService.getOrThrow<string>('EMAIL_FROM'),
    //   to: email,
    //   subject: 'Verify your email address',
    //   html: this.getVerificationEmailTemplate(name, verificationUrl),
    // })

    // For development: Log the verification URL
    if (process.env.NODE_ENV === 'development') {
      this.logger.log('='.repeat(80))
      this.logger.log('VERIFICATION EMAIL')
      this.logger.log(`To: ${email}`)
      this.logger.log(`Name: ${name}`)
      this.logger.log(`Token: ${token}`)
      this.logger.log(`Verification URL: ${verificationUrl}`)
      this.logger.log('='.repeat(80))
    }

    this.logger.log(`Verification email sent successfully to: ${email}`)

    return Promise.resolve()
  }

  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
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
            <h2>Welcome, ${name}!</h2>
            <p>Thank you for registering. Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <div class="footer">
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>© ${new Date().getFullYear()} Blich Studio. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}
