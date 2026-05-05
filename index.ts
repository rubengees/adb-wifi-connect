#!/usr/bin/env node

import type { Service } from "@astronautlabs/mdns"
import { Browser } from "@astronautlabs/mdns"
import { execa } from "execa"
import { renderUnicodeCompact } from "uqr"

const pairingName = `ADB_WIFI_${randomString(5)}`
const pairingPassword = randomString(5)

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

      console.log("Device found, but couldn't connect. Scan the QR-Code to pair:")
      console.log()
      console.log(renderUnicodeCompact(`WIFI:T:ADB;S:${pairingName};P:${pairingPassword};;`))
    } catch (e) {
      console.error("ADB connect command failed:", e)
      exit(1)
    }
  })
  .start()

const pairingBrowser = new Browser("_adb-tls-pairing._tcp")
  .on("serviceUp", async (service: Service) => {
    if (service.name !== pairingName) return

    const pairAddress = `${service.addresses[0]}:${service.port}`
    console.log(`Pairing at ${pairAddress}...`)

    try {
      await execa("adb", ["pair", pairAddress, pairingPassword])
      console.log("Paired and connected!")
      exit()
    } catch (e) {
      console.error("ADB pair command failed:", e)
      exit(1)
    }
  })
  .start()

process.on("SIGINT", () => exit())

function randomString(length: number) {
  return Array.from({ length }, () => Math.random().toString(36)[2]).join("")
}

function exit(code: number = 0) {
  connectBrowser.stop()
  pairingBrowser.stop()
  process.exit(code)
}
