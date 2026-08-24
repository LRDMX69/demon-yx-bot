'use strict'

const { bot } = require('../lib/')
const agent = require('../lib/demonyx/agent')

bot(
  {
    pattern: 'dx ?(.*)',
    desc: 'Dēmonyx specialist: search and execute 1,200+ registered commands.',
    type: 'specialist',
  },
  async (message, match, ctx) => {
    const response = await agent.run(match, {
      message,
      ctx,
      jid: message.jid,
      sender: message.sender,
    })
    return message.send(response)
  }
)
