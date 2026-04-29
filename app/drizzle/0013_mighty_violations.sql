CREATE TABLE IF NOT EXISTS "feature_prompt_history" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_id" text NOT NULL,
	"content" text NOT NULL,
	"version" integer NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"feature_id" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "feature_prompts_feature_id_unique" UNIQUE("feature_id")
);
--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "recipe_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_provider_id" text DEFAULT 'anthropic';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_model_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_prompt_history" ADD CONSTRAINT "feature_prompt_history_prompt_id_feature_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."feature_prompts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_prompt_history" ADD CONSTRAINT "feature_prompt_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_prompts" ADD CONSTRAINT "feature_prompts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_expires_idx" ON "sessions" USING btree ("user_id","expires_at");