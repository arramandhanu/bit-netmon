import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter | null = null;
    private fromAddress: string;

    constructor(private readonly config: ConfigService) {
        const host = this.config.get<string>('smtp.host');
        const port = this.config.get<number>('smtp.port');
        const user = this.config.get<string>('smtp.user');
        const pass = this.config.get<string>('smtp.pass');

        this.fromAddress = user || 'noreply@bitnetmon.com';

        if (host && user && pass) {
            const actualPort = port || 465;
            this.transporter = nodemailer.createTransport({
                host,
                port: actualPort,
                secure: true, // Always use SSL
                auth: { user, pass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
            this.logger.log(`Email service configured (${host}:${actualPort})`);

            // Verify connection on startup
            this.transporter.verify().then(() => {
                this.logger.log('SMTP connection verified successfully');
            }).catch((err: any) => {
                this.logger.error(`SMTP connection failed: ${err.message}`);
            });
        } else {
            this.logger.warn('Email not configured — SMTP settings missing. Verification emails will be logged to console.');
        }
    }

    async sendVerificationEmail(to: string, username: string, token: string) {
        const baseUrl = this.config.get<string>('apiBaseUrl', 'https://netmon.bitlab.co.id');
        const verifyUrl = `${baseUrl}/api/v1/billing/verify?token=${token}`;

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f8fc; padding: 40px 0;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 24px; font-weight: bold;">B</span>
            </div>
            <h1 style="color: #111827; font-size: 22px; margin: 0;">Verifikasi Email Anda</h1>
        </div>
        
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
            Halo <strong>${username}</strong>,
        </p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
            Terima kasih telah mendaftar di <strong>BitNetMon</strong>. 
            Klik tombol di bawah untuk memverifikasi email Anda dan mengaktifkan akun:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(59,130,246,0.3);">
                Verifikasi Email
            </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            Link ini berlaku selama <strong>24 jam</strong>. Jika Anda tidak mendaftar di BitNetMon, abaikan email ini.
        </p>
        
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
        
        <p style="color: #d1d5db; font-size: 11px; text-align: center;">
            © ${new Date().getFullYear()} BitNetMon by Bintang Inovasi Teknologi
        </p>
    </div>
</body>
</html>`;

        if (this.transporter) {
            try {
                await this.transporter.sendMail({
                    from: `"BitNetMon" <${this.fromAddress}>`,
                    to,
                    subject: 'Verifikasi Email - BitNetMon',
                    html,
                });
                this.logger.log(`Verification email sent to ${to}`);
                return true;
            } catch (err: any) {
                this.logger.error(`Failed to send email to ${to}: ${err.message}`);
                return false;
            }
        } else {
            // Fallback: log the verification URL to console
            this.logger.warn(`[NO SMTP] Verification URL for ${to}: ${verifyUrl}`);
            return true;
        }
    }

    get isConfigured(): boolean {
        return !!this.transporter;
    }
}
