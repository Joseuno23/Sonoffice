import { Controller, Get } from '@nestjs/common';
import { USERS } from '../orders/data';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return USERS;
  }
}
