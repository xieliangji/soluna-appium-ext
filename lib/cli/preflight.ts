import {runCommand, type CommandRunner} from './exec'

export async function isCommandAvailable(
  command: string,
  runner: CommandRunner = runCommand
): Promise<boolean> {
  try {
    await runner('which', [command])
    return true
  } catch {
    return false
  }
}

export async function resolveIosCommand(runner: CommandRunner = runCommand): Promise<string | null> {
  if (await isCommandAvailable('go-ios', runner)) {
    return 'go-ios'
  }
  if (await isCommandAvailable('ios', runner)) {
    return 'ios'
  }
  return null
}

export async function runPreflightChecks(runner: CommandRunner = runCommand): Promise<void> {
  const missing: string[] = []

  if (!(await isCommandAvailable('adb', runner))) {
    missing.push('adb')
  }

  const iosCommand = await resolveIosCommand(runner)
  if (!iosCommand) {
    missing.push('go-ios (or alias: ios)')
  }

  if (missing.length > 0) {
    const message =
      'Preflight failed: missing required CLI tool(s): ' +
      missing.join(', ') +
      '. Install them before starting Appium.'
    console.error(message)
    throw new Error(message)
  }
}
