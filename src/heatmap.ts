import {
  type GlucoseRecord,
  type GlucoseStatistics,
  type Settings,
  groupByDay,
  groupByInterval,
  calculateGlucoseStatistics,
  MMOL_TO_MGDL,
} from "./data"

const RESOLUTION_SECONDS = 3600 // one hour

const COLOR_LOW = "hsl(359, 47%, 51%)"
const COLOR_ON_TARGET = "hsl(98, 32%, 45%)"
const COLOR_HIGH = "hsl(42, 100%, 40%)"
const COLOR_MISSING = "#999"

export function renderHeatmap(settings: Settings, glucoseData: GlucoseRecord[]): string {
  const byDay = groupByDay(glucoseData)
  const rows = Object.entries(byDay).map(([day, records]) => renderRow(settings, day, records))
  return renderHeader(settings) + renderIntervalSummaryRow(settings, glucoseData) + rows.join("\n")
}

function renderHeader(settings: Settings): string {
  let targetRange = settings.targetRangeMgdl
  if (settings.displayUnits === "mmol") {
    targetRange = targetRange.map((x) => x / MMOL_TO_MGDL) as [number, number]
  }
  const units = settings.displayUnits === "mmol" ? "mmol/l" : "mg/dl"
  return `
    <header>
      <div class="spacer"></div>
      <a target="_blank" href="${settings.nightscoutUrl}">${settings.nightscoutTitle}</a>
      ∝
      <a target="_blank" href="https://github.com/vitawasalreadytaken/glucoscape">Glucoscape</a>
      <span class="target">
        // target ${targetRange[0]}&mdash;${targetRange[1]} ${units}
      </span>
    </header>
  `
}

function renderIntervalSummaryRow(settings: Settings, records: GlucoseRecord[]): string {
  const byInterval = groupByInterval(records, RESOLUTION_SECONDS) // Group by interval across all days
  const aggregates = []
  for (let i = 0; i < (24 * 3600) / RESOLUTION_SECONDS; i++) {
    const recordsInInterval = byInterval[String(i)]
    aggregates.push(renderSummary(settings, recordsInInterval, "interval"))
  }
  const total = renderSummary(settings, records, "total")
  return `
    <div class="row">
      <h2><!-- blank box --></h2>
      ${total}
      ${aggregates.join("")}
    </div>
  `
}

function renderRow(settings: Settings, day: string, records: GlucoseRecord[]): string {
  const summary = renderSummary(settings, records, "day")
  const aggregates = renderAggregates(settings, records)
  return `
    <div class="row">
      <h2>${day}</h2>
      ${summary}
      ${aggregates.join("")}
    </div>
  `
}

function renderSummary(settings: Settings, records: GlucoseRecord[], className: string): string {
  const stats = calculateGlucoseStatistics(records, settings.targetRangeMgdl)
  const title = generateTitle(stats)
  const background = generateGradient(stats)
  return `
    <div class="summary ${className}" style="background: ${background}" title="${title}">
      ${stats.rangePercentages.onTarget.toFixed(0)}%
    </div>
    `
}

function renderAggregates(settings: Settings, records: GlucoseRecord[]): string[] {
  const byInterval = groupByInterval(records, RESOLUTION_SECONDS)
  const aggregates = []
  for (let i = 0; i < (24 * 3600) / RESOLUTION_SECONDS; i++) {
    const recordsInInterval = byInterval[String(i)]
    let title = ""
    let background = COLOR_MISSING
    if (recordsInInterval != null) {
      const stats = calculateGlucoseStatistics(recordsInInterval, settings.targetRangeMgdl)
      title = generateTitle(stats)
      background = generateGradient(stats)
    }
    aggregates.push(`
			<div class="aggregate" style="background: ${background}" title="${title}">
				<h3>${formatTime(i)}</h3>
			</div>
		`)
  }
  return aggregates
}

function generateTitle(stats: GlucoseStatistics): string {
  return [
    `Low ${Math.round(stats.rangePercentages.low)}%`,
    `on target ${Math.round(stats.rangePercentages.onTarget)}%`,
    `high ${Math.round(stats.rangePercentages.high)}%`,
  ].join(" / ")
}

function generateGradient(stats: GlucoseStatistics): string {
  const onTargetEnd = stats.rangePercentages.low + stats.rangePercentages.onTarget
  const highEnd = onTargetEnd + stats.rangePercentages.high
  const color = [
    `${COLOR_LOW} 0%, ${COLOR_LOW} ${stats.rangePercentages.low}%`,
    `${COLOR_ON_TARGET} ${stats.rangePercentages.low}%, ${COLOR_ON_TARGET} ${onTargetEnd}%`,
    `${COLOR_HIGH} ${onTargetEnd}%, ${COLOR_HIGH} ${highEnd}%`,
    `${COLOR_MISSING} ${highEnd}%, ${COLOR_MISSING} 100%`,
  ].join(", ")
  return `linear-gradient(to top, ${color})`
}

function formatTime(hour: number): string {
  // const suffix = hour < 12 ? 'am' : 'pm'
  // hour %= 12
  // if (hour === 0) {
  // 	hour = 12
  // }
  // return `${hour}${suffix}`
  return String(hour)
}

// https://gist.github.com/mlocati/7210513
// function percentageToColor(percentage: number, maxHue = 120, minHue = 0): string {
// 	const hue = percentage * (maxHue - minHue) + minHue;
// 	return `hsl(${hue}, 100%, 50%)`;
// }
