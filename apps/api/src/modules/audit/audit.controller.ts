import {
    Controller,
    Get,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './audit.dto';

@ApiTags('Audit')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {

    constructor(private readonly auditService: AuditService) { }

    @Get()
    @RequirePermission('audit:read')
    @ApiOperation({ summary: 'Get paginated audit logs' })
    findAll(@Query() query: AuditLogQueryDto) {
        return this.auditService.findAll(query);
    }

    @Get('stats')
    @RequirePermission('audit:read')
    @ApiOperation({ summary: 'Get security overview statistics' })
    getStats() {
        return this.auditService.getStats();
    }
}
