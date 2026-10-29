CREATE TYPE "public"."automation_framework" AS ENUM('playwright', 'cypress', 'selenium', 'puppeteer');--> statement-breakpoint
CREATE TYPE "public"."automation_method" AS ENUM('from_test_cases', 'visual', 'record', 'import');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('queued', 'running', 'passed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."automation_status" AS ENUM('draft', 'active', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."automation_test_status" AS ENUM('not_run', 'passed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "product"."automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"status" "automation_run_status" DEFAULT 'queued' NOT NULL,
	"environment" text,
	"browser" text,
	"workers" integer DEFAULT 1 NOT NULL,
	"headless" boolean DEFAULT true NOT NULL,
	"capture_screenshots" boolean DEFAULT false NOT NULL,
	"capture_video" boolean DEFAULT false NOT NULL,
	"trace_execution" boolean DEFAULT false NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"triggered_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product"."automation_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"priority" "test_case_priority" DEFAULT 'medium' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preconditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_result" text,
	"code" text,
	"last_status" "automation_test_status" DEFAULT 'not_run' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product"."automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"method" "automation_method" DEFAULT 'visual' NOT NULL,
	"framework" "automation_framework" DEFAULT 'playwright' NOT NULL,
	"status" "automation_status" DEFAULT 'draft' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flow" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_id_org_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "product"."automation_runs" ADD CONSTRAINT "automation_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automation_runs" ADD CONSTRAINT "automation_runs_automation_org_fk" FOREIGN KEY ("automation_id","organization_id") REFERENCES "product"."automations"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automation_tests" ADD CONSTRAINT "automation_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automation_tests" ADD CONSTRAINT "automation_tests_automation_org_fk" FOREIGN KEY ("automation_id","organization_id") REFERENCES "product"."automations"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automations" ADD CONSTRAINT "automations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automations" ADD CONSTRAINT "automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."automations" ADD CONSTRAINT "automations_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "product"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_automation_idx" ON "product"."automation_runs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_runs_org_idx" ON "product"."automation_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automation_tests_automation_idx" ON "product"."automation_tests" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "automation_tests_org_idx" ON "product"."automation_tests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automations_project_idx" ON "product"."automations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "automations_org_created_idx" ON "product"."automations" USING btree ("organization_id","created_at");--> statement-breakpoint
-- Tenant isolation for the automation module, same pattern as 0007/0012/0015/0017.
ALTER TABLE "product"."automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."automations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY automations_tenant ON "product"."automations"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint
ALTER TABLE "product"."automation_tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."automation_tests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY automation_tests_tenant ON "product"."automation_tests"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint
ALTER TABLE "product"."automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product"."automation_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY automation_runs_tenant ON "product"."automation_runs"
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());