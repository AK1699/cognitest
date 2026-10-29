CREATE TYPE "public"."external_link_entity_type" AS ENUM('requirement', 'test_case', 'test_design');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('jira', 'github', 'bitbucket', 'notion');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'error');--> statement-breakpoint
CREATE TABLE "product"."external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"entity_type" "external_link_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"external_key" text NOT NULL,
	"external_url" text NOT NULL,
	"title" text,
	"state" text,
	"synced_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_links_entity_item_uq" UNIQUE("organization_id","entity_type","entity_id","provider","external_key")
);
--> statement-breakpoint
CREATE TABLE "product"."integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'connected' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret_encrypted" text NOT NULL,
	"account_label" text,
	"last_error" text,
	"last_verified_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_org_provider_uq" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
ALTER TABLE "product"."external_links" ADD CONSTRAINT "external_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."external_links" ADD CONSTRAINT "external_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."integration_connections" ADD CONSTRAINT "integration_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_links_entity_idx" ON "product"."external_links" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "external_links_org_idx" ON "product"."external_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_connections_org_idx" ON "product"."integration_connections" USING btree ("organization_id");--> statement-breakpoint
-- Tenant isolation for integrations, same pattern as 0007/0012/0015.
ALTER TABLE "product"."integration_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."integration_connections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY integration_connections_tenant ON "product"."integration_connections"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint
ALTER TABLE "product"."external_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."external_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY external_links_tenant ON "product"."external_links"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());