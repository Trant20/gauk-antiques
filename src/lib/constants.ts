/** GAUK Antiques site identifier — do not hardcode this anywhere else */
export const ANTIQUES_SITE_ID = 'add6d12c-ecd8-4517-b2e5-0f4977603744'

/** Cloudflare R2 CDN base URL for antiques images */
export const R2_CDN = 'https://pub-c3f96dd742f540188b92599aeed807c7.r2.dev'

/** Claude API pricing — last verified 2025-06, claude-sonnet-4-6
 *  Update here if Anthropic changes pricing */
export const CLAUDE_INPUT_COST_PENCE_PER_TOKEN = 0.003
export const CLAUDE_OUTPUT_COST_PENCE_PER_TOKEN = 0.015

/** Guest identification limit per 24-hour window */
export const GUEST_IDENTIFY_LIMIT = 2

/** Cloudflare Workers environment bindings */
export type CloudflareEnv = {
  PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ANTHROPIC_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  SESSION: KVNamespace
  gauk_antiques_images: R2Bucket
}
