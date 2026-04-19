/**
 * Manually verify a user's email address — use when Mailgun is not yet configured.
 * Usage: npx tsx scripts/verify-email.ts <email>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx scripts/verify-email.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  if (user.emailVerified) {
    console.log(`Already verified: ${email}`)
    process.exit(0)
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  })

  console.log(`✅ Email verified for: ${email}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
