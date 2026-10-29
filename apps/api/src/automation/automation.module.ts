import { Module } from '@nestjs/common';

import { AutomationRunsService } from './automation-runs.service';
import { AutomationController } from './automation.controller';
import { AutomationsService } from './automations.service';

@Module({
  controllers: [AutomationController],
  providers: [AutomationsService, AutomationRunsService],
})
export class AutomationModule {}
