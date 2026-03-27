import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiAnalyticsService } from './ai-analytics.service';
import { SettingsService } from '../settings/settings.service';

@ApiTags('AI Analytics')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiAnalyticsController {
    constructor(
        private readonly ai: AiAnalyticsService,
        private readonly settings: SettingsService,
    ) {}

    @Get('analyze/server/:id')
    @ApiOperation({ summary: 'AI analysis for a specific server' })
    async analyzeServer(@Param('id', ParseIntPipe) id: number) {
        return this.ai.analyzeServer(id);
    }

    @Get('analyze/fleet')
    @ApiOperation({ summary: 'AI analysis for the entire fleet' })
    async analyzeFleet() {
        return this.ai.analyzeFleet();
    }

    @Post('report')
    @ApiOperation({ summary: 'Generate AI-powered report' })
    async generateReport(@Body() body: { type: string; serverId?: number }) {
        return this.ai.generateReport(body);
    }

    @Post('test')
    @ApiOperation({ summary: 'Test Groq API connection' })
    async testConnection(@Body() body: { apiKey?: string }) {
        return this.ai.testConnection(body.apiKey);
    }

    @Get('status')
    @ApiOperation({ summary: 'Check if AI is configured' })
    async getStatus() {
        const key = await this.settings.get('ai.groqApiKey');
        return {
            configured: !!key,
            model: 'llama-3.3-70b-versatile',
            provider: 'Groq',
        };
    }
}
