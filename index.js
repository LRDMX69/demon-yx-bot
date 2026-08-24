const { Client, logger } = require('./lib/client')
const { DATABASE, VERSION, BOT_ENABLED } = require('./config')
const { stopInstance } = require('./lib/pm2')

const start = async () => {
  logger.info(`Dēmonyx ${VERSION}`)

  try {
    await DATABASE.authenticate({ retry: { max: 3 } })
  } catch (error) {
    logger.error({
      msg: 'Database connection failed',
      error: error.message,
      url: process.env.DATABASE_URL,
    })
    return stopInstance()
  }

  const bot = BOT_ENABLED ? new Client() : null

  if (bot) {
    try {
      await bot.connect()
    } catch (error) {
      logger.error({ msg: 'Bot client failed to start', error: error.message })
    }
  } else {
    logger.info('WhatsApp client disabled because API_MODE is api-only')
  }

  return bot
}

const shutdown = async (bot) => {
  try {
    if (bot) await bot.close()
    await DATABASE.close()
    process.exit(0)
  } catch (error) {
    logger.error({ msg: 'Error during shutdown', error: error.message })
    process.exit(1)
  }
}

const init = async () => {
  const bot = await start()

  process.on('SIGINT', () => shutdown(bot))
  process.on('SIGTERM', () => shutdown(bot))
}

init()
