CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."test_case_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."test_plan_status" AS ENUM('draft', 'in_review', 'approved', 'archived');--> statement-breakpoint
CREATE TABLE "product"."approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"comment" text,
	"requested_by" uuid NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_entity_version_uq" UNIQUE("entity_type","entity_id","version")
);
--> statement-breakpoint
CREATE TABLE "product"."requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "requirement_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product"."test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"test_suite_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" "test_case_priority" DEFAULT 'medium' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product"."test_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requirement_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "test_plan_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_plans_id_org_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "product"."test_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"test_plan_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_suites_id_org_uq" UNIQUE("id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "product"."approvals" ADD CONSTRAINT "approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD CONSTRAINT "requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD CONSTRAINT "requirements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD CONSTRAINT "requirements_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "product"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_cases" ADD CONSTRAINT "test_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_cases" ADD CONSTRAINT "test_cases_suite_org_fk" FOREIGN KEY ("test_suite_id","organization_id") REFERENCES "product"."test_suites"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD CONSTRAINT "test_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenancy"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD CONSTRAINT "test_plans_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "product"."requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD CONSTRAINT "test_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD CONSTRAINT "test_plans_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "product"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product"."test_suites" ADD CONSTRAINT "test_suites_plan_org_fk" FOREIGN KEY ("test_plan_id","organization_id") REFERENCES "product"."test_plans"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_org_idx" ON "product"."approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "requirements_project_idx" ON "product"."requirements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirements_org_created_idx" ON "product"."requirements" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "test_cases_suite_idx" ON "product"."test_cases" USING btree ("test_suite_id");--> statement-breakpoint
CREATE INDEX "test_cases_org_idx" ON "product"."test_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "test_plans_project_idx" ON "product"."test_plans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_plans_org_created_idx" ON "product"."test_plans" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "test_suites_plan_idx" ON "product"."test_suites" USING btree ("test_plan_id");--> statement-breakpoint
CREATE INDEX "test_suites_org_idx" ON "product"."test_suites" USING btree ("organization_id");