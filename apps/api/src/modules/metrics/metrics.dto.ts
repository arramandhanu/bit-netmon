import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum MetricInterval {
    ONE_MIN = '1m',
    FIVE_MIN = '5m',
    FIFTEEN_MIN = '15m',
    ONE_HOUR = '1h',
    SIX_HOURS = '6h',
    ONE_DAY = '1d',
}

export class MetricsQueryDto {
    @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z' })
    @IsString()
    @IsOptional()
    from?: string;

    @ApiPropertyOptional({ example: '2025-01-02T00:00:00Z' })
    @IsString()
    @IsOptional()
    to?: string;

    @ApiPropertyOptional({ enum: MetricInterval, default: MetricInterval.FIVE_MIN })
    @IsEnum(MetricInterval)
    @IsOptional()
    interval?: MetricInterval = MetricInterval.FIVE_MIN;

    @ApiPropertyOptional({ default: 100 })
    @IsInt()
    @Min(1)
    @Max(1000)
    @IsOptional()
    @Type(() => Number)
    limit?: number = 100;
}
