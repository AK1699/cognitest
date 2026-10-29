import { Module } from '@nestjs/common';

import { CryptoService } from '../auth/services/crypto.service';
import { ExternalLinksController } from './external-links.controller';
import { ExternalLinksService } from './external-links.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController, ExternalLinksController],
  // CryptoService is pure (derives keys from config); a local instance avoids an
  // AuthModule import, matching AuditModule's pattern.
  providers: [IntegrationsService, ExternalLinksService, CryptoService],
})
export class IntegrationsModule {}
