import { IsEmail, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  identifier?: string; // email or username

  @IsOptional()
  username?: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
