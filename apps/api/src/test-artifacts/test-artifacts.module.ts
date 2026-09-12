import { Module } from '@nestjs/common';

import { RequirementsService } from './requirements.service';
import { TestArtifactsController } from './test-artifacts.controller';
import { TestCasesService } from './test-cases.service';
import { TestPlansService } from './test-plans.service';

@Module({
  controllers: [TestArtifactsController],
  providers: [RequirementsService, TestPlansService, TestCasesService],
})
export class TestArtifactsModule {}
