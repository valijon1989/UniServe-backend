import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { AgentType } from '../../common/types/agent';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsArray()
  @IsIn(['LOCAL', 'INTERNATIONAL'], { each: true })
  agentIntent?: AgentType[];
}
