# LatencyMap

Desktop app for measuring network latency and traceroute to cloud provider endpoints worldwide. Built with Electron, React, and native OS network tools.

## Features

- **Ping & traceroute** to hundreds of endpoints across several cloud providers — a list that keeps growing with community contributions
- **Auto-updating catalog** — the provider list is refreshed every time the app launches
- **Filter by location** (continent, country, city) or **by distance** from your coordinates
- **Traceroute viewer** with hop-by-hop RTT, IP, and delta breakdown
- **Custom hosts** — add your own endpoints to monitor alongside the catalog
- **Quality scoring** based on latency, packet loss, and jitter
- **Cross-platform** — Windows, macOS, and Linux

## Getting started

Download the latest release for your platform:

**[Releases](https://github.com/paulomanrique/latency-map/releases)**

| Platform | Format |
|---|---|
| Windows | NSIS installer |
| macOS | DMG, ZIP |
| Linux | AppImage, tar.gz |

## Contributing

The host catalog lives in the `data/` directory — one JSON file per provider. The app picks up any `*.json` in that folder automatically, so adding a new provider or expanding an existing one requires no code changes.

We'd love your help growing the catalog. Open a pull request adding or updating a file in `data/` following this structure:

```json
{
  "name": "Provider Name",
  "website": "https://example.com",
  "hosts": [
    {
      "city": "São Paulo",
      "country": "Brazil",
      "continent": "South America",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "regionId": "sa-east-1",
      "hostname": "ping.example.com"
    }
  ]
}
```

Every contribution — whether it's a whole new provider or a single missing region — makes LatencyMap better for everyone.

## Development

```bash
npm install
npm run dev
```

```bash
# Package for current platform
npm run package

# Build for distribution
npm run release
```

## Tech stack

- **Electron** + **electron-vite** — desktop shell and build tooling
- **React 19** — UI
- **TypeScript** — throughout
- **Vitest** — tests
- **Native ping/traceroute** — no external binaries, uses OS commands directly

## License

This project is released into the public domain under the [Unlicense](UNLICENSE).
