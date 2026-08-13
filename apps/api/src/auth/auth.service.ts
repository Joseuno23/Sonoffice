import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthRepository, LegacyLoginUserRow } from './auth.repository';
import {
  ChangeRequiredPasswordRequest,
  ChangeRequiredPasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
} from './auth.types';
import { PasswordRecoveryEmailService } from './password-recovery-email.service';

const INVALID_CREDENTIALS_RESPONSE: LoginResponse = {
  success: false,
  data: null,
  message: 'Usuario o contraseña incorrectos',
  errorCode: 'INVALID_CREDENTIALS',
};

const CHANGE_REQUIRED_PASSWORD_INVALID_CREDENTIALS_RESPONSE: ChangeRequiredPasswordResponse = {
  success: false,
  data: null,
  message: 'Usuario o contraseña incorrectos',
  errorCode: 'INVALID_CREDENTIALS',
};

const AUTH_SERVER_ERROR_RESPONSE: LoginResponse = {
  success: false,
  data: null,
  message: 'No se pudo iniciar sesión en este momento',
  errorCode: 'AUTH_SERVER_ERROR',
};

const CHANGE_REQUIRED_PASSWORD_SERVER_ERROR_RESPONSE: ChangeRequiredPasswordResponse = {
  success: false,
  data: null,
  message: 'No se pudo actualizar la contraseña en este momento',
  errorCode: 'AUTH_SERVER_ERROR',
};

const FORGOT_PASSWORD_SUCCESS_RESPONSE: ForgotPasswordResponse = {
  success: true,
  data: { status: 'recovery_requested' },
  message: 'Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordRecoveryEmailService: PasswordRecoveryEmailService,
  ) {}

  async login(body: LoginRequest): Promise<LoginResponse> {
    const username = body?.username?.trim();
    const password = body?.password;

    if (!username || !password) {
      return INVALID_CREDENTIALS_RESPONSE;
    }

    try {
      const passwordHash = this.legacyPasswordHash(password);
      const user = await this.authRepository.findLegacyUserByCredentials(username, passwordHash);

      if (!user || Number(user.activ) !== 1) {
        return INVALID_CREDENTIALS_RESPONSE;
      }

      if (this.mustChangePassword(user.last_date)) {
        return {
          success: true,
          data: { status: 'change' },
          message: 'Debe cambiar la contraseña',
        };
      }

      const timesheets = await this.authRepository.hasTimesheets(user.id_users);
      const sessionContext = this.toSessionContext(user, timesheets);

      return {
        success: true,
        data: {
          status: 'success',
          user: {
            id: sessionContext.id,
            name: sessionContext.name,
            roleId: sessionContext.roleId,
            role: sessionContext.role,
          },
          session: sessionContext,
        },
        message: null,
      };
    } catch (error) {
      if (this.isDatabaseError(error)) {
        console.error('Login database error', this.toSafeDatabaseError(error));

        return AUTH_SERVER_ERROR_RESPONSE;
      }

      throw error;
    }
  }

  async changeRequiredPassword(
    body: ChangeRequiredPasswordRequest,
  ): Promise<ChangeRequiredPasswordResponse> {
    const username = body?.username?.trim();
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;
    const repeatPassword = body?.repeatPassword;

    const validationMessage = this.validateRequiredPasswordChangeInput(
      username,
      currentPassword,
      newPassword,
      repeatPassword,
    );

    if (validationMessage) {
      return {
        success: false,
        data: null,
        message: validationMessage,
        errorCode: 'PASSWORD_VALIDATION_ERROR',
      };
    }

    try {
      const currentPasswordHash = this.legacyPasswordHash(currentPassword);
      const user = await this.authRepository.findLegacyUserByCredentials(username, currentPasswordHash);

      if (!user || Number(user.activ) !== 1 || !this.mustChangePassword(user.last_date)) {
        return CHANGE_REQUIRED_PASSWORD_INVALID_CREDENTIALS_RESPONSE;
      }

      const newPasswordHash = this.legacyPasswordHash(newPassword);
      const affectedRows = await this.authRepository.updateLegacyUserPassword(user.id_users, newPasswordHash);

      if (affectedRows !== 1) {
        return CHANGE_REQUIRED_PASSWORD_SERVER_ERROR_RESPONSE;
      }

      return {
        success: true,
        data: { status: 'password_changed' },
        message: 'Contraseña actualizada correctamente',
      };
    } catch (error) {
      if (this.isDatabaseError(error)) {
        console.error('Required password change database error', this.toSafeDatabaseError(error));

        return CHANGE_REQUIRED_PASSWORD_SERVER_ERROR_RESPONSE;
      }

      throw error;
    }
  }

  async forgotPassword(body: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const email = body?.email?.trim().toLowerCase();

    if (!email || !this.isValidEmail(email)) {
      return {
        success: false,
        data: null,
        message: 'Ingresa un correo válido para recuperar tu contraseña.',
        errorCode: 'PASSWORD_RECOVERY_VALIDATION_ERROR',
      };
    }

    try {
      const user = await this.authRepository.findActiveUserForPasswordRecovery(email);

      if (!user) {
        return FORGOT_PASSWORD_SUCCESS_RESPONSE;
      }

      const temporaryPassword = this.generateTemporaryPassword();
      const temporaryPasswordHash = this.legacyPasswordHash(temporaryPassword);
      const affectedRows = await this.authRepository.setTemporaryPasswordForRecovery(
        user.id_users,
        temporaryPasswordHash,
      );

      if (affectedRows !== 1) {
        console.error('Password recovery update failed', { userId: user.id_users });
        return FORGOT_PASSWORD_SUCCESS_RESPONSE;
      }

      try {
        await this.passwordRecoveryEmailService.sendTemporaryPassword({
          toEmail: user.email || email,
          toName: user.name,
          temporaryPassword,
        });
      } catch (error) {
        await this.restorePasswordRecoveryStateSafely(user.id_users, user.password, user.last_date);
        console.error('Password recovery email error', this.toSafeEmailError(error));
      }

      return FORGOT_PASSWORD_SUCCESS_RESPONSE;
    } catch (error) {
      if (this.isDatabaseError(error)) {
        console.error('Password recovery database error', this.toSafeDatabaseError(error));
        return FORGOT_PASSWORD_SUCCESS_RESPONSE;
      }

      console.error('Password recovery unexpected error', this.toSafeEmailError(error));
      return FORGOT_PASSWORD_SUCCESS_RESPONSE;
    }
  }

  private validateRequiredPasswordChangeInput(
    username: string | undefined,
    currentPassword: string | undefined,
    newPassword: string | undefined,
    repeatPassword: string | undefined,
  ): string | null {
    if (!username || !currentPassword || !newPassword || !repeatPassword) {
      return 'Todos los campos son obligatorios';
    }

    if (newPassword !== repeatPassword) {
      return 'La nueva contraseña y su confirmación no coinciden';
    }

    if (!this.isStrongLegacyPassword(newPassword)) {
      return 'La contraseña debe tener mínimo 8 caracteres, una letra, una mayúscula, un número y un carácter especial';
    }

    return null;
  }

  private isStrongLegacyPassword(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Za-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isDatabaseError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      ('code' in error || 'errno' in error || 'sqlState' in error)
    );
  }

  private toSafeDatabaseError(error: unknown): Record<string, unknown> {
    if (typeof error !== 'object' || error === null) {
      return {};
    }

    const databaseError = error as Record<string, unknown>;

    return {
      code: databaseError.code,
      errno: databaseError.errno,
      sqlState: databaseError.sqlState,
    };
  }

  private toSafeEmailError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message === 'BREVO_CONFIG_MISSING' ? error.message : 'EMAIL_SEND_FAILED',
      };
    }

    if (typeof error === 'object' && error !== null) {
      const emailError = error as Record<string, unknown>;
      return {
        statusCode: emailError.statusCode,
        code: emailError.code,
      };
    }

    return {};
  }

  private async restorePasswordRecoveryStateSafely(
    userId: number,
    previousPasswordHash: string,
    previousLastDate: Date | string | null,
  ): Promise<void> {
    try {
      await this.authRepository.restorePasswordRecoveryState(
        userId,
        previousPasswordHash,
        previousLastDate,
      );
    } catch (restoreError) {
      console.error('Password recovery restore error', this.toSafeDatabaseError(restoreError));
    }
  }

  private generateTemporaryPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(10);
    const randomPart = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');

    return `So${randomPart}1!`;
  }

  private legacyPasswordHash(password: string): string {
    return this.md5(this.md5(password));
  }

  private md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  private mustChangePassword(lastDate: Date | string | null): boolean {
    if (!lastDate) {
      return false;
    }

    const lastPasswordDate = new Date(lastDate);

    if (Number.isNaN(lastPasswordDate.getTime())) {
      return false;
    }

    const today = new Date();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const elapsedDays = Math.floor(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(
          lastPasswordDate.getFullYear(),
          lastPasswordDate.getMonth(),
          lastPasswordDate.getDate(),
        )) /
        millisecondsPerDay,
    );

    return elapsedDays > 60;
  }

  private toSessionContext(user: LegacyLoginUserRow, timesheets: number) {
    return {
      id: user.id_users,
      userMedios: user.id_users_medios,
      name: user.name,
      roleId: user.rol,
      role: user.description,
      email: user.email,
      avatar: user.avatar,
      skin: user.skin,
      layout: user.layout,
      sidebar: user.sidebar,
      ip: user.ip,
      mac: user.mac_address,
      timesheets,
      google: false,
    };
  }
}
