import { foreignKey, index, integer, pgEnum, text, unique, uuid } from 'drizzle-orm/pg-core';

import { DESIGN_SOURCES, DESIGN_STATUSES } from '@cognitest/shared';

import { id, timestamps } from './helpers';
import { organizations } from './organizations';
import { projects } from './projects';
import { productSchema } from './schemas';
import { users } from './users';

export const designStatus = pgEnum('design_status', DESIGN_STATUSES);
export const designSource = pgEnum('design_source', DESIGN_SOURCES);

/**
 * A test design groups the requirements, analysis and generated artefacts for a
 * body of testing work within a project. Approval is version-aware, mirroring
 * test plans; the composite (id, organization_id) unique key lets child rows
 * (requirements, test plans) pin themselves to the same tenant.
 */
export const testDesigns = productSchema.table(
  'test_designs',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    source: designSource('source').notNull().default('manual'),
    status: designStatus('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('test_designs_project_idx').on(t.projectId),
    index('test_designs_org_created_idx').on(t.organizationId, t.createdAt),
    unique('test_designs_id_org_uq').on(t.id, t.organizationId),
    foreignKey({
      name: 'test_designs_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('cascade'),
  ],
);
