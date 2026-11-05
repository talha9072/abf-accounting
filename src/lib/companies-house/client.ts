import "server-only";

/**
 * Companies House Public Data API client (read-only).
 * Docs: https://developer-specs.company-information.service.gov.uk
 *
 * - HTTP Basic auth: API key as username, empty password.
 * - Limit: 600 requests per 5 minutes per key. We keep our own sliding
 *   window (with a safety margin) and also obey the X-Ratelimit-* headers.
 * - 429 → wait for the window to reset. 5xx / network errors → retried with
 *   exponential backoff. Every request has a timeout.
 */

const BASE_URL = "https://api.company-information.service.gov.uk";
const WINDOW_MS = 5 * 60 * 1000;
const WINDOW_MAX = 580; // stay a little under 600
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 5;

export class CompaniesHouseError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CompaniesHouseError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Rate limiter — shared by every caller in this process               */
/* ------------------------------------------------------------------ */

const sent: number[] = [];
let blockedUntil = 0;
/** Spread requests evenly (~1.9/s) instead of bursting 580 and then waiting minutes. */
const MIN_GAP_MS = Math.ceil(WINDOW_MS / WINDOW_MAX);
let nextSlotAt = 0;

async function acquireSlot() {
  for (;;) {
    const now = Date.now();
    const waitUntil = Math.max(blockedUntil, nextSlotAt);
    if (waitUntil > now) {
      await sleep(waitUntil - now);
      continue;
    }
    while (sent.length && now - sent[0] >= WINDOW_MS) sent.shift();
    if (sent.length < WINDOW_MAX) {
      sent.push(now);
      nextSlotAt = now + MIN_GAP_MS;
      return;
    }
    await sleep(WINDOW_MS - (now - sent[0]) + 50);
  }
}

function readRateHeaders(res: Response) {
  const remain = Number(res.headers.get("x-ratelimit-remain"));
  const reset = Number(res.headers.get("x-ratelimit-reset")); // unix seconds
  if (Number.isFinite(remain) && Number.isFinite(reset) && remain <= 3) {
    blockedUntil = Math.max(blockedUntil, reset * 1000 + 1000);
  }
}

/* ------------------------------------------------------------------ */
/* Core GET                                                            */
/* ------------------------------------------------------------------ */

function authHeader() {
  const key = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) throw new CompaniesHouseError("COMPANIES_HOUSE_API_KEY is not set.");
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

/** GET a JSON resource. Returns null for 404. */
export async function chGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T | null> {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await acquireSlot();
    try {
      const res = await fetch(url, {
        headers: { Authorization: authHeader(), Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      readRateHeaders(res);

      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) {
        throw new CompaniesHouseError("Companies House rejected the API key (check COMPANIES_HOUSE_API_KEY).", res.status);
      }
      if (res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        blockedUntil = Math.max(blockedUntil, Number.isFinite(reset) ? reset * 1000 + 1000 : Date.now() + 60_000);
        lastError = new CompaniesHouseError("Rate limited by Companies House.", 429);
        continue; // does not count against backoff
      }
      if (res.status >= 500) {
        lastError = new CompaniesHouseError(`Companies House error ${res.status}.`, res.status);
      } else {
        throw new CompaniesHouseError(`Companies House request failed (${res.status}).`, res.status);
      }
    } catch (e) {
      if (e instanceof CompaniesHouseError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastError = e;
    }
    await sleep(Math.min(2 ** attempt * 1000, 30_000) + Math.random() * 500);
  }
  throw lastError instanceof Error
    ? new CompaniesHouseError(`Companies House didn’t respond: ${lastError.message}`)
    : new CompaniesHouseError("Companies House didn’t respond.");
}

/* ------------------------------------------------------------------ */
/* Typed endpoints                                                     */
/* ------------------------------------------------------------------ */

export type ChAddress = {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  premises?: string;
  po_box?: string;
  care_of?: string;
};

export type ChSearchCompany = {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_office_address?: ChAddress;
  sic_codes?: string[];
};

type AdvancedSearchResponse = { hits?: number; items?: ChSearchCompany[] };

/** Max page size the advanced search accepts. */
export const SEARCH_PAGE_SIZE = 5000;

/** One page of companies incorporated between two UK dates (inclusive). */
export async function searchIncorporations(from: string, to: string, startIndex: number, size = SEARCH_PAGE_SIZE) {
  const data = await chGet<AdvancedSearchResponse>("/advanced-search/companies", {
    incorporated_from: from,
    incorporated_to: to,
    size: Math.min(Math.max(size, 1), SEARCH_PAGE_SIZE),
    start_index: startIndex,
  });
  return { hits: data?.hits ?? 0, items: data?.items ?? [] };
}

export type ChOfficer = {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
};

type OfficersResponse = { items?: ChOfficer[] };

export async function getOfficers(companyNumber: string) {
  const data = await chGet<OfficersResponse>(`/company/${encodeURIComponent(companyNumber)}/officers`, {
    items_per_page: 35,
  });
  return data?.items ?? [];
}
