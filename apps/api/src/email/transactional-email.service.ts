import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Brevo, BrevoClient } from '@getbrevo/brevo';
import emailConfig from '../config/email.config';

export interface TransactionalEmailRecipient {
  email: string;
  name?: string | null;
}

export interface TransactionalEmailSection {
  title?: string;
  rows: Array<{ label: string; value: string | number | Date | null | undefined }>;
}

export interface TransactionalEmailTemplate {
  title: string;
  intro: string | string[];
  label?: string;
  icon?: string;
  preheader?: string;
  sections?: TransactionalEmailSection[];
  cta?: { label: string; url: string };
  footer?: string;
}

export interface SendTemplatedEmailPayload extends TransactionalEmailTemplate {
  to: TransactionalEmailRecipient[];
  subject: string;
}

@Injectable()
export class TransactionalEmailService {
  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>,
  ) {}

  async sendTemplatedEmail(payload: SendTemplatedEmailPayload): Promise<void> {
    if (!this.config.brevoApiKey || !this.config.senderEmail) {
      throw new Error('BREVO_CONFIG_MISSING');
    }

    const recipients = payload.to
      .map((recipient) => ({
        email: recipient.email.trim(),
        name: recipient.name?.trim() || undefined,
      }))
      .filter((recipient) => recipient.email);

    if (recipients.length === 0) return;

    const brevo = new BrevoClient({ apiKey: this.config.brevoApiKey });
    const email: Brevo.SendTransacEmailRequest = {
      sender: {
        email: this.config.senderEmail,
        name: this.config.senderName,
      },
      to: recipients,
      subject: payload.subject,
      htmlContent: this.renderHtml(payload),
      textContent: this.renderText(payload),
    };

    await brevo.transactionalEmails.sendTransacEmail(email);
  }

  private renderHtml(payload: TransactionalEmailTemplate): string {
    const intro = Array.isArray(payload.intro) ? payload.intro : [payload.intro];
    const preheader = payload.preheader ?? intro[0] ?? payload.title;
    const label = payload.label ?? 'Notificación';
    const icon = payload.icon ?? '•';
    const now = new Date().toLocaleString('es-CO');
    const introHtml = intro.map((line) => this.escapeHtml(line)).join('<br>');
    const sectionsHtml = (payload.sections ?? [])
      .map((section) => {
        const rows = section.rows
          .filter((row) => row.value !== null && row.value !== undefined && String(row.value).trim() !== '')
          .map(
            (row) => `
              <tr>
                <td class="stack" width="50%" valign="top" style="padding-bottom:14px;">
                  <div class="txt-muted" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:.5px; text-transform:uppercase; color:#94a3b8;">${this.escapeHtml(row.label)}</div>
                  <div class="txt" style="font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#0f172a; padding-top:4px; line-height:1.45;">${this.escapeHtml(this.formatValue(row.value))}</div>
                </td>
              </tr>`,
          )
          .join('');

        return rows
          ? `
            ${section.title ? `<tr><td style="padding:0 0 12px; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:#0891b2;">${this.escapeHtml(section.title)}</td></tr>` : ''}
            <tr>
              <td style="padding:0 0 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="meta-cell" style="background:#f7f8fa; border:1px solid #e6e8ec; border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
          : '';
      })
      .join('');
    const ctaHtml = payload.cta
      ? `
        <tr>
          <td class="px" style="padding:26px 36px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0f172a" style="border-radius:10px;">
                  <a href="${this.escapeHtml(payload.cta.url)}" target="_blank" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; padding:14px 30px; border-radius:10px; text-decoration:none;">${this.escapeHtml(payload.cta.label)} &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : '';
    const footer = payload.footer ?? 'Recibes este correo porque tienes una notificación relacionada con Sonoffice ERP.';

    return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${this.escapeHtml(payload.title)}</title>
    <style>
      body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
      a { text-decoration:none; }
      @media only screen and (max-width:600px) {
        .container { width:100% !important; }
        .px { padding-left:24px !important; padding-right:24px !important; }
        .stack { display:block !important; width:100% !important; box-sizing:border-box; }
        .h1 { font-size:22px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .bg-page { background:#0b1119 !important; }
        .bg-card { background:#111725 !important; }
        .txt { color:#e8ecf3 !important; }
        .txt-muted { color:#9fb0c4 !important; }
        .divider { border-color:rgba(255,255,255,.10) !important; }
        .meta-cell { background:#0d1420 !important; }
      }
    </style>
  </head>
  <body class="bg-page" style="margin:0; padding:0; background:#eef0f3;">
    <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all;">${this.escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background:#eef0f3;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="container" style="width:600px; max-width:600px;">
            <tr>
              <td class="px" style="padding:4px 8px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="font-family:Arial,Helvetica,sans-serif; font-size:20px; font-weight:bold; letter-spacing:-.4px; color:#0f172a;" class="txt"><span style="color:#0891b2;">Son</span><span class="txt" style="color:#0f172a;">office</span></td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#64748b;" class="txt-muted">ERP · Notificaciones</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="bg-card" style="background:#ffffff; border:1px solid #e6e8ec; border-radius:16px; overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="height:4px; line-height:4px; font-size:0; background:#0891b2;">&nbsp;</td></tr>
                  <tr>
                    <td class="px" style="padding:30px 36px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="44" valign="middle" style="width:44px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="40" height="40" style="width:40px; height:40px; background:#ecfeff; border-radius:11px; font-family:Arial,Helvetica,sans-serif; font-size:20px; font-weight:bold; color:#0891b2;">${this.escapeHtml(icon)}</td></tr></table></td>
                          <td valign="middle" style="padding-left:14px; font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#0891b2;">${this.escapeHtml(label)}</div><div class="txt-muted" style="font-size:13px; color:#64748b; padding-top:3px;">${this.escapeHtml(now)}</div></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr><td class="px" style="padding:20px 36px 0; font-family:Arial,Helvetica,sans-serif;"><h1 class="h1 txt" style="margin:0; font-size:25px; line-height:1.25; font-weight:bold; letter-spacing:-.5px; color:#0f172a;">${this.escapeHtml(payload.title)}</h1></td></tr>
                  <tr><td class="px txt-muted" style="padding:14px 36px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#475569;">${introHtml}</td></tr>
                  <tr><td class="px" style="padding:22px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${sectionsHtml}</table></td></tr>
                  ${ctaHtml}
                  <tr><td class="px" style="padding:22px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="divider" style="border-top:1px solid #e6e8ec; font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>
                  <tr><td class="px txt-muted" style="padding:16px 36px 30px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#94a3b8;">${this.escapeHtml(footer)}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:22px 24px 8px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#94a3b8;" align="center">
                <div style="color:#64748b; font-weight:bold;">Sonovista S.A.S.</div>
                <div style="padding-top:2px;">Calle 70 # 53-74, piso 5 (Nte. Centro Histórico)</div>
                <div style="padding-top:12px; color:#b4bdc9;">© ${new Date().getFullYear()} Sonovista · Sonoffice ERP v3.0</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private renderText(payload: TransactionalEmailTemplate): string {
    const lines: string[] = [payload.title, ''];
    lines.push(...(Array.isArray(payload.intro) ? payload.intro : [payload.intro]), '');

    for (const section of payload.sections ?? []) {
      if (section.title) lines.push(section.title);
      for (const row of section.rows) {
        if (row.value === null || row.value === undefined || String(row.value).trim() === '') continue;
        lines.push(`${row.label}: ${this.formatValue(row.value)}`);
      }
      lines.push('');
    }

    if (payload.cta) lines.push(`${payload.cta.label}: ${payload.cta.url}`, '');
    lines.push(payload.footer ?? 'Este es un mensaje automático de Sonoffice. Por favor no respondas a este correo.');

    return lines.join('\n').trim();
  }

  private formatValue(value: string | number | Date): string {
    return value instanceof Date ? value.toLocaleString('es-CO') : String(value);
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
