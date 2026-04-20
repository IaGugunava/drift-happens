import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { CustomerDocument } from './schemas/customer.schema';
import { CustomersService } from './services/customers.service';

class CustomerTransactionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  createdAt!: string;
}

class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalSpent?: number;

  @IsOptional()
  @IsDateString()
  lastTransactionAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerTransactionDto)
  transactions?: CustomerTransactionDto[];
}

class UpdateCustomerDto extends CreateCustomerDto {}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async listCustomers(@Query() query: PaginationQueryDto) {
    const result = await this.customersService.list(query.page, query.pageSize);

    return {
      ...result,
      items: result.items.map((customer) => this.toCustomerResponse(customer)),
    };
  }

  @Get(':id')
  async getCustomer(@Param('id') customerId: string) {
    const customer = await this.customersService.findByIdOrThrow(customerId);
    return this.toCustomerResponse(customer);
  }

  @Post()
  async createCustomer(@Body() body: CreateCustomerDto) {
    const customer = await this.customersService.create({
      name: body.name,
      email: body.email,
      totalSpent: body.totalSpent,
      lastTransactionAt: body.lastTransactionAt ? new Date(body.lastTransactionAt) : null,
      tags: body.tags,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      transactions: body.transactions?.map((transaction) => ({
        amount: transaction.amount,
        createdAt: new Date(transaction.createdAt),
      })),
    });

    return this.toCustomerResponse(customer);
  }

  @Patch(':id')
  async updateCustomer(
    @Param('id') customerId: string,
    @Body() body: UpdateCustomerDto,
  ) {
    const customer = await this.customersService.update(customerId, {
      name: body.name,
      email: body.email,
      totalSpent: body.totalSpent,
      lastTransactionAt:
        body.lastTransactionAt === undefined
          ? undefined
          : body.lastTransactionAt
            ? new Date(body.lastTransactionAt)
            : null,
      tags: body.tags,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      transactions: body.transactions?.map((transaction) => ({
        amount: transaction.amount,
        createdAt: new Date(transaction.createdAt),
      })),
    });

    return this.toCustomerResponse(customer);
  }

  @Delete(':id')
  async removeCustomer(@Param('id') customerId: string) {
    await this.customersService.remove(customerId);
    return {
      success: true,
    };
  }

  private toCustomerResponse(customer: CustomerDocument) {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      totalSpent: customer.totalSpent,
      lastTransactionAt: customer.lastTransactionAt?.toISOString() ?? null,
      tags: customer.tags,
      createdAt: customer.createdAt.toISOString(),
      transactions: customer.transactions.map((transaction) => ({
        amount: transaction.amount,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  }
}
