import { IsString, IsOptional, IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateLocationDto {
    @ApiProperty({ example: 'Head Office Jakarta' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'LOC-001' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1, Jakarta' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({ example: -6.2088 })
    @IsOptional()
    @Type(() => Number)
    latitude?: number;

    @ApiPropertyOptional({ example: 106.8456 })
    @IsOptional()
    @Type(() => Number)
    longitude?: number;
}

export class UpdateLocationDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    code?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    latitude?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    longitude?: number;
}

export class LocationQueryDto {
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

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    @Transform(({ value }) => value?.trim())
    search?: string;
}
