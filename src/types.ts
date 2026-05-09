// BMLT API response types

export interface BmltMeeting {
  id_bigint: string;
  worldid_mixed: string;
  shared_group_id_bigint: string;
  service_body_bigint: string;
  weekday_tinyint: string; // 1=Sunday, 2=Monday, ..., 7=Saturday
  start_time: string;      // "HH:MM:SS"
  duration_time: string;   // "HH:MM:SS"
  time_zone: string;
  formats: string;         // comma-separated format keys, e.g. "O,VM"
  lang_enum: string;
  longitude: string;
  latitude: string;
  meeting_name: string;
  location_text: string;
  location_info: string;
  location_street: string;
  location_city_subsection: string;
  location_neighborhood: string;
  location_municipality: string;
  location_sub_province: string;
  location_province: string;
  location_postal_code_1: string;
  location_country: string;
  comments: string;
  train_lines: string;
  bus_lines: string;
  phone_meeting_number: string;
  virtual_meeting_link: string;
  virtual_meeting_additional_info: string;
  format_shared_id_list: string;
  [key: string]: string;
}

export interface BmltFormat {
  shared_id_bigint: string;
  key_string: string;
  name_string: string;
  description_string: string;
  lang: string;
  format_type_enum: string;
  worldid_mixed: string;
}

export interface BmltServiceBody {
  id: string;
  parent_id: string;
  name: string;
  description: string;
  type: string;
  url: string;
  helpline: string;
  world_id: string;
}

export interface BmltServerInfo {
  centerLongitude: string;
  centerLatitude: string;
  centerZoom: string;
  defaultDuration: string;
  regionBias: string;
  version: string;
  versionInt: string;
  [key: string]: unknown;
}

export interface SearchMeetingsParams {
  root_server_url?: string;
  service_body_ids?: number[];
  weekdays?: number[];       // 1=Sunday ... 7=Saturday
  formats?: string[];        // format key strings e.g. ["O", "VM"]
  meeting_name?: string;
  location?: string;         // city/neighborhood/municipality text search
  lat?: number;
  lng?: number;
  radius_miles?: number;
  start_time_min?: string;   // "HH:MM"
  start_time_max?: string;   // "HH:MM"
}

export const WEEKDAY_NAMES: Record<string, string> = {
  "1": "Sunday",
  "2": "Monday",
  "3": "Tuesday",
  "4": "Wednesday",
  "5": "Thursday",
  "6": "Friday",
  "7": "Saturday"
};
