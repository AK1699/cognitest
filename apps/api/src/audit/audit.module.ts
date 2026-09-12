import { Global, Module } from '@nestjs/common';

import { CryptoService } from '../auth/services/crypto.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  // CryptoService is pure (derives keys from config) — a second instance here
  // avoids a circular AuthModule <-> AuditModule import
  providers: [AuditService, CryptoService],
  exports: [AuditService],
})
export class AuditModule {}
