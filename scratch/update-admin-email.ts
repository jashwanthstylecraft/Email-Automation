import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const updated = await prisma.user.updateMany({
    where: { email: 'jane@stylecraftus.com' },
    data: { email: 'jashwanthd@stylecraftus.com' },
  });
  console.log(`Updated ${updated.count} user record(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
