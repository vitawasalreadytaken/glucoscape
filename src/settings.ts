// API request timeouts
export const TIMEOUT_STATUS = 10000
export const TIMEOUT_CGM_DATA = 30000

// How many days of CGM data to load
export const DAYS_TO_LOAD = 14

// Visualization preferences
export const RESOLUTION_SECONDS = 3600 // one hour; beware that the heatmap doesn't quite work for values other than 1 hour
export const COLOR_LOW = "hsl(359, 47%, 51%)"
export const COLOR_ON_TARGET = "hsl(98, 32%, 45%)"
export const COLOR_HIGH = "hsl(42, 100%, 40%)"
export const COLOR_MISSING = "#999"
