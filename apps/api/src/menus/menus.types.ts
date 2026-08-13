import { RowDataPacket } from 'mysql2';

export interface MenuRow extends RowDataPacket {
  id: number;
  parent_id: number | null;
  code: string;
  label: string;
  route: string | null;
  icon: string | null;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  code: string;
  label: string;
  route: string | null;
  icon: string | null;
  children: MenuItem[];
}

export type MenusResponse =
  | {
      success: true;
      data: MenuItem[];
      message: null;
    }
  | {
      success: false;
      data: null;
      message: string;
      errorCode: 'INVALID_ROLE' | 'MENUS_SERVER_ERROR';
    };

export interface SystemMenuRow extends RowDataPacket {
  id: number;
  parentId: number | null;
  parentLabel: string | null;
  code: string;
  label: string;
  route: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean | number;
}

export interface MenuExistsRow extends RowDataPacket {
  id: number;
}

export interface SystemMenuPayload {
  code?: unknown;
  parentId?: unknown;
  label?: unknown;
  route?: unknown;
  icon?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
}

export interface SystemMenuStatusPayload {
  isActive?: unknown;
}

export type SystemMenuErrorCode =
  | 'MENU_NOT_FOUND'
  | 'MENU_CODE_REQUIRED'
  | 'MENU_LABEL_REQUIRED'
  | 'MENU_CODE_EXISTS'
  | 'MENU_PARENT_NOT_FOUND'
  | 'MENU_PARENT_SELF_REFERENCE'
  | 'MENU_PARENT_DESCENDANT'
  | 'MENU_INVALID_STATUS'
  | 'MENU_INVALID_SORT_ORDER'
  | 'MENUS_SERVER_ERROR';

export type SystemMenuResponse<T> =
  | {
      success: true;
      data: T;
      message: string | null;
    }
  | {
      success: false;
      data: null;
      message: string;
      errorCode: SystemMenuErrorCode;
    };
