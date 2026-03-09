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

export interface DashboardOverviewResponse {
    deviceId: number;
    time: string;
    cpu_utilization: number | null;
    memory_percent: number | null;
    response_time_ms: number | null;
    device_status: string;
    uptime: number | null;
}

export interface DashboardData {
    metrics: DashboardOverviewResponse[];
    totalDevices: number;
    devicesUp: number;
    devicesDown: number;
    devicesWarning: number;
    avgCpu: number;
    avgMemory: number;
    topCpuDevices: DashboardOverviewResponse[];

    totalLocations: number;
    activeLocations: number;
    totalInterfaces: number;
    interfacesDown: number;
    totalAps: number;
    clientsConnected: number;
    openTickets: number;
    recentTickets: any[];
    recentDiscovery: any[];
    recentSecurityEvents: any[];
}
