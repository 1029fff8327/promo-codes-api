CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "activation_limit" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promo_code_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE UNIQUE INDEX "activations_promo_code_id_email_key" ON "activations"("promo_code_id", "email");
CREATE INDEX "activations_promo_code_id_idx" ON "activations"("promo_code_id");

ALTER TABLE "activations"
ADD CONSTRAINT "activations_promo_code_id_fkey"
FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
