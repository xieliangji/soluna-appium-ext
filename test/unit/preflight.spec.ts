import {expect} from 'chai'
import {resolveIosCommand, runPreflightChecks} from '../../lib/cli/preflight'
import type {CommandRunner} from '../../lib/cli/exec'

function makeRunner(availability: Record<string, boolean>): CommandRunner {
  return async (command: string, args: string[] = []) => {
    if (command !== 'which') {
      return {stdout: '', stderr: ''}
    }
    const name = args[0]
    if (availability[name]) {
      return {stdout: `/usr/bin/${name}\n`, stderr: ''}
    }
    throw new Error('not found')
  }
}

describe('preflight checks', () => {
  it('should resolve go-ios first', async () => {
    const runner = makeRunner({adb: true, 'go-ios': true, ios: true})
    const cmd = await resolveIosCommand(runner)
    expect(cmd).to.equal('go-ios')
  })

  it('should fallback to ios alias', async () => {
    const runner = makeRunner({adb: true, ios: true})
    const cmd = await resolveIosCommand(runner)
    expect(cmd).to.equal('ios')
  })

  it('should fail when adb missing', async () => {
    const runner = makeRunner({ios: true})
    let caught: unknown
    try {
      await runPreflightChecks(runner)
    } catch (err) {
      caught = err
    }
    expect(String(caught)).to.include('adb')
  })

  it('should fail when go-ios and ios missing', async () => {
    const runner = makeRunner({adb: true})
    let caught: unknown
    try {
      await runPreflightChecks(runner)
    } catch (err) {
      caught = err
    }
    expect(String(caught)).to.include('go-ios')
  })
})
