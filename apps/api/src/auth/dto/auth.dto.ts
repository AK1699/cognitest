import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema,
} from '@cognitest/shared';

// classes with a static zodSchema — picked up by the global ZodValidationPipe

export class SignupDto {
  static readonly zodSchema = signupRequestSchema;
  email!: string;
  username!: string;
  password!: string;
  displayName!: string;
  organizationName?: string;
}

export class LoginDto {
  static readonly zodSchema = loginRequestSchema;
  email!: string;
  password!: string;
}

export class VerifyEmailDto {
  static readonly zodSchema = verifyEmailRequestSchema;
  token!: string;
}

export class ResendVerificationDto {
  static readonly zodSchema = resendVerificationRequestSchema;
  email!: string;
}

export class ForgotPasswordDto {
  static readonly zodSchema = forgotPasswordRequestSchema;
  email!: string;
}

export class ResetPasswordDto {
  static readonly zodSchema = resetPasswordRequestSchema;
  token!: string;
  password!: string;
}
