import { IsArray, IsOptional, IsInt, Min, Max, IsString, ArrayMinSize, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DiscoveryScanDto {
    @ApiProperty({
        example: ['10.0.1.0/24', '192.168.1.0/24'],
        description: 'List of CIDR subnets to scan',
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    @Matches(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/, {
        each: true,
        message: 'Each subnet must be valid CIDR notation (e.g., 10.0.1.0/24)',
    })
    subnets: string[];

    @ApiPropertyOptional({
        example: ['public', 'private'],
        default: ['public'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    snmpCommunities?: string[];

    @ApiPropertyOptional({ example: 50, default: 50 })
    @IsInt()
    @Min(1)
    @Max(200)
    @IsOptional()
    @Type(() => Number)
    concurrency?: number;

    @ApiPropertyOptional({ example: 3000, default: 3000, description: 'SNMP timeout in ms' })
    @IsInt()
    @Min(1000)
    @Max(30000)
    @IsOptional()
    @Type(() => Number)
    timeout?: number;
}
