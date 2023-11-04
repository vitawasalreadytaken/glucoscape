import * as R from "ramda"
// import standardDeviation from "just-standard-deviation"

export const MMOL_TO_MGDL = 18.018018018
// const EXPECTED_MEASUREMENT_INTERVAL = 5 * 60 * 1000

export interface Settings {
  nightscoutTitle: string
  nightscoutUrl: string
  displayUnits: "mgdl" | "mmol"
  targetRangeMgdl: [number, number]
  targetRangeUnit: "mgdl" | "mmol"
}

export interface GlucoseRecord {
  date: number
  sgv: number
  trend: number
  direction: string
}

export interface RangePercentages {
  low: number
  onTarget: number
  high: number
  missing: number
}

export interface GlucoseStatistics {
  rangePercentages: RangePercentages
}

export function groupByDay(records: GlucoseRecord[]): Record<string, GlucoseRecord[]> {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return R.groupBy((r) => {
    const d = new Date(r.date)
    return `${weekdays[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
  }, records)
}

export function groupByInterval(records: GlucoseRecord[], interval: number): Record<string, GlucoseRecord[]> {
  return R.groupBy((r) => Math.floor(timeInDayInSeconds(r.date) / interval).toFixed(0), records)
}

function timeInDayInSeconds(date: number): number {
  const d = new Date(date)
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

export function calculateGlucoseStatistics(records: GlucoseRecord[], rangeMgdl: [number, number]): GlucoseStatistics {
  // const sd = standardDeviation(records.map((r) => r.sgv / MMOL_TO_MGDL))
  return { rangePercentages: calculatePercentages(records, rangeMgdl) }
}

function calculatePercentages(records: GlucoseRecord[], rangeMgdl: [number, number]): RangePercentages {
  const missing = calculateMissingDataCount(records)
  const total = records.length + missing
  const low = R.count((r) => r.sgv < rangeMgdl[0], records)
  const high = R.count((r) => r.sgv > rangeMgdl[1], records)
  const onTarget = total - low - high
  const percentage = (x: number): number => (100 * x) / total
  return {
    low: percentage(low),
    onTarget: percentage(onTarget),
    high: percentage(high),
    missing: percentage(missing),
  }
}

function calculateMissingDataCount(records: GlucoseRecord[]): number {
  return 0
  // This calculation doesn't work because we don't know what interval we're operating on.
  // To calculate the number of expected measurements we'd need to know if we're
  // summarising by one day, one hour, or the same hour in each day.

  // const [minDate, maxDate] = R.reduce(([min, max], r) => {
  //     return [Math.min(min, +r.date), Math.max(max, +r.date)]
  // }, [Infinity, -Infinity], records)
  // const span = maxDate - minDate
  // const expectedMeasurements = Math.floor(span / EXPECTED_MEASUREMENT_INTERVAL)
  // return expectedMeasurements - records.length
}
