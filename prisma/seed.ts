import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings: { key: string; value: Prisma.InputJsonValue }[] = [
    { key: 'monthly_free_credits',    value: 75 },
    { key: 'cost_game_template',      value: 25 },
    { key: 'cost_league',             value: 10 },
    { key: 'cost_add_player',         value: 10 },
    { key: 'cost_played_game',        value: 5  },
    { key: 'low_credit_threshold',    value: 20 },
    { key: 'strike_enabled',          value: false },
    { key: 'bitcoin_discount_percent',value: 10 },
    { key: 'oss_threshold_cents',     value: 1000000 },
    { key: 'free_mode_active',        value: false },
    { key: 'free_mode_banner_nl',     value: 'Gratis te gebruiken — kosten per actie en maandelijks tegoed worden later afgestemd.' },
    { key: 'free_mode_banner_en',     value: 'Currently free to use — action costs and monthly allowance will be tuned before billing turns on.' },
  ]

  for (const s of settings) {
    await prisma.adminSettings.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    })
  }

  console.log(`Seeded ${settings.length} AdminSettings rows`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
