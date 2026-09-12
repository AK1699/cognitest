import { z } from 'zod';

import { INVITATION_STATUSES } from '../enums';

export const invitationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  email: z.email(),
  roleId: z.uuid(),
  teamId: z.uuid().nullable(),
  status: z.enum(INVITATION_STATUSES),
  invitedBy: z.uuid(),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Invitation = z.infer<typeof invitationSchema>;
