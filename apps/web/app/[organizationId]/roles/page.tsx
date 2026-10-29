import type { Metadata } from 'next';

import { apiGet } from '../../../lib/api';

export const metadata: Metadata = { title: 'Roles & Permissions — Cognitest' };
export const dynamic = 'force-dynamic';

interface RolesResponse {
  roles: { id: string; key: string; name: string; description: string | null; isSystem: boolean }[];
}
interface PermissionsResponse {
  permissions: {
    id: string;
    key: string;
    resource: string;
    action: string;
    description: string | null;
  }[];
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  // both 403 for members without role.read → null → access note shown instead
  const [roles, permissions] = await Promise.all([
    apiGet<RolesResponse>(`/organizations/${organizationId}/roles`),
    apiGet<PermissionsResponse>(`/organizations/${organizationId}/permissions`),
  ]);

  const byResource = new Map<string, NonNullable<typeof permissions>['permissions']>();
  for (const permission of permissions?.permissions ?? []) {
    const group = byResource.get(permission.resource) ?? [];
    group.push(permission);
    byResource.set(permission.resource, group);
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-primary-deep">Roles &amp; Permissions</h1>

      {!roles && !permissions ? (
        <p className="text-sm text-muted">
          You don&apos;t have permission to view roles in this organisation.
        </p>
      ) : (
        <>
          <section className="rounded-card border border-line bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">Roles</h2>
            <ul className="divide-y divide-line">
              {(roles?.roles ?? []).map((role) => (
                <li key={role.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{role.name}</p>
                    {role.description && <p className="text-sm text-muted">{role.description}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      role.isSystem ? 'bg-primary-tint text-primary-deep' : 'bg-accent-tint text-accent-deep'
                    }`}
                  >
                    {role.isSystem ? 'System' : 'Custom'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-card border border-line bg-white p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
              Permission catalogue
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {[...byResource.entries()].map(([resource, perms]) => (
                <div key={resource}>
                  <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-primary-deep">
                    {resource}
                  </h3>
                  <ul className="space-y-1">
                    {perms.map((permission) => (
                      <li key={permission.id} className="flex items-baseline gap-2 text-sm">
                        <code className="rounded bg-primary-tint px-1.5 py-0.5 font-mono text-xs text-primary-deep">
                          {permission.key}
                        </code>
                        {permission.description && (
                          <span className="text-muted">{permission.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
