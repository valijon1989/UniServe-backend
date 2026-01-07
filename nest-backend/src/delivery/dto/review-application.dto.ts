import { IsIn, IsOptional, IsString } from 'class-validator';
import { AgentApplicationStatus } from '../../common/types/agent';

export class ReviewApplicationDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: AgentApplicationStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
