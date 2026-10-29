CREATE TYPE "public"."requirement_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD COLUMN "priority" "requirement_priority" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "product"."requirements" ADD COLUMN "source" "design_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD COLUMN "scope" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product"."test_plans" ADD COLUMN "strategy" text;