import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';

import type { Env } from '../../config/env.schema';
import { renderBrandedEmail } from './mail-templates';
import type { BrandedEmail } from './mail-templates';

export const MAILER = Symbol('MAILER');

/**
 * Thin mail dispatch over an injected nodemailer transport (SMTP → Mailpit in
 * dev, jsonTransport when MAIL_HOST is unset, capturing fake in e2e tests).
 * Every mail ships a plain-text part plus branded HTML (see mail-templates).
 * Links point at the web origin — the Next proxy forwards /api to this API.
 */
@Injectable()
export class MailService {
  private readonly from: string;
  private readonly webOrigin: string;

  constructor(
    @Inject(MAILER) private readonly transport: Transporter,
    config: ConfigService<Env, true>,
  ) {
    this.from = config.get('MAIL_FROM', { infer: true });
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  private async send(to: string, subject: string, email: BrandedEmail): Promise<void> {
    const text = [
      email.heading,
      '',
      ...email.bodyLines,
      '',
      `${email.cta.label}: ${email.cta.url}`,
      '',
      email.footnote,
    ].join('\n');
    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html: renderBrandedEmail(email),
    });
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    await this.send(to, 'Verify your Cognitest email', {
      heading: 'Welcome to Cognitest!',
      bodyLines: ['Confirm your email address to finish setting up your account.'],
      cta: { label: 'Verify email', url: `${this.webOrigin}/verify-email?token=${rawToken}` },
      footnote:
        'This link is valid for 24 hours. If you did not sign up for Cognitest, ignore this email.',
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    await this.send(to, 'Reset your Cognitest password', {
      heading: 'Reset your password',
      bodyLines: ['A password reset was requested for this address.'],
      cta: { label: 'Choose a new password', url: `${this.webOrigin}/reset-password?token=${rawToken}` },
      footnote:
        'This link is valid for 1 hour. If you did not request a reset, ignore this email — your password is unchanged.',
    });
  }

  async sendInvitationEmail(to: string, rawToken: string, organizationName: string): Promise<void> {
    await this.send(to, `You have been invited to ${organizationName} on Cognitest`, {
      heading: `Join ${organizationName}`,
      bodyLines: [`You have been invited to join ${organizationName} on Cognitest.`],
      cta: {
        label: 'Accept invitation',
        url: `${this.webOrigin}/accept-invitation?token=${rawToken}`,
      },
      footnote:
        'This invitation is valid for 7 days. If you were not expecting it, ignore this email.',
    });
  }
}
