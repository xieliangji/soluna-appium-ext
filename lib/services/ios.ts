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

function parseGoIosListOutput(output: string): GoIosListResponse {
  try {
    return JSON.parse(output) as GoIosListResponse
  } catch {
    return {}
  }
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
  const candidate = list.find((item) => item.udid === udid)
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
