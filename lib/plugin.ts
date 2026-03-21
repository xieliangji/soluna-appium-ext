import {BasePlugin} from '@appium/base-plugin'
import express from 'express'
import type {Application} from 'express'
import type {AppiumServer} from '@appium/types'
import {runPreflightChecks} from './cli/preflight'
import {handleGetDeviceInfo} from './http/device-route'
import {handleExecuteCommand} from './http/command-route'

export class SolunaExtPlugin extends BasePlugin {
  static async updateServer(
    expressApp: Application,
    _httpServer: AppiumServer
  ): Promise<void> {
    void _httpServer
    await runPreflightChecks()

    expressApp.get('/soluna/device', async (req, res) => {
      await handleGetDeviceInfo(req, res)
    })

    expressApp.post('/soluna/command', express.json(), async (req, res) => {
      await handleExecuteCommand(req, res)
    })
  }
}

export default SolunaExtPlugin
