import { z } from "zod";

const schema = z.object({
  TRADOVATE_USERNAME: z.string().min(1),
  TRADOVATE_PASSWORD: z.string().min(1),
  TRADOVATE_APP_ID: z.string().min(1),
  TRADOVATE_APP_SECRET: z.string().min(1),
  TRADOVATE_CID: z.coerce.number().int(),
  TRADOVATE_DEVICE_ID: z.string().uuid(),
  TRADOVATE_ENVIRONMENT: z.enum(["demo", "live"]).default("demo"),
  TRADOVATE_ACCOUNT_ID: z.coerce.number().int().optional(),
});

export type Config = z.infer<typeof schema>;

export function getConfig(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Missing or invalid environment variables:\n  ${missing}`);
  }
  return parsed.data;
}

export function getTradovateBaseUrl(): string {
  const env = getConfig().TRADOVATE_ENVIRONMENT;
  return env === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}
