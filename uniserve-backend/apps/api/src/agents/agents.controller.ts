import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors, Req, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request } from 'express';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

function filenameBuilder(_: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  cb(null, `${unique}${extname(file.originalname)}`);
}

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Roles('USER')
  @Post('apply')
  apply(@Body('agentType') agentType: 'seller' | 'service', @Req() req: Request) {
    return this.agentsService.apply((req.user as any)._id, agentType);
  }

  @Roles('AGENT')
  @Post('upload-faceid')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: filenameBuilder,
      }),
    }),
  )
  uploadFace(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const url = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/${file.filename}`;
    return this.agentsService.uploadFace((req.user as any)._id, url);
  }

  @Roles('AGENT')
  @Get('me')
  me(@Req() req: Request) {
    return this.agentsService.me((req.user as any)._id);
  }

  @Get()
  list() {
    return this.agentsService.listVerified();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.agentsService.detail(id);
  }
}
