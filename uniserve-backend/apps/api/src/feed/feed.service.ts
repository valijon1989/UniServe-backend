import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class FeedService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createPost(authorId: string, body: any) {
    return this.postModel.create({
      author: authorId,
      text: body.text,
      images: body.images || [],
      videoUrl: body.videoUrl,
      visibility: body.visibility || 'public',
    });
  }

  async feedFor(userId: string) {
    const user = await this.userModel.findById(userId);
    const followingIds = (user?.following || []).map((f) => f.toString());
    return this.postModel
      .find({
        $or: [{ visibility: 'public' }, { author: { $in: followingIds } }, { author: userId }],
      })
      .sort({ _id: -1 });
  }

  async byId(id: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async like(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (!post.likes) post.likes = [];
    const exists = post.likes.some((u) => u.toString() === userId);
    if (!exists) post.likes.push(new Types.ObjectId(userId));
    await post.save();
    return post;
  }

  async unlike(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    post.likes = (post.likes || []).filter((u) => u.toString() !== userId);
    await post.save();
    return post;
  }

  async comment(postId: string, authorId: string, text: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (!text) throw new BadRequestException('Text required');
    return this.commentModel.create({ post: postId, author: authorId, text });
  }

  async comments(postId: string) {
    return this.commentModel.find({ post: postId }).populate('author', 'name email');
  }

  async delete(postId: string, userId: string, isAdmin: boolean) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (!isAdmin && post.author.toString() !== userId) throw new BadRequestException('Forbidden');
    await post.remove();
    return { ok: true };
  }
}
