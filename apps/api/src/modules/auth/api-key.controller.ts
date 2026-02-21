import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiKeyService } from './api-key.service';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth/api-keys')
export class ApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    @Post()
    @ApiOperation({ summary: 'Generate a new API key' })
    create(
        @Req() req: any,
        @Body() dto: { name: string; expiresInDays?: number },
    ) {
        return this.apiKeyService.generateKey(req.user.id, dto.name, dto.expiresInDays);
    }

    @Get()
    @ApiOperation({ summary: 'List your API keys' })
    list(@Req() req: any) {
        return this.apiKeyService.listKeys(req.user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Revoke an API key' })
    revoke(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: any,
    ) {
        return this.apiKeyService.revokeKey(id, req.user.id);
    }
}
