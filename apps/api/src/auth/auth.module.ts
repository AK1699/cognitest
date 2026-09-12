import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

import type { Env } from '../config/env.schema';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcController } from './oidc.controller';
import { OidcService } from './services/oidc.service';
import { AuthGuard } from './guards/auth.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { CryptoService } from './services/crypto.service';
import { MAILER, MailService } from './services/mail.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [AuthController, OidcController],
  providers: [
    AuthService,
    OidcService,
    CryptoService,
    PasswordService,
    TokenService,
    SessionService,
    MailService,
    AuthGuard,
    CsrfGuard,
    {
      provide: MAILER,
      useFactory: (config: ConfigService<Env, true>) => {
        const host = config.get('MAIL_HOST', { infer: true });
        // no SMTP configured (CI): jsonTransport swallows mail without a socket
        return host
          ? createTransport({ host, port: config.get('MAIL_PORT', { infer: true }), secure: false })
          : createTransport({ jsonTransport: true });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthGuard, CsrfGuard, SessionService, CryptoService, MailService],
})
export class AuthModule {}
