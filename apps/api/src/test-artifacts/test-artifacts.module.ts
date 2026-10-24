import { Module } from '@nestjs/common';

import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { RequirementsService } from './requirements.service';
import { TestArtifactsController } from './test-artifacts.controller';
import { TestCasesService } from './test-cases.service';
import { TestPlansService } from './test-plans.service';

@Module({
  controllers: [TestArtifactsController, DesignsController],
  providers: [DesignsService, RequirementsService, TestPlansService, TestCasesService],
})
export class TestArtifactsModule {}
