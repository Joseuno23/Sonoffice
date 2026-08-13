import { Controller, Get } from '@nestjs/common';
import { ROLES } from '../orders/data';

@Controller('dashboard')
export class DashboardController {
  @Get()
  get() {
    return {
      kpis: [
        { key: 'factory', value: '18', label: 'Órdenes activas', trend: '+3', up: true },
        { key: 'clock', value: '24', label: 'En proceso', trend: '+5', up: true },
        { key: 'shield', value: '42', label: 'Cerradas este mes', trend: '+12', up: true },
        { key: 'money', value: '$128M', label: 'Facturación del mes', trend: '-2%', up: false },
      ],
      roles: ROLES,
    };
  }
}
