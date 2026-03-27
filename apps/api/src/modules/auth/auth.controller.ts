import {
    Controller,
    Post,
    Get,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard, RequirePermission } from '../../common/guards/roles.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user account' })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto.username, dto.email, dto.password, dto.role);
    }

    @Post('login')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with username and password' })
    login(@Body() dto: LoginDto, @Request() req: any) {
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip;
        return this.authService.login(dto.username, dto.password, ip);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token using a refresh token' })
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto.refreshToken);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current authenticated user profile' })
    getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.id);
    }

    @Patch('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update own profile' })
    updateProfile(
        @Request() req: any,
        @Body() dto: { displayName?: string; fullName?: string; phone?: string },
    ) {
        return this.authService.updateProfile(req.user.id, dto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change own password' })
    changePassword(
        @Request() req: any,
        @Body() dto: { currentPassword: string; newPassword: string },
    ) {
        return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    }

    @Get('users')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('users:read')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all users (admin/operator)' })
    listUsers() {
        return this.authService.listUsers();
    }

    @Put('users/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('users:write')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a user (admin only)' })
    updateUser(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: { email?: string; displayName?: string; role?: string; isActive?: boolean },
    ) {
        return this.authService.updateUser(id, dto);
    }

    @Delete('users/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @RequirePermission('users:delete')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a user permanently (admin only)' })
    deleteUser(@Param('id', ParseIntPipe) id: number) {
        return this.authService.deleteUser(id);
    }
}
