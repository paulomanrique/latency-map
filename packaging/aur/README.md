# AUR packaging

This directory keeps the AUR package sources for LatencyMap.

- `latency-map-bin` installs the GitHub release AppImage verified by SHA-256.
- `latency-map-git` builds the latest Git revision with Electron Builder and installs the unpacked Linux app.

Both packages depend on `traceroute` for Linux hop measurements. The app can fall back to `tracepath` when available, but the AUR packages intentionally install the primary tool.

Before publishing an update to AUR, regenerate `.SRCINFO` in the package directory:

```sh
makepkg --printsrcinfo > .SRCINFO
```
