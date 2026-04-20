import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { CustomerIndexerService } from '../customers/services/customer-indexer.service';
import { SegmentEvent } from '../segments/schemas/segment-event.schema';
import { Segment } from '../segments/schemas/segment.schema';
import { defaultSegments } from '../segments/defaults/default-segments';
import { SegmentsService } from '../segments/services/segments.service';

const BULK_CHUNK_SIZE = 50;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

interface CustomerSeedInput {
  name: string;
  email: string;
  totalSpent: number;
  lastTransactionAt: Date | null;
  tags: string[];
  createdAt: Date;
  transactions: Array<{ amount: number; createdAt: Date }>;
}

function buildCustomers(): CustomerSeedInput[] {
  const customers: CustomerSeedInput[] = [];

  // 50 Active Buyers — last transaction within 30 days, varied spend
  for (let i = 0; i < 50; i++) {
    customers.push({
      name: `Active Buyer ${i + 1}`,
      email: `active-${i + 1}@seed.local`,
      totalSpent: 300 + i * 40,
      lastTransactionAt: daysAgo(5 + (i % 20)),
      tags: i % 4 === 0 ? ['returning'] : [],
      createdAt: daysAgo(180 + i),
      transactions: [{ amount: 300 + i * 40, createdAt: daysAgo(5 + (i % 20)) }],
    });
  }

  // 40 VIP Clients — totalSpent >= 5000, still active
  for (let i = 0; i < 40; i++) {
    customers.push({
      name: `VIP Client ${i + 1}`,
      email: `vip-${i + 1}@seed.local`,
      totalSpent: 5000 + i * 300,
      lastTransactionAt: daysAgo(10 + (i % 15)),
      tags: ['vip'],
      createdAt: daysAgo(365 + i * 3),
      transactions: [{ amount: 5000 + i * 300, createdAt: daysAgo(10 + (i % 15)) }],
    });
  }

  // 30 VIP at Risk — totalSpent >= 5000, last transaction > 90 days ago
  for (let i = 0; i < 30; i++) {
    customers.push({
      name: `VIP At Risk ${i + 1}`,
      email: `vip-risk-${i + 1}@seed.local`,
      totalSpent: 5000 + i * 250,
      lastTransactionAt: daysAgo(95 + i * 2),
      tags: ['vip'],
      createdAt: daysAgo(400 + i * 4),
      transactions: [{ amount: 5000 + i * 250, createdAt: daysAgo(95 + i * 2) }],
    });
  }

  // 40 Risk Group — last transaction > 90 days, totalSpent > 0 but below VIP threshold
  for (let i = 0; i < 40; i++) {
    customers.push({
      name: `At Risk ${i + 1}`,
      email: `risk-${i + 1}@seed.local`,
      totalSpent: 100 + i * 60,
      lastTransactionAt: daysAgo(100 + i * 3),
      tags: [],
      createdAt: daysAgo(300 + i * 2),
      transactions: [{ amount: 100 + i * 60, createdAt: daysAgo(100 + i * 3) }],
    });
  }

  // 40 New / never transacted
  for (let i = 0; i < 40; i++) {
    customers.push({
      name: `New Customer ${i + 1}`,
      email: `new-${i + 1}@seed.local`,
      totalSpent: 0,
      lastTransactionAt: null,
      tags: [],
      createdAt: daysAgo(i * 2),
      transactions: [],
    });
  }

  return customers;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const customerModel = app.get<Model<Customer>>(getModelToken(Customer.name));
    const segmentModel = app.get<Model<Segment>>(getModelToken(Segment.name));
    const segmentEventModel = app.get<Model<SegmentEvent>>(getModelToken(SegmentEvent.name));
    const customerIndexer = app.get(CustomerIndexerService);
    const segmentsService = app.get(SegmentsService);

    // ── 1. Clear existing data ──────────────────────────────────────────────
    console.log('Clearing existing data...');
    await Promise.all([
      customerModel.deleteMany({}),
      segmentModel.deleteMany({}),
      segmentEventModel.deleteMany({}),
    ]);
    console.log('  done.');

    // ── 2. Insert 200 customers ─────────────────────────────────────────────
    console.log('Seeding 200 customers...');
    const customerDefs = buildCustomers();
    const allCustomers: CustomerDocument[] = [];

    for (let offset = 0; offset < customerDefs.length; offset += BULK_CHUNK_SIZE) {
      const chunk = customerDefs.slice(offset, offset + BULK_CHUNK_SIZE);
      const inserted = await customerModel.insertMany(chunk);
      allCustomers.push(...(inserted as unknown as CustomerDocument[]));
    }

    // ── 3. Index all customers into Elasticsearch ───────────────────────────
    console.log('Indexing customers into Elasticsearch...');
    for (let offset = 0; offset < allCustomers.length; offset += BULK_CHUNK_SIZE) {
      await customerIndexer.bulkIndexCustomers(allCustomers.slice(offset, offset + BULK_CHUNK_SIZE));
    }
    console.log(`  ${allCustomers.length} customers indexed.`);

    // ── 4. Create segments (evaluation + freeze happens inside create()) ────
    console.log('Creating segments...');
    for (const def of defaultSegments) {
      const segment = await segmentsService.create(def);
      const frozen = segment.frozenAt ? ` (frozen at ${segment.frozenAt.toISOString()})` : '';
      console.log(`  ✓ "${segment.name}"  type=${segment.type}  members=${segment.memberCount}${frozen}`);
    }

    console.log('\nSeed complete.');
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Seed failed: ${message}`);
  process.exit(1);
});
