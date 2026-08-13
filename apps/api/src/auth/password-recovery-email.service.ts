import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Brevo, BrevoClient } from '@getbrevo/brevo';
import emailConfig from '../config/email.config';

export interface PasswordRecoveryEmailPayload {
  toEmail: string;
  toName?: string | null;
  temporaryPassword: string;
}

@Injectable()
export class PasswordRecoveryEmailService {
  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
  ) {}

  async sendTemporaryPassword(payload: PasswordRecoveryEmailPayload): Promise<void> {
    if (!this.config.brevoApiKey || !this.config.senderEmail) {
      throw new Error('BREVO_CONFIG_MISSING');
    }

    const brevo = new BrevoClient({ apiKey: this.config.brevoApiKey });

    const recipientName = payload.toName?.trim() || undefined;
    const temporaryPassword = this.escapeHtml(payload.temporaryPassword);

    const email: Brevo.SendTransacEmailRequest = {
      sender: {
        email: this.config.senderEmail,
        name: this.config.senderName,
      },
      to: [
        {
          email: payload.toEmail,
          name: recipientName,
        },
      ],
      subject: 'Recuperación de contraseña - Sonoffice',
      htmlContent: `
        <p>Hola${recipientName ? ` ${this.escapeHtml(recipientName)}` : ''},</p>
        <p>Recibimos una solicitud para recuperar la contraseña de tu cuenta de Sonoffice.</p>
        <p>Tu contraseña temporal es:</p>
        <p><strong style="font-size: 18px; letter-spacing: 0.04em;">${temporaryPassword}</strong></p>
        <p>Ingresa con esta contraseña temporal y actualiza tu contraseña inmediatamente después de iniciar sesión.</p>
        <p>Si no solicitaste este cambio, contacta al administrador del sistema.</p>
      `,
      textContent: [
        `Hola${recipientName ? ` ${recipientName}` : ''},`,
        'Recibimos una solicitud para recuperar la contraseña de tu cuenta de Sonoffice.',
        `Tu contraseña temporal es: ${payload.temporaryPassword}`,
        'Ingresa con esta contraseña temporal y actualiza tu contraseña inmediatamente después de iniciar sesión.',
        'Si no solicitaste este cambio, contacta al administrador del sistema.',
      ].join('\n\n'),
    };

    await brevo.transactionalEmails.sendTransacEmail(email);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
