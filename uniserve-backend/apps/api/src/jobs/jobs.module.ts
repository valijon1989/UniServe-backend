import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobListing, JobListingSchema } from './schemas/job-listing.schema';
import { JobInquiry, JobInquirySchema } from './schemas/job-inquiry.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JobListing.name, schema: JobListingSchema },
      { name: JobInquiry.name, schema: JobInquirySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
