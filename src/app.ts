import { type GlucoseRecord, type Settings, MMOL_TO_MGDL } from "./data"
import { DAYS_TO_LOAD, TIMEOUT_STATUS, TIMEOUT_CGM_DATA } from "./settings"

import { renderHeatmap } from "./heatmap"

import "./app.scss"

interface Session {
  nightscoutUrl: string
  token: string
}

async function main(): Promise<void> {
  const root = document.getElementById("app")
  if (root == null) {
    console.error("Could not find root element (#app)")
    return
  }

  // Check if we have a session stored in the URL.
  if (!window.location.hash.startsWith("#session=")) {
    loginView(root)
    return
  }
  // Check that we can parse it.
  let session
  try {
    session = JSON.parse(decodeURIComponent(window.location.hash.substring(9))) as Session
  } catch (e) {
    console.error("Could not parse session from URL", e)
    loginView(root)
    return
  }
  // Check that the session is valid and we can connect to Nightscout.
  const connectionTestResult = await testConnection(session.nightscoutUrl, session.token)
  if (connectionTestResult !== null) {
    alert(connectionTestResult)
    window.location.hash = ""
    loginView(root, session)
    return
  }

  await heatmapView(root, session)
}

function loginView(root: HTMLElement, prefilledSession: Session | null = null): void {
  root.innerHTML = `
    <form>
      <h1>
        <a target="_blank" href="https://github.com/vitawasalreadytaken/glucoscape">Glucoscape</a>
        <img src="logo.png">
      </h1>
      <p>
        <label for="nightscoutUrl">Your Nightscout address</label>
        <input type="text" id="nightscoutUrl" name="nightscoutUrl"
          placeholder="https://nightscout.example.com" autofocus
          value="${prefilledSession?.nightscoutUrl || ""}">
        <small>
          Note:
          <a target="_blank" href="https://nightscout.github.io/nightscout/setup_variables/#cors-cors">CORS must be enabled</a>
          on your Nightscout server.
        </small>
      </p>
      <p>
        <label for="token">Authentication token</label>
        <input type="text" id="token" name="token" value="${prefilledSession?.token || ""}">
      </p>
      <p>
        <button type="submit" id="submitButton">Connect to Nightscout</button>
      </p>
    </form>
  `
  root.getElementsByTagName("form")[0].addEventListener("submit", (event) => {
    event.preventDefault()
    const nightscoutUrl = (document.getElementById("nightscoutUrl") as HTMLInputElement).value
    const token = (document.getElementById("token") as HTMLInputElement).value
    if (nightscoutUrl === "" || token === "") {
      alert("Please enter your Nightscout address and authentication token")
      return
    }
    const session = { nightscoutUrl, token }
    window.location.hash = `#session=${encodeURIComponent(JSON.stringify(session))}`
    const submitButton = document.getElementById("submitButton") as HTMLButtonElement
    submitButton.disabled = true
    submitButton.innerText = "Connecting to Nightscout..."
    void main()
  })
}

async function heatmapView(root: HTMLElement, session: Session): Promise<void> {
  let settings: Settings
  let glucoseData: GlucoseRecord[]

  try {
    // Settings
    root.innerHTML = `Loading settings from ${session.nightscoutUrl}...`
    settings = await getSettings(session.nightscoutUrl, session.token)
    root.innerHTML += "done<br>"
    // Glucose data
    root.innerText += `Loading glucose data from ${session.nightscoutUrl}...`
    const toDate = new Date()
    toDate.setDate(toDate.getDate() + 1)
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - DAYS_TO_LOAD)
    glucoseData = await getGlucoseData(session.nightscoutUrl, session.token, fromDate, toDate)
    root.innerHTML += "done<br>"
  }
  catch (e) {
    console.error(e)
    root.innerHTML += `<br><strong style="color: hsl(359, 47%, 51%)">Error loading data from Nightscout: ${e}</strong><br>`
    return
  }
  // Render
  root.innerHTML = renderHeatmap(settings, glucoseData)
}

async function testConnection(
  nightscoutUrl: string,
  token: string,
): Promise<null | string> {
  // Check that we can connect to Nightscout.
  console.log(`Making a test request to ${nightscoutUrl}`)
  let response
  try {
    response = await fetch(`${nightscoutUrl}/api/v1/status.json?token=${token}`, { signal: AbortSignal.timeout(TIMEOUT_STATUS) })
  }
  catch (e) {
    // Most likely a timeout or a CORS error.
    // Oddly, it also times out when the token doesn't have the right roles.
    console.error(e)
    return `Cannot connect to ${nightscoutUrl}.
    Is the address correct?
    Is CORS enabled on your Nightscout server?
    Does the authentication token have the "readable" role?`
  }
  if (response.status === 401) {
    return `Authentication failed. Is the authentication token correct?`
  }
  if (!response.ok) {
    return `We cannot load data from ${nightscoutUrl} for unknown reasons :( Error code: ${response.status}`
  }
  return null
}

async function getGlucoseData(
  nightscoutUrl: string,
  token: string,
  fromDate: Date,
  toDate: Date
): Promise<GlucoseRecord[]> {
  // Download glucose data from NS.
  console.log(`Fetching glucose data from ${isoDateFormat(fromDate)} to ${isoDateFormat(toDate)}`)
  const response = await fetch(
    `${nightscoutUrl}/api/v1/entries/sgv.json` +
    `?token=${token}&count=0` +
    `&find[dateString][$gte]=${isoDateFormat(fromDate)}` +
    `&find[dateString][$lte]=${isoDateFormat(toDate)}`, { signal: AbortSignal.timeout(TIMEOUT_CGM_DATA) }
  )
  return await response.json()
}

async function getSettings(nightscoutUrl: string, token: string): Promise<Settings> {
  // Download NS settings and status and cherry-pick the bits we need.
  console.log(`Fetching settings...`)
  const response = await fetch(`${nightscoutUrl}/api/v1/status.json?token=${token}`, { signal: AbortSignal.timeout(TIMEOUT_STATUS) })
  const status = await response.json()
  // Convert mmol/l to mg/dl if necessary. It's not clear when Nightscout returns the target range in mmol/l and when in mg/dl.
  // See the discussion in https://github.com/vitawasalreadytaken/glucoscape/pull/3
  // We guess the units from the target range values: CGMs typically can't measure values over 30 mmol/l,
  // and at the same time it makes no sense to set the target range top below 30 mg/dl (1.6 mmol/l).
  const targetRangeConversionToMgdl = status.settings.thresholds.bgTargetTop >= 30 ? 1 : MMOL_TO_MGDL
  return {
    nightscoutTitle: status.settings.customTitle,
    nightscoutUrl,
    displayUnits: status.settings.units,
    targetRangeMgdl: [status.settings.thresholds.bgTargetBottom, status.settings.thresholds.bgTargetTop].map(
      (x: number) => x * targetRangeConversionToMgdl
    ) as [number, number],
  }
}

function isoDateFormat(d: Date): string {
  return d.toISOString().substring(0, 10)
}

void main()
