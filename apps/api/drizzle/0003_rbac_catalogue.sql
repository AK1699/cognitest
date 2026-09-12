-- Catalogue rework: permission keys move from resource:ACTION to resource.action
-- and system roles change from owner/admin/member/viewer to the six spec roles.
-- Greenfield cleanup: drop the old catalogue rows so the NOT NULL columns below
-- can land; the seed repopulates everything (run `pnpm db:seed` after migrating).
DELETE FROM "role_permissions";--> statement-breakpoint
UPDATE "organization_members" SET "role_id" = NULL
  WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "organization_id" IS NULL AND "is_system");--> statement-breakpoint
DELETE FROM "roles" WHERE "organization_id" IS NULL AND "is_system";--> statement-breakpoint
DELETE FROM "permissions";--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "resource" text NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "action" text NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_key_uq" UNIQUE NULLS NOT DISTINCT("organization_id","key");