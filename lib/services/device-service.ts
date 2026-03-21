import {runCommand, type CommandRunner} from '../cli/exec'
import {findAndroidDeviceByUdid} from './android'
import {findIosDeviceByUdid} from './ios'
import type {DeviceLookupResult} from '../types/device'

export async function lookupDeviceByUdid(
  udid: string,
  runner: CommandRunner = runCommand
): Promise<DeviceLookupResult> {
  const android = await findAndroidDeviceByUdid(udid, runner)
  if (android) {
    return {found: true, device: android}
  }

  const ios = await findIosDeviceByUdid(udid, runner)
  if (ios) {
    return {found: true, device: ios}
  }

  return {found: false}
}
