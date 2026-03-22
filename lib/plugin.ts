import {BasePlugin} from '@appium/base-plugin'
import express from 'express'
import type {Application} from 'express'
import type {AppiumServer} from '@appium/types'
import {runPreflightChecks} from './cli/preflight'
import {handleGetDeviceInfo, handleListDevices} from './http/device-route'
import {handleExecuteCommand} from './http/command-route'

export class SolunaExtPlugin extends BasePlugin {
  // noinspection JSUnusedGlobalSymbols
  static async updateServer(
    expressApp: Application,
    _httpServer: AppiumServer
  ): Promise<void> {
    void _httpServer
    await runPreflightChecks()

    expressApp.get('/soluna/device', async (req, res) => {
      await handleGetDeviceInfo(req, res)
    })

    expressApp.get('/soluna/devices', async (req, res) => {
      await handleListDevices(req, res)
    })

    expressApp.post('/soluna/command', express.json(), async (req, res) => {
      await handleExecuteCommand(req, res)
    })
  }
}

// noinspection JSUnusedGlobalSymbols
export default SolunaExtPlugin
