import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
  ) {}

  async getFeed(limit = 50) {
    return this.postModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'name username role avatarUrl')
      .exec();
  }
}
