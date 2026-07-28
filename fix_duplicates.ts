import { prisma } from './src/lib/prisma';

async function main() {
  const integrations = await prisma.integration.findMany();
  
  const grouped = integrations.reduce((acc, curr) => {
    const key = `${curr.organizationId}_${curr.provider}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {} as Record<string, typeof integrations>);
  
  let deletedCount = 0;

  for (const [key, group] of Object.entries(grouped)) {
    if (group.length > 1) {
      console.log(`Found duplicates for ${key}: ${group.length} rows`);
      
      // Sort by updatedAt descending (newest first)
      group.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
      const toKeep = group[0];
      const toDelete = group.slice(1);
      
      for (const dup of toDelete) {
        // If the newest one has no credentials, but a duplicate does, merge it
        if (!toKeep.credentials || Object.keys(toKeep.credentials as any).length === 0) {
           if (dup.credentials && Object.keys(dup.credentials as any).length > 0) {
             toKeep.credentials = dup.credentials;
             await prisma.integration.update({
               where: { id: toKeep.id },
               data: { credentials: dup.credentials }
             });
             console.log(`Merged credentials from ${dup.id} into ${toKeep.id}`);
           }
        }
        
        await prisma.integration.delete({ where: { id: dup.id } });
        deletedCount++;
        console.log(`Deleted duplicate: ${dup.id}`);
      }
    }
  }
  
  console.log(`Cleanup complete. Deleted ${deletedCount} duplicates.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
