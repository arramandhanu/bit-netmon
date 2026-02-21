import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
    @ApiProperty({
        description: 'Key-value map of settings to update',
        example: { 'snmp.defaultCommunity': 'public', 'polling.defaultInterval': '300' },
    })
    @IsObject()
    settings: Record<string, string>;
}
