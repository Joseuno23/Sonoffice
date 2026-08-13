import { RowDataPacket } from 'mysql2';

export interface ActionCodeRow extends RowDataPacket {
  action_code: string;
}

export interface ActionRow extends RowDataPacket {
  id: number;
  moduleCode: string;
  actionCode: string;
  code: string;
  label: string;
  description: string | null;
  isActive: number | boolean;
}

// Fila de acción con el flag de si el rol la tiene concedida (para la pantalla de asignación).
export interface RoleActionRow extends RowDataPacket {
  id: number;
  moduleCode: string;
  code: string;
  label: string;
  granted: number | null;
}

export interface RoleActionItem {
  id: number;
  code: string;
  label: string;
  granted: boolean;
}

export interface RoleActionModule {
  moduleCode: string;
  actions: RoleActionItem[];
}

export interface RoleActionPermissionsData {
  roleId: number;
  modules: RoleActionModule[];
  implicitFullAccess?: boolean;
}
