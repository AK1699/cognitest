import {
  connectIntegrationRequestSchema,
  createExternalLinkRequestSchema,
  importRequirementsRequestSchema,
} from '@cognitest/shared';
import type {
  ExternalLinkEntityType,
  IntegrationProvider,
} from '@cognitest/shared';

export class ConnectIntegrationDto {
  static readonly zodSchema = connectIntegrationRequestSchema;
  token!: string;
  baseUrl?: string;
  email?: string;
  username?: string;
  workspace?: string;
}

export class CreateExternalLinkDto {
  static readonly zodSchema = createExternalLinkRequestSchema;
  provider!: IntegrationProvider;
  entityType!: ExternalLinkEntityType;
  entityId!: string;
  externalKey!: string;
  externalUrl?: string;
  title?: string;
  state?: string;
}

export class ImportRequirementsDto {
  static readonly zodSchema = importRequirementsRequestSchema;
  provider!: IntegrationProvider;
  designId?: string;
  keys!: string[];
}
