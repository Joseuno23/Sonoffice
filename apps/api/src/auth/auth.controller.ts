import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangeRequiredPasswordRequest, ForgotPasswordRequest, LoginRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body);
  }

  @Post('change-required-password')
  async changeRequiredPassword(@Body() body: ChangeRequiredPasswordRequest) {
    return this.authService.changeRequiredPassword(body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordRequest) {
    return this.authService.forgotPassword(body);
  }
}
