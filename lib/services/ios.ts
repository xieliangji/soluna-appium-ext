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

export async function findIosDeviceByUdid(
  udid: string,
  runner: CommandRunner = runCommand
): Promise<UnifiedDeviceInfo | null> {
  const iosCmd = await resolveIosCommand(runner)
  if (!iosCmd) {
    return null
  }

  let detailsOutput: string
  try {
    const result = await runner(iosCmd, ['list', '--details'])
    detailsOutput = result.stdout
  } catch {
    return null
  }

  const parsed = parseGoIosListOutput(detailsOutput)
  const candidate = parsed.deviceList?.find((item) => item.udid === udid)
  if (!candidate) {
    return null
  }

  return {
    platform: 'ios',
    udid,
    name: candidate.ProductName || 'iOS Device',
    model: candidate.ProductType || 'Unknown',
    osVersion: candidate.ProductVersion || 'Unknown',
  }
}

export const __internal = {
  parseGoIosListOutput,
}
