import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

async function main() {
  const adminUsername = 'admin'
  const adminPassword = 'admin123'
  
  const existingUser = await prisma.user.findUnique({
    where: { username: adminUsername }
  })
  
  if (existingUser) {
    console.log('Admin user already exists')
    return
  }
  
  const hashedPassword = await hashPassword(adminPassword)
  
  await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      role: 'ADMIN'
    }
  })
  
  console.log('Admin user created successfully!')
  console.log('Username:', adminUsername)
  console.log('Password:', adminPassword)
}

main()
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
