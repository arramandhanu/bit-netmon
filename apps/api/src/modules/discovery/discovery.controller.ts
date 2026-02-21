import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { DiscoveryService } from './discovery.service';
import { DiscoveryScanDto } from './discovery.dto';

@ApiTags('Discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discovery')
export class DiscoveryController {
    constructor(private readonly discoveryService: DiscoveryService) { }

    @Post('scan')
    @RequirePermission('discovery:run')
    @ApiOperation({ summary: 'Start a subnet SNMP discovery scan' })
    startScan(@Body() dto: DiscoveryScanDto) {
        return this.discoveryService.startScan({
            subnets: dto.subnets,
            snmpCommunities: dto.snmpCommunities || ['public'],
            concurrency: dto.concurrency || 50,
            timeout: dto.timeout || 3000,
        });
    }

    @Get('status/:jobId')
    @RequirePermission('discovery:run')
    @ApiOperation({ summary: 'Check the status of a discovery scan job' })
    getStatus(@Param('jobId') jobId: string) {
        return this.discoveryService.getStatus(jobId);
    }
}
