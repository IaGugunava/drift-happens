import { Injectable } from '@nestjs/common';
import type { CustomerDocument } from '../schemas/customer.schema';
import { SearchService } from '../../search/search.service';

@Injectable()
export class CustomerIndexerService {
  constructor(private readonly searchService: SearchService) {}

  async indexCustomer(customer: CustomerDocument): Promise<void> {
    await this.searchService.indexCustomerDocument(customer.id, this.toSearchDocument(customer));
  }

  async bulkIndexCustomers(customers: CustomerDocument[]): Promise<void> {
    await this.searchService.bulkIndexCustomerDocuments(
      customers.map((customer) => ({
        customerId: customer.id,
        document: this.toSearchDocument(customer),
      })),
    );
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.searchService.deleteCustomerDocument(customerId);
  }

  private toSearchDocument(customer: CustomerDocument): Record<string, unknown> {
    return {
      name: customer.name,
      email: customer.email,
      totalSpent: customer.totalSpent,
      lastTransactionAt: customer.lastTransactionAt,
      tags: customer.tags,
      createdAt: customer.createdAt,
      transactions: customer.transactions.map((transaction) => ({
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      })),
    };
  }
}
