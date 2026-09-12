-- Tenant isolation for the product artefact tables, same pattern as 0007.
ALTER TABLE product.requirements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE product.requirements FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY requirements_tenant ON product.requirements
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE product.test_plans ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE product.test_plans FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY test_plans_tenant ON product.test_plans
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE product.test_suites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE product.test_suites FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY test_suites_tenant ON product.test_suites
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE product.test_cases ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE product.test_cases FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY test_cases_tenant ON product.test_cases
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE product.approvals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE product.approvals FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY approvals_tenant ON product.approvals
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());