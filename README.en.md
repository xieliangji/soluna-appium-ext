# soluna-appium-ext

`soluna-appium-ext` is an Appium plugin that provides:

- Appium startup preflight checks for host CLI dependencies (`adb` and `go-ios`/`ios`)
- A custom HTTP endpoint to query device info by `udid` with a unified Android/iOS response model

Preflight command discovery is cross-platform:

- macOS/Linux: uses `which`
- Windows: uses `where`

## Features

### 1) Preflight checks before Appium startup

When the plugin is enabled, it verifies:

- `adb` is installed
- `go-ios` or `ios` (alias) is installed

If any required command is missing, it logs an error and throws, blocking Appium startup.

### 2) Device lookup endpoint

The plugin exposes:

- `GET /soluna/device?udid=<UDID>`
- `GET /soluna/devices`

Behavior:

- Detects whether the UDID belongs to an Android or iOS device connected to the host
- Returns normalized device info
- Returns HTTP 404 when device does not exist
- `GET /soluna/devices` returns all currently connected Android+iOS devices

### 3) Execute adb / go-ios (ios) commands

The plugin exposes a command execution endpoint:

- `POST /soluna/command`

Example request body:

```json
{
  "tool": "adb",
  "args": ["devices"],
  "timeoutMs": 5000,
  "maxOutputBytes": 65536
}
```

Fields:

- `tool`: only `adb`, `go-ios`, `ios`
- `args`: command argument array
- `timeoutMs`: capture window in ms (default 5000, range 100~60000)
- `maxOutputBytes`: max output bytes (default 65536, range 1024~2097152)

Response includes:

- `exitCode`: process exit code
- `timedOut`: whether process was stopped due to timeout
- `truncated`: whether output was truncated
- `stdout` / `stderr`: captured output

Logging behavior:

- Request/result summaries are logged at Appium `info` level
- Full command `stdout` / `stderr` are logged at `debug` level

For long-running commands that keep streaming output, this plugin uses controlled execution:

- captures output within `timeoutMs`
- sends `SIGTERM` first, then `SIGKILL` if needed
- returns captured output to avoid hanging HTTP requests

## How to use this plugin when starting Appium

### Prerequisites

Install required host tools first:

- `adb`
- `go-ios` or `ios` (alias)

### 1) Build the plugin

```bash
npm install
npm run build
```

### 2) Install plugin into Appium (local source)

```bash
appium plugin install --source=local .
```

Verify installation:

```bash
appium plugin list
```

You should see plugin name `soluna-ext`.

### 3) Start Appium with plugin enabled

```bash
appium --use-plugins=soluna-ext
```

If preflight fails, startup is blocked and logs an error like:

```text
Preflight failed: missing required CLI tool(s): adb, go-ios (or alias: ios). Install them before starting Appium.
```

### Plugin upgrade steps (by install mode)

If you run `appium` inside this plugin repository and the project depends on `appium`, Appium may mark the plugin as `dev` install type.
In `dev` mode, uninstall is blocked with: `Cannot uninstall ... because it is in development`.

#### A) `dev` mode

Upgrade flow:

1. Rebuild in plugin repository:

```bash
npm install
npm run build
```

2. Restart Appium (no uninstall/reinstall needed):

```bash
appium --use-plugins=soluna-ext
```

#### B) normal `local`/`npm` install mode

Upgrade flow:

1. Rebuild (for local source flow):

```bash
npm install
npm run build
```

2. Uninstall old plugin:

```bash
appium plugin uninstall soluna-ext
```

3. Install new version:

```bash
# local source
appium plugin install --source=local .

# or npm package
# appium plugin install --source=npm <package-name>
```

4. Restart Appium with plugin enabled:

```bash
appium --use-plugins=soluna-ext
```

### 4) Call the device endpoint

```bash
curl "http://127.0.0.1:4723/soluna/device?udid=<YOUR_UDID>"
```

### 5) Call the all-devices endpoint

```bash
curl "http://127.0.0.1:4723/soluna/devices"
```

### 6) Call the command execution endpoint

```bash
curl -X POST "http://127.0.0.1:4723/soluna/command" \
  -H "Content-Type: application/json" \
  -d '{"tool":"adb","args":["devices"],"timeoutMs":5000}'
```

### 7) Optional custom host/port

```bash
appium --address 0.0.0.0 --port 4725 --use-plugins=soluna-ext
curl "http://127.0.0.1:4725/soluna/device?udid=<YOUR_UDID>"
curl "http://127.0.0.1:4725/soluna/devices"
```

## Development

```bash
npm run lint
npm run test:unit
npm run build
```

Run a single test file:

```bash
npm run test:single test/unit/preflight.spec.ts
```

## Appium metadata

Defined in `package.json`:

- `appium.pluginName`: `soluna-ext`
- `appium.mainClass`: `SolunaExtPlugin`
