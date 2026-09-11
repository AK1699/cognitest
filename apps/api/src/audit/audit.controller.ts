import { Controller } from '@nestjs/common';

import { AuditService } from './audit.service';

/** Placeholder — no routes yet. */
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}
}
