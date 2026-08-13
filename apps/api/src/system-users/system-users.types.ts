import { RowDataPacket } from 'mysql2';

export interface SystemUserRow extends RowDataPacket {
  id: number;
  legacyUserId: number | null;
  idUsersMedios: number | null;
  name: string | null;
  cc: string | null;
  areaId: string | null;
  areaLabel: string | null;
  username: string | null;
  email: string | null;
  roleId: number | null;
  roleLabel: string | null;
  status: number | null;
  isActive: boolean | number;
  admissionDate: Date | string | null;
  timeSheets: number | null;
  avatar: string | null;
  avatarUrl?: string | null;
}

export interface SystemUserExistsRow extends RowDataPacket {
  id: number;
}

export interface SystemUserOptionRow extends RowDataPacket {
  id: number | string;
  label: string;
}

export interface SystemUserOption {
  id: number | string;
  label: string;
}

export interface SystemUserPayload {
  name?: unknown;
  cc?: unknown;
  areaId?: unknown;
  username?: unknown;
  email?: unknown;
  roleId?: unknown;
  admissionDate?: unknown;
  timeSheets?: unknown;
  avatar?: unknown;
  isActive?: unknown;
}

export interface SystemUserStatusPayload {
  isActive?: unknown;
}

export interface SystemUserOptions {
  roles: SystemUserOption[];
  areas: SystemUserOption[];
  avatars: SystemUserOption[];
}

export type SystemUsersErrorCode =
  | 'SYSTEM_USER_NOT_FOUND'
  | 'SYSTEM_USER_NAME_REQUIRED'
  | 'SYSTEM_USER_NAME_TOO_LONG'
  | 'SYSTEM_USER_CC_REQUIRED'
  | 'SYSTEM_USER_CC_TOO_LONG'
  | 'SYSTEM_USER_AREA_REQUIRED'
  | 'SYSTEM_USER_USERNAME_REQUIRED'
  | 'SYSTEM_USER_USERNAME_TOO_LONG'
  | 'SYSTEM_USER_USERNAME_EXISTS'
  | 'SYSTEM_USER_EMAIL_REQUIRED'
  | 'SYSTEM_USER_EMAIL_TOO_LONG'
  | 'SYSTEM_USER_EMAIL_INVALID'
  | 'SYSTEM_USER_EMAIL_EXISTS'
  | 'SYSTEM_USER_ROLE_REQUIRED'
  | 'SYSTEM_USER_ROLE_NOT_FOUND'
  | 'SYSTEM_USER_AREA_NOT_FOUND'
  | 'SYSTEM_USER_INVALID_DATE'
  | 'SYSTEM_USER_INVALID_STATUS'
  | 'SYSTEM_USER_AVATAR_REQUIRED'
  | 'SYSTEM_USER_AVATAR_INVALID_TYPE'
  | 'SYSTEM_USER_AVATAR_TOO_LARGE'
  | 'SYSTEM_USERS_SERVER_ERROR';

export type SystemUserResponse<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: null; message: string; errorCode: SystemUsersErrorCode };
