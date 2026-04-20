import { Body, Controller, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { CustomersService } from '../customers/services/customers.service';

class SimulateTransactionDto {
  @IsString()
  customerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}

class SimulateTimeoutDto {
  @IsString()
  customerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  daysSinceLastTx!: number;
}

class SimulateFieldUpdateDto {
  @IsString()
  customerId!: string;

  @IsString()
  field!: string;

  value!: unknown;
}

class SimulateBulkImportDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('simulate')
export class SimulationController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('transaction')
  async simulateTransaction(@Body() body: SimulateTransactionDto) {
    const customer = await this.customersService.simulateTransaction(
      body.customerId,
      body.amount,
    );

    return {
      customerId: customer.id,
      totalSpent: customer.totalSpent,
      lastTransactionAt: customer.lastTransactionAt?.toISOString() ?? null,
    };
  }

  @Post('timeout')
  async simulateTimeout(@Body() body: SimulateTimeoutDto) {
    const customer = await this.customersService.simulateTimeout(
      body.customerId,
      body.daysSinceLastTx,
    );

    return {
      customerId: customer.id,
      lastTransactionAt: customer.lastTransactionAt?.toISOString() ?? null,
    };
  }

  @Post('field-update')
  async simulateFieldUpdate(@Body() body: SimulateFieldUpdateDto) {
    const customer = await this.customersService.simulateFieldUpdate(
      body.customerId,
      body.field,
      body.value,
    );

    return {
      customerId: customer.id,
      updatedField: body.field,
    };
  }

  @Post('bulk-import')
  async simulateBulkImport(@Body() body: SimulateBulkImportDto) {
    const result = await this.customersService.bulkImport(body.count);

    return result;
  }
}
