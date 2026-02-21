import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Alert Rule DTOs ────────────────────────────────────

export class CreateAlertRuleDto {
    @ApiProperty({ example: 'High CPU Alert' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Fires when CPU exceeds 90%' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'cpu_utilization', description: 'Metric name to evaluate' })
    @IsString()
    metricName: string;

    @ApiProperty({ example: '>', enum: ['>', '<', '>=', '<=', '==', '!='] })
    @IsString()
    condition: string;

    @ApiProperty({ example: 90 })
    @IsNumber()
    threshold: number;

    @ApiPropertyOptional({ example: 300, description: 'Sustained breach duration in seconds (0 = immediate)' })
    @IsInt()
    @Min(0)
    @IsOptional()
    duration?: number;

    @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'], default: 'warning' })
    @IsString()
    @IsOptional()
    severity?: string;

    @ApiPropertyOptional({ example: ['telegram', 'email'] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    notifyChannels?: string[];

    @ApiPropertyOptional({ description: 'Apply to specific device group' })
    @IsInt()
    @IsOptional()
    deviceGroupId?: number;
}

export class UpdateAlertRuleDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    metricName?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    condition?: string;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    threshold?: number;

    @ApiPropertyOptional()
    @IsInt()
    @Min(0)
    @IsOptional()
    duration?: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    severity?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @ApiPropertyOptional()
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    notifyChannels?: string[];

    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    deviceGroupId?: number;
}

// ─── Alert History Query ────────────────────────────────

export class AlertHistoryQueryDto {
    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    deviceId?: number;

    @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'] })
    @IsString()
    @IsOptional()
    severity?: string;

    @ApiPropertyOptional({ enum: ['triggered', 'acknowledged', 'resolved'] })
    @IsString()
    @IsOptional()
    state?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50 })
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    limit?: number = 50;
}
