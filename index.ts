#!/usr/bin/env node

import { setTimeout } from "node:timers/promises"
import { execa, ExecaError } from "execa"
import { renderUnicodeCompact } from "uqr"

const { stdout: devices } = await execa("adb", ["devices"]).catch(handleAdbError)

if (/^\S+\s+device\s*$/m.test(devices)) {
  console.log("Already connected!")
  process.exit(0)
}

console.log("Waiting for device...")

const device = await waitForService("_adb-tls-connect._tcp")
console.log(`Discovered device ${device.name}. Connecting...`)

const { stdout } = await execa("adb", ["connect", `${device.name}._adb-tls-connect._tcp`]).catch(handleAdbError)

if (/^(connected|already connected) to /im.test(stdout)) {
  console.log("Connected!")
  process.exit(0)
}

const pairingName = `ADB_WIFI_${randomString(8)}`
const pairingPassword = randomString(12)

console.log(
  "Device found, but couldn't connect. Scan the QR-Code in 'Wireless debugging > Pair device with QR code' to pair:",
)
console.log()
console.log(renderUnicodeCompact(`WIFI:T:ADB;S:${pairingName};P:${pairingPassword};;`))

const pairingService = await waitForService("_adb-tls-pairing._tcp", pairingName)
console.log(`Pairing at ${pairingService.target}...`)

await execa("adb", ["pair", pairingService.target, pairingPassword]).catch(handleAdbError)

console.log("Paired and connected!")
process.exit(0)

async function waitForService(serviceType: string, name?: string) {
  while (true) {
    const { stdout } = await execa("adb", ["mdns", "services"]).catch(handleAdbError)

    for (const line of stdout.split(/\r?\n/)) {
      const [serviceName, type, target] = line.split("\t")
      if (!serviceName || type !== serviceType || !target || (name && serviceName !== name)) continue

      return { name: serviceName, target }
    }

    await setTimeout(50)
  }
}

function randomString(length: number) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => alphabet[byte % alphabet.length]).join("")
}

function handleAdbError(error: unknown): never {
  if (error instanceof ExecaError && error.code === "ENOENT") {
    console.error(
      "Could not find the 'adb' executable. Please install Android platform-tools and ensure 'adb' is on your PATH.",
    )
  } else {
    console.error("ADB command failed:", error)
  }

  process.exit(1)
}
