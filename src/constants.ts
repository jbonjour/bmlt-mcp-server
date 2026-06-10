// Default BMLT root server — override with BMLT_ROOT_SERVER env var
// Global aggregator covers all NA worldwide; Portland NA WSZF as fallback example
export const DEFAULT_ROOT_SERVER =
  process.env.BMLT_ROOT_SERVER ?? "https://aggregator.bmltenabled.org/main_server";

// Default service body ID — override with BMLT_SERVICE_BODY_ID env var (unset = no filter = all bodies)
const _rawServiceBodyId = process.env.BMLT_SERVICE_BODY_ID;
export const DEFAULT_SERVICE_BODY_ID: number | null =
  _rawServiceBodyId ? parseInt(_rawServiceBodyId, 10) : null;

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
