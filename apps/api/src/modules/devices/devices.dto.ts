import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, Min, Max, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateDeviceDto {
    @ApiProperty({ example: 'router-hq-01' })
    @IsString()
    @IsNotEmpty()
    hostname: string;

    @ApiProperty({ example: '10.0.1.1' })
    @IsString()
    @IsNotEmpty()
    ipAddress: string;

    @ApiPropertyOptional({ example: 'HQ Core Router' })
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiPropertyOptional({ enum: ['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'], default: 'unknown' })
    @IsEnum(['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'])
    @IsOptional()
    deviceType?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    locationId?: number;

    @ApiPropertyOptional({ enum: ['v1', 'v2c', 'v3'], default: 'v2c' })
    @IsEnum(['v1', 'v2c', 'v3'])
    @IsOptional()
    snmpVersion?: string;

    @ApiPropertyOptional({ example: 'public' })
    @IsString()
    @IsOptional()
    snmpCommunity?: string;

    @ApiPropertyOptional({ example: 161, default: 161 })
    @IsInt()
    @Min(1)
    @Max(65535)
    @IsOptional()
    @Type(() => Number)
    snmpPort?: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3User?: string;

    @ApiPropertyOptional({ enum: ['MD5', 'SHA', 'SHA256'] })
    @IsString()
    @IsOptional()
    snmpV3AuthProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3AuthPass?: string;

    @ApiPropertyOptional({ enum: ['DES', 'AES', 'AES256'] })
    @IsString()
    @IsOptional()
    snmpV3PrivProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3PrivPass?: string;

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    pollingEnabled?: boolean;

    @ApiPropertyOptional({ default: 300, minimum: 30, maximum: 3600 })
    @IsInt()
    @Min(30)
    @Max(3600)
    @IsOptional()
    @Type(() => Number)
    pollingInterval?: number;
}

export class UpdateDeviceDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    hostname?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    ipAddress?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiPropertyOptional({ enum: ['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'] })
    @IsEnum(['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'])
    @IsOptional()
    deviceType?: string;

    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    locationId?: number;

    @ApiPropertyOptional({ enum: ['v1', 'v2c', 'v3'] })
    @IsEnum(['v1', 'v2c', 'v3'])
    @IsOptional()
    snmpVersion?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpCommunity?: string;

    @ApiPropertyOptional()
    @IsInt()
    @Min(1)
    @Max(65535)
    @IsOptional()
    @Type(() => Number)
    snmpPort?: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3User?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3AuthProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3AuthPass?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3PrivProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3PrivPass?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    pollingEnabled?: boolean;

    @ApiPropertyOptional()
    @IsInt()
    @Min(30)
    @Max(3600)
    @IsOptional()
    @Type(() => Number)
    pollingInterval?: number;

    @ApiPropertyOptional({ enum: ['up', 'down', 'warning', 'maintenance', 'unknown'] })
    @IsEnum(['up', 'down', 'warning', 'maintenance', 'unknown'])
    @IsOptional()
    status?: string;
}

export class DeviceQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 25 })
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    limit?: number = 25;

    @ApiPropertyOptional({ enum: ['up', 'down', 'warning', 'maintenance', 'unknown'] })
    @IsEnum(['up', 'down', 'warning', 'maintenance', 'unknown'])
    @IsOptional()
    status?: string;

    @ApiPropertyOptional({ enum: ['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'] })
    @IsEnum(['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'])
    @IsOptional()
    type?: string;

    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    locationId?: number;

    @ApiPropertyOptional({ description: 'Search by hostname, IP, or display name' })
    @IsString()
    @IsOptional()
    @Transform(({ value }) => value?.trim())
    search?: string;
}

export class BulkDeleteDeviceDto {
    @ApiProperty({ type: [Number], example: [1, 2, 3] })
    @IsArray()
    @ArrayMinSize(1)
    @IsInt({ each: true })
    @Type(() => Number)
    ids: number[];
}

export class TestSnmpDto {
    @ApiProperty({ example: '10.0.1.1' })
    @IsString()
    @IsNotEmpty()
    ipAddress: string;

    @ApiPropertyOptional({ example: 161, default: 161 })
    @IsInt()
    @Min(1)
    @Max(65535)
    @IsOptional()
    @Type(() => Number)
    snmpPort?: number;

    @ApiPropertyOptional({ enum: ['v1', 'v2c', 'v3'], default: 'v2c' })
    @IsEnum(['v1', 'v2c', 'v3'])
    @IsOptional()
    snmpVersion?: string;

    @ApiPropertyOptional({ example: 'public' })
    @IsString()
    @IsOptional()
    snmpCommunity?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3User?: string;

    @ApiPropertyOptional({ enum: ['MD5', 'SHA', 'SHA256'] })
    @IsString()
    @IsOptional()
    snmpV3AuthProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3AuthPass?: string;

    @ApiPropertyOptional({ enum: ['DES', 'AES', 'AES256'] })
    @IsString()
    @IsOptional()
    snmpV3PrivProto?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    snmpV3PrivPass?: string;
}

