import {
    IsString, IsOptional, IsInt, IsEnum, IsArray,
    IsDateString, MaxLength, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Enums (mirror Prisma) ──────────────────────────────

export enum TicketStatusEnum {
    open = 'open',
    in_progress = 'in_progress',
    waiting = 'waiting',
    escalated = 'escalated',
    on_hold = 'on_hold',
    resolved = 'resolved',
    closed = 'closed',
}

export enum TicketPriorityEnum {
    low = 'low',
    medium = 'medium',
    high = 'high',
    critical = 'critical',
}

export enum TicketCategoryEnum {
    incident = 'incident',
    problem = 'problem',
    change_request = 'change_request',
    maintenance = 'maintenance',
}

// ─── Create ─────────────────────────────────────────────

export class CreateTicketDto {
    @ApiProperty({ example: 'Core router unreachable' })
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    title: string;

    @ApiProperty({ example: 'MikroTik CCR1036 at DC-JKT has been unreachable since 14:30' })
    @IsString()
    @MinLength(3)
    description: string;

    @ApiPropertyOptional({ enum: TicketPriorityEnum })
    @IsOptional()
    @IsEnum(TicketPriorityEnum)
    priority?: TicketPriorityEnum;

    @ApiPropertyOptional({ enum: TicketCategoryEnum })
    @IsOptional()
    @IsEnum(TicketCategoryEnum)
    category?: TicketCategoryEnum;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    deviceId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    alertId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    assigneeId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

// ─── Update ─────────────────────────────────────────────

export class UpdateTicketDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ enum: TicketStatusEnum })
    @IsOptional()
    @IsEnum(TicketStatusEnum)
    status?: TicketStatusEnum;

    @ApiPropertyOptional({ enum: TicketPriorityEnum })
    @IsOptional()
    @IsEnum(TicketPriorityEnum)
    priority?: TicketPriorityEnum;

    @ApiPropertyOptional({ enum: TicketCategoryEnum })
    @IsOptional()
    @IsEnum(TicketCategoryEnum)
    category?: TicketCategoryEnum;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    assigneeId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

// ─── Query ──────────────────────────────────────────────

export class TicketQueryDto {
    @ApiPropertyOptional({ enum: TicketStatusEnum })
    @IsOptional()
    @IsEnum(TicketStatusEnum)
    status?: TicketStatusEnum;

    @ApiPropertyOptional({ enum: TicketPriorityEnum })
    @IsOptional()
    @IsEnum(TicketPriorityEnum)
    priority?: TicketPriorityEnum;

    @ApiPropertyOptional({ enum: TicketCategoryEnum })
    @IsOptional()
    @IsEnum(TicketCategoryEnum)
    category?: TicketCategoryEnum;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    assigneeId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    deviceId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    limit?: number;

    @ApiPropertyOptional({ default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ default: 'desc' })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}

// ─── Comment ────────────────────────────────────────────

export class CreateTicketCommentDto {
    @ApiProperty({ example: 'Escalated to network team, awaiting response.' })
    @IsString()
    @MinLength(1)
    content: string;

    @ApiProperty({ example: 1, required: false, description: 'Parent comment ID for threaded replies' })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    parentId?: number;
}

// ─── Assign ─────────────────────────────────────────────

export class AssignTicketDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Type(() => Number)
    assigneeId: number;
}
