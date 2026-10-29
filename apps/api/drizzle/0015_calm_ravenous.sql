CREATE TYPE "public"."design_source" AS ENUM('manual', 'document', 'jira');--> statement-breakpoint
CREATE TYPE "public"."design_status" AS ENUM('draft', 'in_review', 'approved', 'archived');--> statement-breakpoint
CREATE TABLE "product"."test_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" "design_source" DEFAULT 'manual' NOT NULL,
	"status" "design_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_designs_id_org_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD COLUMN "design_id" uuid;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD COLUMN "design_id" uuid;--> statement-breakpoint
ALTER TABLE "product"."test_designs" ADD CONSTRAINT "test_designs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_designs" ADD CONSTRAINT "test_designs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_designs" ADD CONSTRAINT "test_designs_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "product"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_designs_project_idx" ON "product"."test_designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_designs_org_created_idx" ON "product"."test_designs" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD CONSTRAINT "requirements_design_org_fk" FOREIGN KEY ("design_id","organization_id") REFERENCES "product"."test_designs"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD CONSTRAINT "test_plans_design_org_fk" FOREIGN KEY ("design_id","organization_id") REFERENCES "product"."test_designs"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requirements_design_idx" ON "product"."requirements" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "test_plans_design_idx" ON "product"."test_plans" USING btree ("design_id");--> statement-breakpoint
-- Tenant isolation for test designs, same pattern as 0007/0012.
ALTER TABLE "product"."test_designs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."test_designs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY test_designs_tenant ON "product"."test_designs"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());