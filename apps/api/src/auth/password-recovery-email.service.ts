import { Injectable } from '@nestjs/common';
import { TransactionalEmailService } from '../email/transactional-email.service';

export interface PasswordRecoveryEmailPayload {
  toEmail: string;
  toName?: string | null;
  temporaryPassword: string;
}

@Injectable()
export class PasswordRecoveryEmailService {
  constructor(private readonly transactionalEmailService: TransactionalEmailService) {}

  async sendTemporaryPassword(payload: PasswordRecoveryEmailPayload): Promise<void> {
    const recipientName = payload.toName?.trim() || undefined;

    await this.transactionalEmailService.sendTemplatedEmail({
      to: [{ email: payload.toEmail, name: recipientName }],
      subject: 'Recuperación de contraseña - Sonoffice',
      title: 'Recuperación de contraseña',
      intro: [
        `Hola${recipientName ? ` ${recipientName}` : ''},`,
        'Recibimos una solicitud para recuperar la contraseña de tu cuenta de Sonoffice.',
      ],
      sections: [
        {
          title: 'Contraseña temporal',
          rows: [{ label: 'Contraseña', value: payload.temporaryPassword }],
        },
      ],
      footer: [
        'Ingresa con esta contraseña temporal y actualiza tu contraseña inmediatamente después de iniciar sesión.',
        'Si no solicitaste este cambio, contacta al administrador del sistema.',
      ].join(' '),
    });
  }
}
