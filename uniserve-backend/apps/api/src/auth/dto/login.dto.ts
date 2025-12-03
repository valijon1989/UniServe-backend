import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  identifier: string; // email

  @IsNotEmpty()
  password: string;
}
