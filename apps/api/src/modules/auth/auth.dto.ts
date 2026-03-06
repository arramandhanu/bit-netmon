import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'admin' })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ example: 'Admin123!' })
    @IsString()
    @IsNotEmpty()
    password: string;
}

export class RegisterDto {
    @ApiProperty({ example: 'admin' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    username: string;

    @ApiProperty({ example: 'admin@netmon.local' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Admin123!' })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiPropertyOptional({ example: 'viewer', enum: ['admin', 'operator', 'viewer'] })
    @IsOptional()
    @IsString()
    @IsIn(['admin', 'operator', 'viewer'], { message: 'Role must be one of: admin, operator, viewer' })
    role?: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
