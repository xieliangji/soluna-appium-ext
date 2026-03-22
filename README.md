# soluna-appium-ext

`soluna-appium-ext` 是一个 Appium 插件，提供以下能力：

- 在 Appium 启动前检查宿主机依赖（`adb`、`go-ios`/`ios`）
- 通过 HTTP 接口按 `udid` 查询设备，并以统一模型返回 Android/iOS 设备信息

预检中的命令发现已做跨平台兼容：

- macOS/Linux：使用 `which`
- Windows：使用 `where`

English documentation is available in [`README.en.md`](./README.en.md).

## 功能说明

### 1）Appium 启动前依赖检查

插件启用时会检查：

- `adb` 是否已安装
- `go-ios` 或 `ios`（别名）是否已安装

如果有任一依赖缺失，会在控制台输出错误并抛出异常，从而阻止 Appium 继续启动。

### 2）设备查询接口

插件暴露接口：

- `GET /soluna/device?udid=<UDID>`

行为：

- 根据 `udid` 判断当前机器连接的是 Android 设备还是 iOS 设备
- 按统一结构返回设备信息
- 设备不存在时返回 404

### 3）执行 adb / go-ios（ios）命令

插件暴露命令执行接口：

- `POST /soluna/command`

请求体示例：

```json
{
  "tool": "adb",
  "args": ["devices"],
  "timeoutMs": 5000,
  "maxOutputBytes": 65536
}
```

字段说明：

- `tool`：只允许 `adb`、`go-ios`、`ios`
- `args`：命令参数数组
- `timeoutMs`：采集窗口（毫秒），超时会主动结束进程（默认 5000，范围 100~60000）
- `maxOutputBytes`：最大输出字节数（默认 65536，范围 1024~2097152）

返回说明：

- `exitCode`：进程退出码
- `timedOut`：是否因超时被主动结束
- `truncated`：输出是否被截断
- `stdout` / `stderr`：采集到的输出

对于不会立即退出、会持续输出的命令（例如某些日志类命令），本插件不会无限等待：

- 在 `timeoutMs` 窗口内持续采集输出
- 到时先发 `SIGTERM`，必要时再升级为 `SIGKILL`
- 返回当前已采集结果，避免接口阻塞

成功响应示例：

```json
{
  "value": {
    "exists": true,
    "device": {
      "platform": "android",
      "udid": "abc123",
      "name": "Pixel 8",
      "model": "Pixel 8",
      "osVersion": "14"
    }
  }
}
```

设备不存在示例：

```json
{
  "value": {
    "exists": false,
    "message": "Device '<udid>' not found on this host"
  }
}
```

## 如何在启动 Appium 时使用该插件

下面是从本地开发到启动 Appium 的完整流程。

### 前置条件

请先安装宿主机依赖：

- `adb`
- `go-ios` 或 `ios`（别名）

如果缺失，插件会阻止 Appium 启动。

### 1）构建插件

在本仓库根目录执行：

```bash
npm install
npm run build
```

### 2）将插件安装到 Appium（本地源码方式）

```bash
appium plugin install --source=local .
```

查看是否安装成功：

```bash
appium plugin list
```

你应该能看到插件名 `soluna-ext`。

### 3）启用插件并启动 Appium

```bash
appium --use-plugins=soluna-ext
```

- 依赖检查通过：Appium 正常启动
- 依赖检查失败：启动被阻止，并输出类似错误

```text
Preflight failed: missing required CLI tool(s): adb, go-ios (or alias: ios). Install them before starting Appium.
```

### 插件升级步骤（按安装模式）

如果你是在插件仓库内执行 `appium` 命令，并且当前项目依赖里包含 `appium`，Appium 会把该插件标记为 `dev` 模式。
`dev` 模式下不允许 `uninstall`，会提示：`Cannot uninstall ... because it is in development`。

#### A) `dev` 模式

升级步骤：

1. 在插件仓库重新构建：

```bash
npm install
npm run build
```

2. 直接重启 Appium（无需卸载/重装）：

```bash
appium --use-plugins=soluna-ext
```

#### B) `local`/`npm` 普通安装模式

升级步骤：

1. 重新构建（本地源码场景）：

```bash
npm install
npm run build
```

2. 卸载旧版本：

```bash
appium plugin uninstall soluna-ext
```

3. 安装新版本：

```bash
# 本地源码
appium plugin install --source=local .

# 或 npm 包
# appium plugin install --source=npm <package-name>
```

4. 重启 Appium 并启用插件：

```bash
appium --use-plugins=soluna-ext
```

### 4）调用设备查询接口

Appium 启动后，可通过 `curl` 验证：

```bash
curl "http://127.0.0.1:4723/soluna/device?udid=<YOUR_UDID>"
```

### 5）调用命令执行接口

```bash
curl -X POST "http://127.0.0.1:4723/soluna/command" \
  -H "Content-Type: application/json" \
  -d '{"tool":"adb","args":["devices"],"timeoutMs":5000}'
```

### 6）可选：自定义 Appium 地址与端口

如果你不是用默认 `127.0.0.1:4723`，请同步修改请求地址：

```bash
appium --address 0.0.0.0 --port 4725 --use-plugins=soluna-ext
curl "http://127.0.0.1:4725/soluna/device?udid=<YOUR_UDID>"
```

## 开发说明

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### 测试

运行全部单元测试：

```bash
npm run test:unit
```

运行单个测试文件：

```bash
npm run test:single test/unit/preflight.spec.ts
```

## Appium 插件元数据

`package.json` 中的 Appium 扩展元数据：

- `appium.pluginName`: `soluna-ext`
- `appium.mainClass`: `SolunaExtPlugin`
