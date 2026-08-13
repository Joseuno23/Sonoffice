import { RowDataPacket } from 'mysql2';

export interface RoleRow extends RowDataPacket {
  id: number;
  description: string;
  status: number;
  isActive: boolean | number;
  lastUpdate: Date | string | null;
  modifiedBy: number | null;
  usersCount: number;
  appMenuPermissionsCount: number;
}

export interface RoleExistsRow extends RowDataPacket {
  id: number;
}

export interface RoleMenuPermissionRow extends RowDataPacket {
  id: number;
  code: string;
  label: string;
  parentId: number | null;
  route: string | null;
  canView: boolean | number;
}

export interface RoleMenuPermissionsData {
  roleId: number;
  menus: RoleMenuPermissionRow[];
  implicitFullAccess?: boolean;
}

export interface MenuPermissionPayload {
  menuIds?: unknown;
}

export interface RolePayload {
  description?: unknown;
  isActive?: unknown;
}

export interface RoleStatusPayload {
  isActive?: unknown;
}

export type RoleErrorCode =
  | 'ROLE_NOT_FOUND'
  | 'ROLE_DESCRIPTION_REQUIRED'
  | 'ROLE_DESCRIPTION_TOO_LONG'
  | 'ROLE_DESCRIPTION_EXISTS'
  | 'ROLE_INVALID_STATUS'
  | 'ROLE_INVALID_MENU_PERMISSIONS'
  | 'ROLE_MENU_NOT_FOUND'
  | 'ROLE_ROOT_CANNOT_BE_DISABLED'
  | 'ROLES_SERVER_ERROR';

export type RoleResponse<T> =
  | {
      success: true;
      data: T;
      message: string | null;
    }
  | {
      success: false;
      data: null;
      message: string;
      errorCode: RoleErrorCode;
    };
