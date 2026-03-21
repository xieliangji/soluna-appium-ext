import {expect} from 'chai'
import express from 'express'
import request from 'supertest'
import {handleGetDeviceInfo} from '../../lib/http/device-route'
import type {CommandRunner} from '../../lib/cli/exec'

describe('GET /soluna/device', () => {
  const app = express()

  app.get('/soluna/device', async (req, res) => {
    const runner: CommandRunner = async (command: string, args: string[] = []) => {
      if (command === 'adb' && args.length === 1 && args[0] === 'devices') {
        return {stdout: 'List of devices attached\nabc123\tdevice\n\n', stderr: ''}
      }
      if (
        command === 'adb' &&
        args.length >= 4 &&
        args[0] === '-s' &&
        args[1] === 'abc123' &&
        args[2] === 'shell' &&
        args[3] === 'getprop'
      ) {
        return {
          stdout: '[ro.product.model]: [Pixel 8]\n[ro.build.version.release]: [14]\n',
          stderr: '',
        }
      }
      if (command === 'which' && args[0] === 'adb') {
        return {stdout: '/usr/bin/adb\n', stderr: ''}
      }
      if (command === 'which' && (args[0] === 'go-ios' || args[0] === 'ios')) {
        throw new Error('not found')
      }
      throw new Error(`Unexpected command ${command} ${args.join(' ')}`)
    }

    await handleGetDeviceInfo(req, res, runner)
  })

  it('returns 400 when udid missing', async () => {
    const response = await request(app).get('/soluna/device')
    expect(response.status).to.equal(400)
    expect(response.body.value.error).to.equal('invalid_argument')
  })

  it('returns 404 when device not found', async () => {
    const response = await request(app).get('/soluna/device').query({udid: 'not-exist'})
    expect(response.status).to.equal(404)
    expect(response.body.value.exists).to.equal(false)
  })

  it('returns 200 with unified device info', async () => {
    const response = await request(app).get('/soluna/device').query({udid: 'abc123'})
    expect(response.status).to.equal(200)
    expect(response.body.value.exists).to.equal(true)
    expect(response.body.value.device.platform).to.equal('android')
  })
})
