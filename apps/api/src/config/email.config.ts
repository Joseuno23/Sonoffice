import { registerAs } from '@nestjs/config';

export interface EmailConfig {
  brevoApiKey: string;
  senderEmail: string;
  senderName: string;
}

export default registerAs(
  'email',
  (): EmailConfig => ({
    brevoApiKey: process.env.BREVO_API_KEY ?? '',
    senderEmail: process.env.BREVO_SENDER_EMAIL ?? 'sistemaop@sonovista.co',
    senderName: process.env.BREVO_SENDER_NAME ?? 'Sonoffice',
  }),
);
