# Discord Builds Panel

Desktop app for building and sending Discord webhooks with a visual editor.

## Download

Get the latest **DiscordBuildsPanel.exe** from [Releases](https://github.com/leonardolmx12a/discord-builds-panel/releases).

## Tech stack

- **UI:** TypeScript, React, CSS Modules
- **Desktop:** Electron
- **Backend:** Node.js (Express, local server)

## Build from source

Requirements: Node.js 18+, Yarn 4

```bash
corepack enable
yarn install
cd components-sdk && yarn build && cd ..
cd panel && yarn install && yarn build && yarn dist
```

The portable executable is generated at `panel/release/DiscordBuildsPanel.exe`.

## Project structure

```
components-sdk/   # Discord component builder SDK
website/          # Web builder (shared components)
panel/            # Electron desktop app
```

## License

See upstream discord.builders project license.
