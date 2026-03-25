import {runCommand, type CommandRunner} from '../cli/exec'
import {resolveIosCommand} from '../cli/preflight'
import type {UnifiedDeviceInfo} from '../types/device'

interface GoIosDeviceDetails {
  udid: string
  ProductName?: string
  ProductType?: string
  ProductVersion?: string
}

interface GoIosListResponse {
  deviceList?: GoIosDeviceDetails[]
}

type RawRecord = Record<string, unknown>

function getStringValue(raw: RawRecord, candidateKeys: string[]): string | undefined {
  for (const key of candidateKeys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const lowerCaseMap = new Map<string, unknown>()
  for (const [key, value] of Object.entries(raw)) {
    lowerCaseMap.set(key.toLowerCase(), value)
  }

  for (const key of candidateKeys) {
    const value = lowerCaseMap.get(key.toLowerCase())
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function normalizeDeviceDetail(raw: unknown): GoIosDeviceDetails | null {
  if (typeof raw === 'string' && raw.trim()) {
    return {udid: raw.trim()}
  }

  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as RawRecord
  const udid = getStringValue(record, ['udid', 'Udid', 'UDID'])
  if (!udid) {
    return null
  }

  return {
    udid,
    ProductName: getStringValue(record, ['ProductName', 'productName']),
    ProductType: getStringValue(record, ['ProductType', 'productType']),
    ProductVersion: getStringValue(record, ['ProductVersion', 'productVersion']),
  }
}

function parseGoIosListOutput(output: string): GoIosListResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    return {}
  }

  let rawList: unknown[] = []
  if (Array.isArray(parsed)) {
    rawList = parsed
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as {deviceList?: unknown[]}).deviceList)) {
    rawList = (parsed as {deviceList: unknown[]}).deviceList
  }

  const deviceList = rawList
    .map((item) => normalizeDeviceDetail(item))
    .filter((item): item is GoIosDeviceDetails => item !== null)

  return {deviceList}
}

function toUnifiedIosDeviceInfo(device: GoIosDeviceDetails): UnifiedDeviceInfo {
  return {
    platform: 'ios',
    udid: device.udid,
    name: device.ProductName || 'iOS Device',
    model: device.ProductType || 'Unknown',
    osVersion: device.ProductVersion || 'Unknown',
  }
}

async function fetchGoIosDeviceList(runner: CommandRunner): Promise<GoIosDeviceDetails[]> {
  const iosCmd = await resolveIosCommand(runner)
  if (!iosCmd) {
    return []
  }

  let detailsOutput: string
  try {
    const result = await runner(iosCmd, ['list', '--details'])
    detailsOutput = result.stdout
  } catch {
    return []
  }

  const parsed = parseGoIosListOutput(detailsOutput)
  return parsed.deviceList ?? []
}

export async function findIosDeviceByUdid(
  udid: string,
  runner: CommandRunner = runCommand
): Promise<UnifiedDeviceInfo | null> {
  const list = await fetchGoIosDeviceList(runner)
  const targetUdid = udid.trim().toLowerCase()
  const candidate = list.find((item) => item.udid.toLowerCase() === targetUdid)
  if (!candidate) {
    return null
  }

  return toUnifiedIosDeviceInfo(candidate)
}

export async function listIosDevices(runner: CommandRunner = runCommand): Promise<UnifiedDeviceInfo[]> {
  const list = await fetchGoIosDeviceList(runner)
  return list.map(toUnifiedIosDeviceInfo)
}

export const __internal = {
  parseGoIosListOutput,
}
