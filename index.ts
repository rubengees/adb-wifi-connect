#!/usr/bin/env node

import { isIPv4 } from "node:net"
import { DnsSdBrowser } from "dns-sd-browser"
import { execa, ExecaError } from "execa"
import { renderUnicodeCompact } from "uqr"

await using mdns = new DnsSdBrowser()

console.log("Waiting for device...")

for await (const event of mdns.browse("_adb-tls-connect._tcp")) {
  if (event.type !== "serviceUp") continue

  const { name } = event.service
  console.log(`Discovered device ${name}. Connecting...`)

  const { stdout } = await execa("adb", ["connect", `${name}._adb-tls-connect._tcp`]).catch(handleAdbError)

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

  await pair(pairingName, pairingPassword)
}

async function pair(name: string, password: string) {
  for await (const pairingEvent of mdns.browse("_adb-tls-pairing._tcp")) {
    if (pairingEvent.type !== "serviceUp" && pairingEvent.type !== "serviceUpdated") continue

    const { service } = pairingEvent
    if (service.name !== name) continue

    const address = service.addresses.find((a) => isIPv4(a)) ?? service.addresses[0]
    if (!address) continue

    const target = `${address}:${service.port}`
    console.log(`Pairing at ${target}...`)

    await execa("adb", ["pair", target, password]).catch(handleAdbError)

    console.log("Paired and connected!")
    process.exit(0)
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
