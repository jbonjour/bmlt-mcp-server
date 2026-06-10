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
    venueTypes?: number[];     // 1=In-person, 2=Virtual, 3=Hybrid
    meetingName?: string;
    searchString?: string;     // full-text search across all meeting fields
    location?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    startTimeMin?: string;     // "HH:MM"
    startTimeMax?: string;     // "HH:MM"
    pageSize?: number;
    pageNum?: number;
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

  if (options.venueTypes?.length) {
    options.venueTypes.forEach((v, i) => {
      params[`venue_types[${i}]`] = String(v);
    });
  }

  if (options.searchString) {
    params["SearchString"] = options.searchString;
  } else if (options.meetingName) {
    // meeting_name is a tighter name-only match; SearchString covers all fields
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
    params["sort_results_by_distance"] = "1";
  }

  // BMLT expects separate hour and minute integers, not "HH:MM" strings
  if (options.startTimeMin) {
    const [h, m] = options.startTimeMin.split(":");
    params["StartsAfterH"] = parseInt(h, 10);
    params["StartsAfterM"] = parseInt(m, 10);
  }
  if (options.startTimeMax) {
    const [h, m] = options.startTimeMax.split(":");
    params["StartsBeforeH"] = parseInt(h, 10);
    params["StartsBeforeM"] = parseInt(m, 10);
  }

  // Use server-side pagination when requested
  if (options.pageSize) {
    params["page_size"] = options.pageSize;
    params["page_num"] = options.pageNum ?? 1;
  }

  const url = buildUrl(root, params);
  const data = await bmltFetch<BmltMeeting[] | { meetings: BmltMeeting[]; total?: number }>(url);

  if (Array.isArray(data)) {
    return { meetings: data, total: data.length };
  }
  const wrapped = data as { meetings: BmltMeeting[]; total?: number };
  const meetings = wrapped.meetings ?? [];
  // If server returns a total (aggregator mode may include it), use it; else fall back to page count
  const total = wrapped.total ?? meetings.length;
  return { meetings, total };
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
