export type AgentType = 'LOCAL' | 'INTERNATIONAL';

export type AgentStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'INACTIVE' | 'DELETED';

export type AgentApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DeliveryMode =
  | 'DOOR_TO_DOOR'
  | 'DOOR_TO_AIRPORT'
  | 'AIRPORT_TO_DOOR'
  | 'AIRPORT_TO_AIRPORT';
