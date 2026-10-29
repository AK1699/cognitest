ALTER TABLE "product"."projects" ADD COLUMN "team_id" uuid;--> statement-breakpoint
-- backfill existing projects onto their organisation's oldest team
UPDATE "product"."projects" p
SET "team_id" = (
  SELECT t."id" FROM "tenancy"."teams" t
  WHERE t."organization_id" = p."organization_id"
  ORDER BY t."created_at"
  LIMIT 1
)
WHERE p."team_id" IS NULL;--> statement-breakpoint
ALTER TABLE "product"."projects" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product"."projects" ADD CONSTRAINT "projects_team_org_fk" FOREIGN KEY ("team_id","organization_id") REFERENCES "tenancy"."teams"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_team_id_idx" ON "product"."projects" USING btree ("team_id");
