# adb-wifi-connect

Connect to your Android device with adb over Wi-Fi.

```shell
npx adb-wifi-connect
```

<details>
<summary>bun</summary>

```shell
bunx adb-wifi-connect
```

</details>

<details>
<summary>pnpm</summary>

```shell
pnpm dlx adb-wifi-connect
```

</details>

<details>
<summary>yarn</summary>

```shell
yarn dlx adb-wifi-connect
```

</details>

This script makes it easy to connect by automatically discovering devices
via [mDNS](https://en.wikipedia.org/wiki/Multicast_DNS) and either connecting directly or showing a QR-Code for pairing.

Heavily inspired by [Lyto](https://github.com/eeriemyxi/lyto).
