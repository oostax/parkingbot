import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting database initialization...');

    // Read parking data from JSON file
    const dataPath = path.join(process.cwd(), 'public', 'data', 'parking_data.json');
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    const parkingList = JSON.parse(fileContents);

    console.log(`Found ${parkingList.length} parkings in data file`);

    // Generate some sample daily stats for each parking
    for (const parking of parkingList) {
      // Check if stats already exist
      const existingStats = await prisma.dailyStats.count({
        where: { parkingId: parking.id },
      });

      if (existingStats === 0) {
        // Create stats for each hour
        for (let hour = 0; hour < 24; hour++) {
          // Generate random stats with a pattern (busier during rush hours)
          const baseOccupancy = 0.3;
          const rushHourFactor = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 19) ? 0.5 : 0;
          const nightFactor = (hour >= 0 && hour <= 5) ? -0.2 : 0;
          
          const avgOccupancy = Math.min(0.95, Math.max(0.05, baseOccupancy + rushHourFactor + nightFactor + Math.random() * 0.2));
          const totalSpaces = Math.floor(Math.random() * 100) + 50;
          const avgFreeSpaces = Math.floor(totalSpaces * (1 - avgOccupancy));
          
          await prisma.dailyStats.create({
            data: {
              parkingId: parking.id,
              hour,
              avgFreeSpaces,
              avg_occupancy: avgOccupancy,
              sampleCount: 30,
              lastUpdated: new Date(),
            },
          });
        }
        console.log(`Created daily stats for parking: ${parking.name}`);
      } else {
        console.log(`Stats already exist for parking: ${parking.name}`);
      }
    }

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 