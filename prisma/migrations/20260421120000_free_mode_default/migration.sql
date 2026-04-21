-- Enable free mode by default until the admin panel (Phase 4) is available
INSERT INTO "AdminSettings" ("key", "value")
VALUES ('free_mode_active', 'true'::jsonb)
ON CONFLICT ("key") DO UPDATE SET "value" = 'true'::jsonb;
