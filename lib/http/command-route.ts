import type {Request, Response} from 'express'
import {executeSupportedCommand, validateCommandRequest} from '../services/command-executor'

export async function handleExecuteCommand(req: Request, res: Response): Promise<void> {
  let normalized
  try {
    normalized = validateCommandRequest(req.body)
  } catch (err) {
    res.status(400).json({
      value: {
        error: 'invalid_argument',
        message: err instanceof Error ? err.message : String(err),
      },
    })
    return
  }

  try {
    const result = await executeSupportedCommand(normalized)
    const status = result.exitCode === 0 ? 200 : 422
    res.status(status).json({
      value: {
        ok: result.exitCode === 0,
        ...result,
      },
    })
  } catch (err) {
    res.status(500).json({
      value: {
        error: 'command_execution_failed',
        message: err instanceof Error ? err.message : String(err),
      },
    })
  }
}
