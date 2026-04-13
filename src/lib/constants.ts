export const SET_TYPES = ["warmup", "normal", "failure", "dropset"] as const;

export const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export const SET_TYPE_LABELS: Record<string, string> = {
  warmup: "Warm-up",
  normal: "Working",
  failure: "To Failure",
  dropset: "Drop Set",
};

export const SET_TYPE_SHORT: Record<string, string> = {
  warmup: "W",
  normal: "",
  failure: "F",
  dropset: "D",
};
