import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';

import type { Env } from '../../config/env.schema';

export const MAILER = Symbol('MAILER');

interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Thin mail dispatch over an injected nodemailer transport (SMTP → Mailpit in
 * dev, jsonTransport when MAIL_HOST is unset, capturing fake in e2e tests).
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

  private async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...mail });
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const link = `${this.webOrigin}/verify-email?token=${rawToken}`;
    await this.send({
      to,
      subject: 'Verify your Cognitest email',
      text: `Welcome to Cognitest!\n\nConfirm your email address by opening this link (valid for 24 hours):\n\n${link}\n\nIf you did not sign up, ignore this email.`,
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const link = `${this.webOrigin}/reset-password?token=${rawToken}`;
    await this.send({
      to,
      subject: 'Reset your Cognitest password',
      text: `A password reset was requested for this address.\n\nSet a new password here (link valid for 1 hour):\n\n${link}\n\nIf you did not request this, ignore this email — your password is unchanged.`,
    });
  }

  async sendInvitationEmail(to: string, rawToken: string, organizationName: string): Promise<void> {
    const link = `${this.webOrigin}/accept-invitation?token=${rawToken}`;
    await this.send({
      to,
      subject: `You have been invited to ${organizationName} on Cognitest`,
      text: `You have been invited to join ${organizationName} on Cognitest.\n\nAccept the invitation (valid for 7 days):\n\n${link}\n\nIf you were not expecting this, ignore this email.`,
    });
  }
}
