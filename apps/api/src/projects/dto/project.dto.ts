import {
  createProjectRequestSchema,
  projectMemberRequestSchema,
  updateProjectRequestSchema,
} from '@cognitest/shared';
import type { ProjectStatus } from '@cognitest/shared';

export class CreateProjectDto {
  static readonly zodSchema = createProjectRequestSchema;
  key!: string;
  name!: string;
  description?: string;
}

export class UpdateProjectDto {
  static readonly zodSchema = updateProjectRequestSchema;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export class ProjectMemberDto {
  static readonly zodSchema = projectMemberRequestSchema;
  userId!: string;
}
