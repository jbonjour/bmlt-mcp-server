import { WEEKDAY_LABELS } from "../constants.js";
import type { BmltMeeting, BmltFormat, BmltServiceBody } from "../types.js";

/** Format a BMLT time string "HH:MM:SS" to "H:MM AM/PM" */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "Unknown";
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? "00";
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${minute} ${suffix}`;
}

/** Weekday number (1–7) to name */
export function formatWeekday(day: string | number): string {
  return WEEKDAY_LABELS[Number(day)] ?? "Unknown";
}

/** Format a single meeting as a readable markdown block */
export function formatMeeting(
  meeting: BmltMeeting,
  formatMap: Record<string, string> = {}
): string {
  const day = formatWeekday(meeting.weekday_tinyint);
  const time = formatTime(meeting.start_time);
  const location = [
    meeting.location_text,
    meeting.location_street,
    meeting.location_municipality,
    meeting.location_province
  ].filter(Boolean).join(", ");

  const formatLabels = meeting.formats
    ? meeting.formats.split(",").map(k => formatMap[k.trim()] ?? k.trim()).join(", ")
    : "";

  const lines = [
    `**${meeting.meeting_name}**`,
    `📅 ${day} at ${time}`,
    location ? `📍 ${location}` : null,
    meeting.location_info ? `ℹ️  ${meeting.location_info}` : null,
    formatLabels ? `🏷️  ${formatLabels}` : null,
    meeting.virtual_meeting_link ? `🔗 ${meeting.virtual_meeting_link}` : null,
    meeting.phone_meeting_number ? `📞 ${meeting.phone_meeting_number}` : null,
    meeting.comments ? `💬 ${meeting.comments}` : null,
    `🆔 ID: ${meeting.id_bigint}`
  ];

  return lines.filter(Boolean).join("\n");
}

/** Build a format key → name map from a list of BmltFormat objects */
export function buildFormatMap(formats: BmltFormat[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of formats) {
    map[f.key_string] = f.name_string;
  }
  return map;
}

/** Format service body info as a markdown string */
export function formatServiceBody(sb: BmltServiceBody): string {
  const parts = [
    `**${sb.name}** (ID: ${sb.id})`,
    sb.type ? `Type: ${sb.type}` : null,
    sb.description ? sb.description : null,
    sb.url ? `🔗 ${sb.url}` : null,
    sb.helpline ? `📞 ${sb.helpline}` : null,
    sb.parent_id !== "0" ? `Parent ID: ${sb.parent_id}` : null
  ];
  return parts.filter(Boolean).join("\n");
}

/** Truncate a string to a max length with a notice */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n\n[Response truncated at ${limit} characters. Narrow your search to see more detail.]`;
}
