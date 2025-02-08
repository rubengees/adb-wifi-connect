#!/usr/bin/env node

import { Browser, Service } from "@astronautlabs/mdns"
import { execa } from "execa"
import QRCode from "qrcode"

const name = `ADB_WIFI_${randomString(5)}`
const password = randomString(5)

let discoveredDevice = ""

try {
  await execa("adb", ["start-server"])
} catch (e) {
  console.error("Failed to start adb server:", e)
  process.exit(-1)
}

console.log("Waiting for device...")

const connectBrowser = new Browser("_adb-tls-connect._tcp")
  .on("serviceUp", async (service: Service) => {
    const device = serviceToDevice(service)
    discoveredDevice = device

    console.log(`Discovered device ${device}. Connecting...`)

    try {
      const result = await execa("adb", ["connect", device])

      if (result.stdout.includes("connected to")) {
        console.log("Connected!")
        exit(0)
      } else if (result.stdout.includes("failed to connect")) {
        console.log("Device found, but couldn't connect. Scan the QR-Code to pair:")
        console.log()
        console.log(await QRCode.toString(generateWifiConfig(name, password), { type: "terminal", small: true }))
      } else {
        console.error(`Failed to connect to device ${device}:`, result.stdout)
      }
    } catch (e) {
      console.error(`ADB connect command failed:`, e)
    }
  })
  .on("serviceDown", (service: Service) => {
    const device = serviceToDevice(service)

    if (discoveredDevice === device) {
      discoveredDevice = ""
    }
  })
  .start()

const pairingBrowser = new Browser("_adb-tls-pairing._tcp")
  .on("serviceUp", async (service: Service) => {
    const device = serviceToDevice(service)

    console.log(`Pairing with device ${device}...`)

    try {
      await execa("adb", ["pair", device, password])
    } catch (e) {
      console.error("ADB pair command failed:", e)
    }

    if (discoveredDevice) {
      try {
        const result = await execa("adb", ["connect", discoveredDevice])

        if (result.stdout.includes("connected to")) {
          console.log("Connected!")
          exit()
        } else {
          console.error(`Failed to connect to device ${discoveredDevice}:`, result.stdout)
        }
      } catch (e) {
        console.error("ADB connect command failed:", e)
      }
    }
  })
  .start()

process.on("SIGINT", () => {
  exit()
})

function randomString(length: number) {
  return Array.from({ length }, () => Math.random().toString(36)[2]).join("")
}

function serviceToDevice(service: Service) {
  return `${service.addresses[0]}:${service.port}`
}

function generateWifiConfig(name: string, password: string) {
  return `WIFI:T:ADB;S:${name};P:${password};;`
}

function exit(code: number = 0) {
  connectBrowser.stop()
  pairingBrowser.stop()
  process.exit(code)
}
