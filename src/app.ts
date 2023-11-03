import { type GlucoseRecord, type Settings, MMOL_TO_MGDL } from "./data"

import { renderHeatmap } from "./heatmap"

import "./app.scss"

const DAYS = 14

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

  if (!window.location.hash.startsWith("#session=")) {
    loginView(root)
    return
  }
  let session
  try {
    session = JSON.parse(decodeURIComponent(window.location.hash.substring(9))) as Session
  } catch (e) {
    console.error("Could not parse session from URL", e)
    loginView(root)
    return
  }
  await heatmapView(root, session)
}

function loginView(root: HTMLElement): void {
  root.innerHTML = `
    <form>
      <h1>
        <a target="_blank" href="https://github.com/vitawasalreadytaken/glucoscape">Glucoscape</a>
        <img src="logo.png">
      </h1>
      <p>
        <label for="nightscoutUrl">Your Nightscout address</label>
        <input type="text" id="nightscoutUrl" name="nightscoutUrl" placeholder="https://nightscout.example.com">
      </p>
      <p>
        <label for="token">Authentication token</label>
        <input type="text" id="token" name="token">
      </p>
      <p>
        <button type="submit">Connect to Nightscout</button>
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
    void main()
  })
}

async function heatmapView(root: HTMLElement, session: Session): Promise<void> {
  root.innerHTML = `Loading settings from ${session.nightscoutUrl}...`
  const settings = await getSettings(session.nightscoutUrl, session.token)
  root.innerHTML += "done<br>"

  root.innerText += `Loading glucose data from ${session.nightscoutUrl}...`
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + 1)
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - DAYS)
  const glucoseData = await getGlucoseData(session.nightscoutUrl, session.token, fromDate, toDate)
  root.innerHTML += "done<br>"

  root.innerHTML = renderHeatmap(settings, glucoseData)
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
      `&find[dateString][$lte]=${isoDateFormat(toDate)}`
  )
  return await response.json()
}

async function getSettings(nightscoutUrl: string, token: string): Promise<Settings> {
  // Download NS settings and status and cherry-pick the bits we need.
  console.log(`Fetching settings...`)
  const response = await fetch(`${nightscoutUrl}/api/v1/status.json?token=${token}`)
  const status = await response.json()
  const multiplier = status.settings.units === "mmol" ? MMOL_TO_MGDL : 1
  return {
    nightscoutTitle: status.settings.customTitle,
    nightscoutUrl,
    displayUnits: status.settings.units,
    targetRangeMgdl: [status.settings.thresholds.bgTargetBottom, status.settings.thresholds.bgTargetTop]
  }
}

function isoDateFormat(d: Date): string {
  return d.toISOString().substring(0, 10)
}

void main()
