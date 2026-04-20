import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChangeBufferService } from '../../buffer/change-buffer.service';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { CustomerIndexerService } from './customer-indexer.service';

export interface CreateCustomerInput {
  name: string;
  email: string;
  totalSpent?: number;
  lastTransactionAt?: Date | null;
  tags?: string[];
  createdAt?: Date;
  transactions?: Array<{
    amount: number;
    createdAt: Date;
  }>;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  totalSpent?: number;
  lastTransactionAt?: Date | null;
  tags?: string[];
  createdAt?: Date;
  transactions?: Array<{
    amount: number;
    createdAt: Date;
  }>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<Customer>,
    private readonly customerIndexerService: CustomerIndexerService,
    private readonly changeBufferService: ChangeBufferService,
  ) {}

  async list(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<CustomerDocument>> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.customerModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.customerModel.countDocuments().exec(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async create(input: CreateCustomerInput): Promise<CustomerDocument> {
    const customer = await this.customerModel.create({
      ...input,
      totalSpent: input.totalSpent ?? 0,
      lastTransactionAt: input.lastTransactionAt ?? null,
      tags: input.tags ?? [],
      createdAt: input.createdAt ?? new Date(),
      transactions: input.transactions ?? [],
    });

    await this.customerIndexerService.indexCustomer(customer);
    await this.changeBufferService.markCustomerChanged(customer.id);
    return customer;
  }

  async bulkImport(count: number): Promise<{
    createdCount: number;
    customerIds: string[];
  }> {
    const batchSize = 1000;
    const createdCustomerIds: string[] = [];

    for (let start = 0; start < count; start += batchSize) {
      const batchCount = Math.min(batchSize, count - start);
      const customers = this.buildBulkCustomers(start, batchCount);
      const insertedCustomers = await this.customerModel.insertMany(customers);
      const hydratedCustomers = insertedCustomers as unknown as CustomerDocument[];

      await this.customerIndexerService.bulkIndexCustomers(hydratedCustomers);
      await this.changeBufferService.markCustomersChanged(
        hydratedCustomers.map((customer) => customer.id),
      );

      createdCustomerIds.push(...hydratedCustomers.map((customer) => customer.id));
    }

    return {
      createdCount: createdCustomerIds.length,
      customerIds: createdCustomerIds,
    };
  }

  async update(
    customerId: string,
    updates: UpdateCustomerInput,
  ): Promise<CustomerDocument> {
    const customer = await this.customerModel
      .findByIdAndUpdate(customerId, updates, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    await this.customerIndexerService.indexCustomer(customer);
    await this.changeBufferService.markCustomerChanged(customer.id);
    return customer;
  }

  async findById(customerId: string): Promise<CustomerDocument | null> {
    return this.customerModel.findById(customerId).exec();
  }

  async findByIdOrThrow(customerId: string): Promise<CustomerDocument> {
    const customer = await this.findById(customerId);

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    return customer;
  }

  async remove(customerId: string): Promise<void> {
    const customer = await this.customerModel.findByIdAndDelete(customerId).exec();

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    await this.customerIndexerService.deleteCustomer(customer.id);
    await this.changeBufferService.markCustomerChanged(customer.id);
  }

  async reindexCustomer(customerId: string): Promise<CustomerDocument> {
    const customer = await this.findByIdOrThrow(customerId);
    await this.customerIndexerService.indexCustomer(customer);
    return customer;
  }

  async simulateTransaction(
    customerId: string,
    amount: number,
  ): Promise<CustomerDocument> {
    const customer = await this.findByIdOrThrow(customerId);
    const transactionDate = new Date();

    customer.transactions.push({
      amount,
      createdAt: transactionDate,
    });
    customer.totalSpent += amount;
    customer.lastTransactionAt = transactionDate;

    await customer.save();
    await this.customerIndexerService.indexCustomer(customer);
    await this.changeBufferService.markCustomerChanged(customer.id);

    return customer;
  }

  async simulateTimeout(customerId: string, daysSinceLastTx: number): Promise<CustomerDocument> {
    const customer = await this.findByIdOrThrow(customerId);
    const lastTransactionAt = new Date();
    lastTransactionAt.setDate(lastTransactionAt.getDate() - daysSinceLastTx);

    customer.lastTransactionAt = lastTransactionAt;
    await customer.save();
    await this.customerIndexerService.indexCustomer(customer);
    await this.changeBufferService.markCustomerChanged(customer.id);

    return customer;
  }

  async simulateFieldUpdate(
    customerId: string,
    field: string,
    value: unknown,
  ): Promise<CustomerDocument> {
    const allowedFields = new Set([
      'name',
      'email',
      'totalSpent',
      'lastTransactionAt',
      'tags',
      'createdAt',
    ]);

    if (!allowedFields.has(field)) {
      throw new NotFoundException(`Field ${field} cannot be updated via simulation`);
    }

    const normalizedValue = this.normalizeFieldValue(field, value);
    return this.update(customerId, {
      [field]: normalizedValue,
    });
  }

  toObjectId(customerId: string): Types.ObjectId {
    return new Types.ObjectId(customerId);
  }

  private buildBulkCustomers(start: number, count: number): CreateCustomerInput[] {
    return Array.from({ length: count }, (_, index) => {
      const sequence = start + index;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (sequence % 120));
      const lastTransactionAt = new Date(createdAt);
      lastTransactionAt.setDate(lastTransactionAt.getDate() + (sequence % 100));
      const totalSpent = 250 + ((sequence * 137) % 8500);

      return {
        name: `Imported Customer ${sequence + 1}`,
        email: `imported-${Date.now()}-${sequence + 1}@drifthappens.local`,
        totalSpent,
        createdAt,
        lastTransactionAt,
        tags: sequence % 5 === 0 ? ['vip'] : sequence % 3 === 0 ? ['returning'] : [],
        transactions: totalSpent > 0
          ? [
              {
                amount: totalSpent,
                createdAt: lastTransactionAt,
              },
            ]
          : [],
      };
    });
  }

  private normalizeFieldValue(field: string, value: unknown): unknown {
    switch (field) {
      case 'totalSpent':
        return Number(value);
      case 'lastTransactionAt':
      case 'createdAt':
        return value ? new Date(String(value)) : null;
      case 'tags':
        if (Array.isArray(value)) {
          return value.map((entry) => String(entry));
        }

        return String(value)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
      default:
        return value;
    }
  }
}
