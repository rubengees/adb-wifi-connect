#!/usr/bin/env node

import { randomBytes } from "node:crypto"
import { isIPv4 } from "node:net"
import type { Service } from "@astronautlabs/mdns"
import { Browser } from "@astronautlabs/mdns"
import { execa, ExecaError } from "execa"
import { renderUnicodeCompact } from "uqr"

const pairingName = `ADB_WIFI_${randomString(8)}`
const pairingPassword = randomString(12)

console.log("Waiting for device...")

const connectBrowser = new Browser("_adb-tls-connect._tcp")
  .on("serviceUp", async (service: Service) => {
    console.log(`Discovered device ${service.name}. Connecting...`)

    try {
      const mdnsHost = `${service.name}._adb-tls-connect._tcp`
      const { stdout } = await execa("adb", ["connect", mdnsHost])

      if (/^(connected|already connected) to /im.test(stdout)) {
        console.log("Connected!")
        exit()
      }

      console.log(
        "Device found, but couldn't connect. " +
          "Scan the QR-Code in 'Wireless debugging > Pair device with QR code' to pair:",
      )
      console.log()
      console.log(renderUnicodeCompact(`WIFI:T:ADB;S:${pairingName};P:${pairingPassword};;`))
    } catch (e) {
      handleAdbError(e)
    }
  })
  .start()

const pairingBrowser = new Browser("_adb-tls-pairing._tcp")
  .on("serviceUp", async (service: Service) => {
    if (service.name !== pairingName) return

    const address = pickAddress(service.addresses)
    if (!address) {
      console.error("Pairing service announced but no usable address was found.")
      exit(1)
    }

    const pairAddress = `${address}:${service.port}`
    console.log(`Pairing at ${pairAddress}...`)

    try {
      await execa("adb", ["pair", pairAddress, pairingPassword])
      console.log("Paired and connected!")
      exit()
    } catch (e) {
      handleAdbError(e)
    }
  })
  .start()

process.on("SIGINT", () => exit())
process.on("SIGTERM", () => exit())

function randomString(length: number) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
  const bytes = randomBytes(length)

  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("")
}

function pickAddress(addresses: readonly string[] | undefined): string | undefined {
  if (!addresses || addresses.length === 0) return undefined

  return addresses.find((address) => isIPv4(address)) ?? addresses[0]
}

function handleAdbError(error: unknown) {
  if (error instanceof ExecaError && error.code === "ENOENT") {
    console.error(
      "Could not find the 'adb' executable. Please install Android platform-tools and ensure 'adb' is on your PATH.",
    )
  } else {
    console.error(`ADB command failed:`, error)
  }

  exit(1)
}

function exit(code: number = 0) {
  try {
    connectBrowser.stop()
    pairingBrowser.stop()
  } catch (e) {
    console.warn("Failed to cleanly stop mDNS browsers:", e)
  }

  process.exit(code)
}
