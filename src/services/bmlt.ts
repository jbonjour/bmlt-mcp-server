import { DEFAULT_ROOT_SERVER, SEMANTIC_PATH } from "../constants.js";
import type {
  BmltMeeting,
  BmltFormat,
  BmltServiceBody,
  BmltServerInfo
} from "../types.js";

/**
 * Build a BMLT semantic interface URL.
 */
function buildUrl(
  rootServer: string,
  params: Record<string, string | string[] | number | number[] | undefined>
): string {
  const base = rootServer.replace(/\/$/, "") + SEMANTIC_PATH;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      value.forEach((v, i) => query.append(`${key}[${i}]`, String(v)));
    } else {
      query.set(key, String(value));
    }
  }

  return `${base}?${query.toString()}`;
}

/**
 * Fetch JSON from the BMLT semantic interface.
 */
async function bmltFetch<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach BMLT server: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`BMLT request failed: HTTP ${res.status} for ${url}`);
  }

  const text = await res.text();

  // BMLT sometimes wraps JSON in a callback for JSONP — strip it
  const stripped = text.replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\(/, "").replace(/\);?\s*$/, "");

  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new Error(`BMLT returned non-JSON response from ${url}`);
  }
}

// ─── Public API functions ────────────────────────────────────────────────────

export async function searchMeetings(
  options: {
    rootServer?: string;
    serviceBodyIds?: number[];
    weekdays?: number[];
    formats?: string[];
    meetingName?: string;
    location?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    startTimeMin?: string;
    startTimeMax?: string;
    maxResults?: number;
    page?: number;
  }
): Promise<{ meetings: BmltMeeting[]; total: number }> {
  const root = options.rootServer ?? DEFAULT_ROOT_SERVER;

  const params: Record<string, string | string[] | number | number[] | undefined> = {
    switcher: "GetSearchResults",
    get_used_formats: "1",
    lang_enum: "en"
  };

  if (options.serviceBodyIds?.length) {
    options.serviceBodyIds.forEach((id, i) => {
      params[`services[${i}]`] = String(id);
    });
  }

  if (options.weekdays?.length) {
    options.weekdays.forEach((day, i) => {
      params[`weekdays[${i}]`] = String(day);
    });
  }

  if (options.formats?.length) {
    options.formats.forEach((f, i) => {
      params[`formats[${i}]`] = f;
    });
  }

  if (options.meetingName) {
    params["meeting_name"] = options.meetingName;
  }

  if (options.location) {
    params["meeting_key"] = "location_municipality";
    params["meeting_key_value"] = options.location;
  }

  if (options.lat !== undefined && options.lng !== undefined) {
    params["lat_val"] = options.lat;
    params["long_val"] = options.lng;
    params["geo_width_km"] = milesToKm(options.radiusMiles ?? 10);
  }

  if (options.startTimeMin) params["StartsAfter"] = options.startTimeMin;
  if (options.startTimeMax) params["StartsBefore"] = options.startTimeMax;

  const url = buildUrl(root, params);
  const data = await bmltFetch<BmltMeeting[] | { meetings: BmltMeeting[] }>(url);
  const all: BmltMeeting[] = Array.isArray(data) ? data : (data as { meetings: BmltMeeting[] }).meetings ?? [];

  const total = all.length;
  if (options.maxResults) {
    const pageSize = options.maxResults;
    const pageNum = options.page ?? 1;
    const start = (pageNum - 1) * pageSize;
    return { meetings: all.slice(start, start + pageSize), total };
  }

  return { meetings: all, total };
}

export async function getMeetingById(
  meetingId: number,
  options: { rootServer?: string; serviceBodyIds?: number[] } = {}
): Promise<BmltMeeting | null> {
  const root = options.rootServer ?? DEFAULT_ROOT_SERVER;

  const params: Record<string, string | string[] | number | number[] | undefined> = {
    switcher: "GetSearchResults",
    lang_enum: "en",
    "meeting_ids[0]": String(meetingId)
  };

  if (options.serviceBodyIds?.length) {
    options.serviceBodyIds.forEach((id, i) => {
      params[`services[${i}]`] = String(id);
    });
  }

  const url = buildUrl(root, params);
  const data = await bmltFetch<BmltMeeting[] | { meetings: BmltMeeting[] }>(url);
  const meetings: BmltMeeting[] = Array.isArray(data) ? data : (data as { meetings: BmltMeeting[] }).meetings ?? [];
  return meetings.find(m => String(m.id_bigint) === String(meetingId)) ?? null;
}

export async function getFormats(rootServer?: string): Promise<BmltFormat[]> {
  const root = rootServer ?? DEFAULT_ROOT_SERVER;
  const url = buildUrl(root, { switcher: "GetFormats", lang_enum: "en" });
  const data = await bmltFetch<{ formats: BmltFormat[] } | BmltFormat[]>(url);
  return Array.isArray(data) ? data : (data as { formats: BmltFormat[] }).formats ?? [];
}

export async function getServiceBodies(rootServer?: string): Promise<BmltServiceBody[]> {
  const root = rootServer ?? DEFAULT_ROOT_SERVER;
  const url = buildUrl(root, { switcher: "GetServiceBodies" });
  const data = await bmltFetch<{ service_bodies: BmltServiceBody[] } | BmltServiceBody[]>(url);
  return Array.isArray(data) ? data : (data as { service_bodies: BmltServiceBody[] }).service_bodies ?? [];
}

export async function getServerInfo(rootServer?: string): Promise<BmltServerInfo> {
  const root = rootServer ?? DEFAULT_ROOT_SERVER;
  const url = buildUrl(root, { switcher: "GetServerInfo" });
  const data = await bmltFetch<BmltServerInfo[] | BmltServerInfo>(url);
  return Array.isArray(data) ? data[0] : data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function milesToKm(miles: number): number {
  return Math.round(miles * 1.60934 * 10) / 10;
}
