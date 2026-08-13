import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NormalizedSystemUserPayload, SystemUsersRepository } from './system-users.repository';
import { AVATARS_DIR } from '../uploads-path';
import {
  SystemUserOptions,
  SystemUserPayload,
  SystemUserResponse,
  SystemUserRow,
  SystemUserStatusPayload,
} from './system-users.types';

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class SystemUsersService {
  constructor(private readonly systemUsersRepository: SystemUsersRepository) {}

  async listUsers(): Promise<SystemUserResponse<SystemUserRow[]>> {
    try {
      const rows = await this.systemUsersRepository.findAll();
      return { success: true, data: rows.map((row) => this.normalizeUser(row)), message: null };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async getUser(rawId: unknown): Promise<SystemUserResponse<SystemUserRow>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.userNotFoundResponse();

    try {
      const row = await this.systemUsersRepository.findById(id);
      if (!row) return this.userNotFoundResponse();
      return { success: true, data: this.normalizeUser(row), message: null };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async createUser(payload: SystemUserPayload): Promise<SystemUserResponse<SystemUserRow>> {
    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);
    if (validationError) return validationError;

    try {
      const duplicateError = await this.validateReferencesAndUniqueness(normalized);
      if (duplicateError) return duplicateError;

      const id = await this.systemUsersRepository.create(normalized);
      const row = await this.systemUsersRepository.findById(id);

      return {
        success: true,
        data: this.normalizeUser(row),
        message: 'Usuario creado correctamente. Deberá cambiar la contraseña al ingresar.',
      };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async updateUser(rawId: unknown, payload: SystemUserPayload): Promise<SystemUserResponse<SystemUserRow>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.userNotFoundResponse();

    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);
    if (validationError) return validationError;

    try {
      const current = await this.systemUsersRepository.findById(id);
      if (!current) return this.userNotFoundResponse();

      normalized.avatar = current.avatar ?? null;

      const duplicateError = await this.validateReferencesAndUniqueness(normalized, id);
      if (duplicateError) return duplicateError;

      await this.systemUsersRepository.update(id, normalized);
      const row = await this.systemUsersRepository.findById(id);

      return { success: true, data: this.normalizeUser(row), message: 'Usuario actualizado correctamente' };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async updateUserStatus(rawId: unknown, payload: SystemUserStatusPayload): Promise<SystemUserResponse<SystemUserRow>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.userNotFoundResponse();

    const isActive = this.toBoolean(payload?.isActive);
    if (isActive === null) {
      return { success: false, data: null, message: 'El estado del usuario es inválido', errorCode: 'SYSTEM_USER_INVALID_STATUS' };
    }

    try {
      const current = await this.systemUsersRepository.findById(id);
      if (!current) return this.userNotFoundResponse();

      await this.systemUsersRepository.updateStatus(id, isActive);
      const row = await this.systemUsersRepository.findById(id);

      return {
        success: true,
        data: this.normalizeUser(row),
        message: isActive ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente',
      };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async uploadAvatar(rawId: unknown, file: any): Promise<SystemUserResponse<SystemUserRow>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.userNotFoundResponse();

    if (!file) {
      return { success: false, data: null, message: 'Selecciona una imagen válida para el avatar', errorCode: 'SYSTEM_USER_AVATAR_REQUIRED' };
    }

    if (file.size > AVATAR_MAX_SIZE) {
      return { success: false, data: null, message: 'La imagen del avatar no puede superar 2 MB', errorCode: 'SYSTEM_USER_AVATAR_TOO_LARGE' };
    }

    const extension = AVATAR_EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      return { success: false, data: null, message: 'El avatar debe ser una imagen JPG, PNG, WebP o GIF', errorCode: 'SYSTEM_USER_AVATAR_INVALID_TYPE' };
    }

    try {
      const current = await this.systemUsersRepository.findById(id);
      if (!current) return this.userNotFoundResponse();

      await mkdir(AVATARS_DIR, { recursive: true });
      const avatar = `u${id}-${randomBytes(6).toString('hex')}.${extension}`;
      await writeFile(join(AVATARS_DIR, avatar), file.buffer);
      await this.systemUsersRepository.updateAvatar(id, avatar);
      const row = await this.systemUsersRepository.findById(id);

      return { success: true, data: this.normalizeUser(row), message: 'Avatar actualizado correctamente' };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async resetPassword(rawId: unknown): Promise<SystemUserResponse<{ id: number; mustChangePassword: true }>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.userNotFoundResponse();

    try {
      const current = await this.systemUsersRepository.findById(id);
      if (!current) return this.userNotFoundResponse();

      await this.systemUsersRepository.resetPassword(id);
      return {
        success: true,
        data: { id, mustChangePassword: true },
        message: 'Contraseña restablecida correctamente. El usuario deberá cambiarla al ingresar.',
      };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  async getOptions(): Promise<SystemUserResponse<SystemUserOptions>> {
    try {
      const [roles, areas] = await Promise.all([
        this.systemUsersRepository.findActiveRoles(),
        this.systemUsersRepository.findActiveAreas(),
      ]);

      return {
        success: true,
        data: {
          roles: roles.map((role) => ({ id: Number(role.id), label: role.label ?? '' })),
          areas: areas.map((area) => ({ id: String(area.id), label: area.label ?? '' })),
          avatars: [],
        },
        message: null,
      };
    } catch (error) {
      return this.handleUsersError(error);
    }
  }

  private normalizePayload(payload: SystemUserPayload): NormalizedSystemUserPayload {
    return {
      name: this.toTrimmedString(payload?.name),
      cc: this.toTrimmedString(payload?.cc),
      areaId: this.toTrimmedString(payload?.areaId),
      username: this.toTrimmedString(payload?.username),
      email: this.toTrimmedString(payload?.email).toLowerCase(),
      roleId: this.toPositiveInteger(payload?.roleId) ?? 0,
      admissionDate: this.toDateString(payload?.admissionDate),
      timeSheets: this.toBoolean(payload?.timeSheets) ? 1 : 0,
      avatar: this.toNullableString(payload?.avatar),
      isActive: this.toBoolean(payload?.isActive) ?? true,
    };
  }

  private validatePayload(payload: NormalizedSystemUserPayload): SystemUserResponse<null> | null {
    if (!payload.name) return { success: false, data: null, message: 'El nombre del usuario es obligatorio', errorCode: 'SYSTEM_USER_NAME_REQUIRED' };
    if (payload.name.length > 50) return { success: false, data: null, message: 'El nombre no puede superar 50 caracteres', errorCode: 'SYSTEM_USER_NAME_TOO_LONG' };
    if (!payload.cc) return { success: false, data: null, message: 'El documento del usuario es obligatorio', errorCode: 'SYSTEM_USER_CC_REQUIRED' };
    if (payload.cc.length > 50) return { success: false, data: null, message: 'El documento no puede superar 50 caracteres', errorCode: 'SYSTEM_USER_CC_TOO_LONG' };
    if (!payload.areaId) return { success: false, data: null, message: 'El área del usuario es obligatoria', errorCode: 'SYSTEM_USER_AREA_REQUIRED' };
    if (!payload.username) return { success: false, data: null, message: 'El usuario de ingreso es obligatorio', errorCode: 'SYSTEM_USER_USERNAME_REQUIRED' };
    if (payload.username.length > 50) return { success: false, data: null, message: 'El usuario de ingreso no puede superar 50 caracteres', errorCode: 'SYSTEM_USER_USERNAME_TOO_LONG' };
    if (!payload.email) return { success: false, data: null, message: 'El correo del usuario es obligatorio', errorCode: 'SYSTEM_USER_EMAIL_REQUIRED' };
    if (payload.email.length > 50) return { success: false, data: null, message: 'El correo no puede superar 50 caracteres', errorCode: 'SYSTEM_USER_EMAIL_TOO_LONG' };
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return { success: false, data: null, message: 'El correo del usuario es inválido', errorCode: 'SYSTEM_USER_EMAIL_INVALID' };
    if (!payload.roleId) return { success: false, data: null, message: 'El rol del usuario es obligatorio', errorCode: 'SYSTEM_USER_ROLE_REQUIRED' };
    if (payload.admissionDate === undefined) return { success: false, data: null, message: 'La fecha de ingreso es inválida', errorCode: 'SYSTEM_USER_INVALID_DATE' };
    return null;
  }

  private async validateReferencesAndUniqueness(payload: NormalizedSystemUserPayload, excludeId?: number): Promise<SystemUserResponse<null> | null> {
    const existingUsername = await this.systemUsersRepository.findByUsername(payload.username, excludeId);
    if (existingUsername) return { success: false, data: null, message: 'Ya existe un usuario con ese usuario de ingreso', errorCode: 'SYSTEM_USER_USERNAME_EXISTS' };

    const existingEmail = await this.systemUsersRepository.findByEmail(payload.email, excludeId);
    if (existingEmail) return { success: false, data: null, message: 'Ya existe un usuario con ese correo', errorCode: 'SYSTEM_USER_EMAIL_EXISTS' };

    const roleExists = await this.systemUsersRepository.roleExists(payload.roleId);
    if (!roleExists) return { success: false, data: null, message: 'El rol seleccionado no existe o está inactivo', errorCode: 'SYSTEM_USER_ROLE_NOT_FOUND' };

    const areaExists = await this.systemUsersRepository.areaExists(payload.areaId);
    if (!areaExists) return { success: false, data: null, message: 'El área seleccionada no existe o está inactiva', errorCode: 'SYSTEM_USER_AREA_NOT_FOUND' };

    return null;
  }

  private normalizeUser(row: SystemUserRow): SystemUserRow {
    return {
      ...row,
      id: Number(row.id),
      legacyUserId: row.legacyUserId ?? null,
      idUsersMedios: row.idUsersMedios ?? row.legacyUserId ?? null,
      name: row.name ?? '',
      cc: row.cc ?? '',
      areaId: row.areaId ?? '',
      areaLabel: row.areaLabel ?? null,
      username: row.username ?? '',
      email: row.email ?? '',
      roleId: row.roleId ?? null,
      roleLabel: row.roleLabel ?? null,
      status: Number(row.status ?? 2),
      isActive: row.status === 1 || row.isActive === true || row.isActive === 1,
      admissionDate: row.admissionDate ?? null,
      timeSheets: Number(row.timeSheets ?? 0),
      avatar: row.avatar ?? null,
      avatarUrl: this.toAvatarUrl(row.avatar),
    };
  }

  private toAvatarUrl(avatar: string | null): string | null {
    if (!avatar || !/^[A-Za-z0-9._-]+$/.test(avatar)) return null;
    return `/uploads/avatars/${encodeURIComponent(avatar)}`;
  }

  private toPositiveInteger(value: unknown): number | null {
    if (Array.isArray(value)) return null;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || normalized === null || normalized === undefined) return null;
    const id = Number(normalized);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private toTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableString(value: unknown): string | null {
    const text = this.toTrimmedString(value);
    return text || null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    if (value === null || value === undefined || value === '') return null;
    return null;
  }

  private toDateString(value: unknown): string | null | undefined {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? undefined : text;
  }

  private userNotFoundResponse(): SystemUserResponse<null> {
    return { success: false, data: null, message: 'Usuario no encontrado', errorCode: 'SYSTEM_USER_NOT_FOUND' };
  }

  private handleUsersError(error: unknown): SystemUserResponse<null> {
    if (this.isDatabaseError(error)) {
      console.error('System users database error', this.toSafeDatabaseError(error));
      return { success: false, data: null, message: 'No se pudo procesar el usuario en este momento', errorCode: 'SYSTEM_USERS_SERVER_ERROR' };
    }

    throw error;
  }

  private isDatabaseError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && ('code' in error || 'errno' in error || 'sqlState' in error);
  }

  private toSafeDatabaseError(error: unknown): Record<string, unknown> {
    if (typeof error !== 'object' || error === null) return {};
    const databaseError = error as Record<string, unknown>;
    return { code: databaseError.code, errno: databaseError.errno, sqlState: databaseError.sqlState };
  }
}
