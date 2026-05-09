// Default BMLT root server (WSZF network — used by Portland NA, Contra Costa NA, etc.)
export const DEFAULT_ROOT_SERVER = "https://bmlt.wszf.org/main_server";

// Portland NA service body ID on the WSZF root server
export const DEFAULT_SERVICE_BODY_ID = 26;

// Max characters to return in a single tool response before truncating
export const CHARACTER_LIMIT = 50_000;

// BMLT semantic interface base path
export const SEMANTIC_PATH = "/client_interface/json/";

// Weekday label map (BMLT uses 1=Sunday ... 7=Saturday)
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
  7: "Saturday"
};

export const WEEKDAY_BY_NAME: Record<string, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7
};
