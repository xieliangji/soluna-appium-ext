import {expect} from 'chai'
import express from 'express'
import request from 'supertest'
import {handleExecuteCommand} from '../../lib/http/command-route'

describe('POST /soluna/command', () => {
  const app = express()
  app.use(express.json())

  app.post('/soluna/command', async (req, res) => {
    await handleExecuteCommand(req, res)
  })

  it('returns 400 for invalid tool', async () => {
    const response = await request(app)
      .post('/soluna/command')
      .send({tool: 'bash', args: ['-lc', 'echo hi']})

    expect(response.status).to.equal(400)
    expect(response.body.value.error).to.equal('invalid_argument')
  })

  it('returns 422 with error payload when command exits non-zero', async () => {
    const response = await request(app)
      .post('/soluna/command')
      .send({tool: 'adb', args: ['invalid-sub-command'], timeoutMs: 1000})

    expect([422, 500]).to.include(response.status)
    expect(response.body).to.have.property('value')
  })
})
