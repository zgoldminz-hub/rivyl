export interface SkinTone { id: string; color: string; label: string; }
export interface HairStyle { id: string; label: string; }
export interface HairColor { id: string; color: string; label: string; }
export interface HatOption { id: string; label: string; primary: string; secondary: string; text: string; abbrev: string; }
export interface JerseyColor { id: string; color: string; label: string; }
export interface ExpressionOption { id: string; label: string; }
export interface AvatarConfig {
  skinTone: string; hairStyle: string; hairColor: string;
  hat: string; jersey: string; expression: string;
}

export const SKIN_TONES: SkinTone[] = [
  { id: "s1", color: "#FDDBB4", label: "Light" },
  { id: "s2", color: "#F1C27D", label: "Medium Light" },
  { id: "s3", color: "#E0A060", label: "Medium" },
  { id: "s4", color: "#C68642", label: "Tan" },
  { id: "s5", color: "#8D5524", label: "Medium Dark" },
  { id: "s6", color: "#4A2912", label: "Dark" },
];

export const HAIR_STYLES: HairStyle[] = [
  { id: "short",   label: "Short" },
  { id: "medium",  label: "Medium" },
  { id: "long",    label: "Long" },
  { id: "curly",   label: "Curly" },
  { id: "bun",     label: "Bun" },
  { id: "mohawk",  label: "Mohawk" },
  { id: "low",     label: "Low Cut" },
  { id: "bald",    label: "Bald" },
];

export const HAIR_COLORS: HairColor[] = [
  { id: "hc_black",  color: "#1a1008", label: "Black" },
  { id: "hc_brown",  color: "#6B3A2A", label: "Brown" },
  { id: "hc_blonde", color: "#D4AA70", label: "Blonde" },
  { id: "hc_red",    color: "#8B2500", label: "Red" },
  { id: "hc_gray",   color: "#808080", label: "Gray" },
  { id: "hc_white",  color: "#DCDCDC", label: "White" },
  { id: "hc_blue",   color: "#1E40AF", label: "Blue" },
  { id: "hc_green",  color: "#15803D", label: "Green" },
  { id: "hc_purple", color: "#6D28D9", label: "Purple" },
  { id: "hc_pink",   color: "#DB2777", label: "Pink" },
];

export const HAT_OPTIONS: HatOption[] = [
  { id: "none",        label: "No Hat",     primary: "none", secondary: "none", text: "none", abbrev: "" },
  { id: "hat_buf",     label: "Bills",       primary: "#00338D", secondary: "#C60C30", text: "#FFFFFF", abbrev: "BUF" },
  { id: "hat_mia",     label: "Dolphins",    primary: "#008E97", secondary: "#FC4C02", text: "#FFFFFF", abbrev: "MIA" },
  { id: "hat_ne",      label: "Patriots",    primary: "#002244", secondary: "#C60C30", text: "#FFFFFF", abbrev: "NE" },
  { id: "hat_nyj",     label: "Jets",        primary: "#125740", secondary: "#FFFFFF", text: "#FFFFFF", abbrev: "NYJ" },
  { id: "hat_bal",     label: "Ravens",      primary: "#241773", secondary: "#C2A634", text: "#C2A634", abbrev: "BAL" },
  { id: "hat_cin",     label: "Bengals",     primary: "#FB4F14", secondary: "#000000", text: "#FFFFFF", abbrev: "CIN" },
  { id: "hat_cle",     label: "Browns",      primary: "#311D00", secondary: "#FF3C00", text: "#FF3C00", abbrev: "CLE" },
  { id: "hat_pit",     label: "Steelers",    primary: "#101820", secondary: "#FFB612", text: "#FFB612", abbrev: "PIT" },
  { id: "hat_hou",     label: "Texans",      primary: "#03202F", secondary: "#A71930", text: "#FFFFFF", abbrev: "HOU" },
  { id: "hat_ind",     label: "Colts",       primary: "#002C5F", secondary: "#A2AAAD", text: "#FFFFFF", abbrev: "IND" },
  { id: "hat_jax",     label: "Jaguars",     primary: "#006778", secondary: "#D7A22A", text: "#FFFFFF", abbrev: "JAX" },
  { id: "hat_ten",     label: "Titans",      primary: "#002A5C", secondary: "#4B92DB", text: "#4B92DB", abbrev: "TEN" },
  { id: "hat_den",     label: "Broncos",     primary: "#FB4F14", secondary: "#002244", text: "#FFFFFF", abbrev: "DEN" },
  { id: "hat_kc",      label: "Chiefs",      primary: "#E31837", secondary: "#FFB81C", text: "#FFFFFF", abbrev: "KC" },
  { id: "hat_lv",      label: "Raiders",     primary: "#000000", secondary: "#A5ACAF", text: "#A5ACAF", abbrev: "LV" },
  { id: "hat_lac",     label: "Chargers",    primary: "#0080C6", secondary: "#FFC20E", text: "#FFFFFF", abbrev: "LAC" },
  { id: "hat_dal",     label: "Cowboys",     primary: "#003594", secondary: "#C0C0C0", text: "#FFFFFF", abbrev: "DAL" },
  { id: "hat_nyg",     label: "Giants",      primary: "#0B2265", secondary: "#A71930", text: "#FFFFFF", abbrev: "NYG" },
  { id: "hat_phi",     label: "Eagles",      primary: "#004C54", secondary: "#A5ACAF", text: "#FFFFFF", abbrev: "PHI" },
  { id: "hat_was",     label: "Commanders",  primary: "#5A1414", secondary: "#FFB612", text: "#FFB612", abbrev: "WAS" },
  { id: "hat_chi",     label: "Bears",       primary: "#0B162A", secondary: "#C83803", text: "#C83803", abbrev: "CHI" },
  { id: "hat_det",     label: "Lions",       primary: "#0076B6", secondary: "#B0B7BC", text: "#FFFFFF", abbrev: "DET" },
  { id: "hat_gb",      label: "Packers",     primary: "#203731", secondary: "#FFB612", text: "#FFB612", abbrev: "GB" },
  { id: "hat_min",     label: "Vikings",     primary: "#4F2683", secondary: "#FFC62F", text: "#FFC62F", abbrev: "MIN" },
  { id: "hat_atl",     label: "Falcons",     primary: "#A71930", secondary: "#000000", text: "#FFFFFF", abbrev: "ATL" },
  { id: "hat_car",     label: "Panthers",    primary: "#0085CA", secondary: "#101820", text: "#FFFFFF", abbrev: "CAR" },
  { id: "hat_no",      label: "Saints",      primary: "#101820", secondary: "#D3BC8D", text: "#D3BC8D", abbrev: "NO" },
  { id: "hat_tb",      label: "Buccaneers",  primary: "#D50A0A", secondary: "#FF7900", text: "#FFFFFF", abbrev: "TB" },
  { id: "hat_ari",     label: "Cardinals",   primary: "#97233F", secondary: "#FFB612", text: "#FFFFFF", abbrev: "ARI" },
  { id: "hat_lar",     label: "Rams",        primary: "#003594", secondary: "#FFA300", text: "#FFA300", abbrev: "LAR" },
  { id: "hat_sf",      label: "49ers",       primary: "#AA0000", secondary: "#B3995D", text: "#B3995D", abbrev: "SF" },
  { id: "hat_sea",     label: "Seahawks",    primary: "#002244", secondary: "#69BE28", text: "#69BE28", abbrev: "SEA" },
  { id: "hat_champ",   label: "Champion",    primary: "#92400E", secondary: "#FCD34D", text: "#FCD34D", abbrev: "CHAMP" },
  { id: "hat_goat",    label: "G.O.A.T.",    primary: "#111111", secondary: "#FFD700", text: "#FFD700", abbrev: "GOAT" },
  { id: "hat_commish", label: "Commish",     primary: "#1e3a8a", secondary: "#93c5fd", text: "#FFFFFF", abbrev: "COMM" },
  { id: "hat_rivyl",   label: "Rivyl",       primary: "#ef4444", secondary: "#4f7cff", text: "#FFFFFF", abbrev: "RIVYL" },
  { id: "hat_playoff", label: "Playoffs",    primary: "#5b21b6", secondary: "#c4b5fd", text: "#FFFFFF", abbrev: "PLOFF" },
  { id: "hat_ff",      label: "Fantasy",     primary: "#065f46", secondary: "#6ee7b7", text: "#FFFFFF", abbrev: "FF" },
];

export const JERSEY_COLORS: JerseyColor[] = [
  { id: "j_blue",   color: "#1e40af", label: "Blue" },
  { id: "j_red",    color: "#991b1b", label: "Red" },
  { id: "j_green",  color: "#166534", label: "Green" },
  { id: "j_purple", color: "#5b21b6", label: "Purple" },
  { id: "j_black",  color: "#111111", label: "Black" },
  { id: "j_white",  color: "#d1d5db", label: "White" },
  { id: "j_orange", color: "#c2410c", label: "Orange" },
  { id: "j_yellow", color: "#a16207", label: "Gold" },
  { id: "j_gray",   color: "#374151", label: "Gray" },
  { id: "j_teal",   color: "#0f766e", label: "Teal" },
];

export const EXPRESSIONS: ExpressionOption[] = [
  { id: "happy",      label: "Happy" },
  { id: "very_happy", label: "Hyped" },
  { id: "cool",       label: "Cool" },
  { id: "fierce",     label: "Fierce" },
  { id: "neutral",    label: "Neutral" },
  { id: "smug",       label: "Smug" },
];

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone: "s1",
  hairStyle: "short",
  hairColor: "hc_brown",
  hat: "none",
  jersey: "j_blue",
  expression: "happy",
};
