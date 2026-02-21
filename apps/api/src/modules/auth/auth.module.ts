import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuditModule],
    controllers: [AuthController, ApiKeyController],
    providers: [AuthService, ApiKeyService, JwtStrategy, JwtAuthGuard],
    exports: [AuthService, ApiKeyService, JwtAuthGuard],
})
export class AuthModule { }
