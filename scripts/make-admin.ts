/**
 * Promote a user to admin role.
 * Usage: npx tsx scripts/make-admin.ts <email>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  if (user.role === 'admin') {
    console.log(`Already admin: ${email}`)
    process.exit(0)
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
  })

  console.log(`✅ ${email} is now an admin`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
