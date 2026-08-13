export interface LoginRequest {
  username?: string;
  password?: string;
}

export interface ChangeRequiredPasswordRequest {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
  repeatPassword?: string;
}

export interface ForgotPasswordRequest {
  email?: string;
}

export interface AuthUser {
  id: number;
  name: string;
  roleId: number;
  role: string;
}

export interface AuthSessionContext extends AuthUser {
  userMedios: number | null;
  email: string | null;
  avatar: string | null;
  skin: string | null;
  layout: string | null;
  sidebar: string | null;
  ip: string | null;
  mac: string | null;
  timesheets: number;
  google: boolean;
}

export type LoginResponse =
  | {
      success: true;
      data: {
        status: 'success';
        user: AuthUser;
        session: AuthSessionContext;
      };
      message: null;
    }
  | {
      success: true;
      data: { status: 'change' };
      message: 'Debe cambiar la contraseña';
    }
  | {
      success: false;
      data: null;
      message: 'Usuario o contraseña incorrectos';
      errorCode: 'INVALID_CREDENTIALS';
    }
  | {
      success: false;
      data: null;
      message: 'No se pudo iniciar sesión en este momento';
      errorCode: 'AUTH_SERVER_ERROR';
    };

export type ChangeRequiredPasswordResponse =
  | {
      success: true;
      data: { status: 'password_changed' };
      message: 'Contraseña actualizada correctamente';
    }
  | {
      success: false;
      data: null;
      message: string;
      errorCode: 'INVALID_CREDENTIALS' | 'PASSWORD_VALIDATION_ERROR' | 'AUTH_SERVER_ERROR';
    };

export type ForgotPasswordResponse =
  | {
      success: true;
      data: { status: 'recovery_requested' };
      message: 'Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.';
    }
  | {
      success: false;
      data: null;
      message: string;
      errorCode: 'PASSWORD_RECOVERY_VALIDATION_ERROR';
    };
