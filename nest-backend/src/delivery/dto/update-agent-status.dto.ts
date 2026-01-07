import { IsArray, IsIn, IsOptional } from 'class-validator';
import { AgentStatus, AgentType } from '../../common/types/agent';

export class UpdateAgentStatusDto {
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'BLOCKED', 'INACTIVE', 'DELETED'])
  status?: AgentStatus;

  @IsOptional()
  @IsArray()
  @IsIn(['LOCAL', 'INTERNATIONAL'], { each: true })
  types?: AgentType[];
}
