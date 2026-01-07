import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgentType, DeliveryMode } from '../../common/types/agent';

export class RouteDto {
  @IsNotEmpty()
  @IsString()
  fromCountry: string;

  @IsOptional()
  @IsString()
  fromRegion?: string;

  @IsNotEmpty()
  @IsString()
  toCountry: string;

  @IsOptional()
  @IsString()
  toRegion?: string;
}

export class ApplyAgentDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['LOCAL', 'INTERNATIONAL'], { each: true })
  requestedTypes: AgentType[];

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  telegramHandle?: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  idDocumentUrl: string;

  @IsNotEmpty()
  @IsString()
  selfieUrl: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  faceMatchScore?: number;

  @IsNotEmpty()
  @IsString()
  paymentAccountNumber: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  smsCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceRegions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RouteDto)
  routes?: RouteDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['DOOR_TO_DOOR', 'DOOR_TO_AIRPORT', 'AIRPORT_TO_DOOR', 'AIRPORT_TO_AIRPORT'], {
    each: true,
  })
  deliveryModes?: DeliveryMode[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departureDates?: string[];
}
