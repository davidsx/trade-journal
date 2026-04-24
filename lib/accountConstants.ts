/** Default trading account; all existing data is backfilled to this id. */
export const DEFAULT_ACCOUNT_ID = 1;

/** Default `Account.initialBalance` for new accounts and fallback if an account row is missing. */
export const DEFAULT_INITIAL_BALANCE = 50_000;

/** Hard cap for `Account.initialBalance` (avoids pathological input). */
export const MAX_INITIAL_BALANCE = 1_000_000_000;
