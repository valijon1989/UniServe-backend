import { Request, Response } from "express";
import mongoose, { PipelineStage } from "mongoose";
import path from "path";
import { z } from "zod";
import { Post } from "../models/Post";
import { PostReaction, ReactionValue } from "../models/PostReaction";
import { Comment } from "../models/Comment";
import { User } from "../models/User";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { resolveAvatarUrl } from "../utils/avatarImage";
import {
  getCategoryDisplay,
  getPostTypeLabel,
  resolveLocalizedTextField
} from "../services/localizedContent";
import { respondAuthRequired } from "../utils/controllerResponses";

const createPostSchema = z.object({
  text: z.string().trim().max(5000).optional(),
  linkUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  category: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(80).optional()
  ),
  type: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(40).optional()
  )
});

const commentSchema = z.object({
  text: z.string().trim().min(1).max(2000)
});

const slugifyText = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const buildSlugBase = (text?: string) => {
  const fromText = slugifyText(text || "");
  if (fromText) return fromText;
  return `post-${Date.now().toString(36)}`;
};

const buildUniqueSlug = async (base: string) => {
  let slug = base;
  let attempt = 0;
  while (await Post.exists({ slug })) {
    attempt += 1;
    slug = `${base}-${attempt}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return slug;
};

const parsePositiveInt = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const parseSort = (sortValue: unknown): Record<string, mongoose.SortOrder> => {
  const sort = typeof sortValue === "string" ? sortValue.toLowerCase() : "";
  if (sort === "desc" || sort === "new" || sort === "latest" || sort === "-createdat") {
    return { createdAt: -1, _id: -1 };
  }
  return { createdAt: 1, _id: 1 };
};

const toAuthorDto = (author: any) => {
  if (!author) return null;
  const id = String(author._id || "");
  const nickname = author.username || author.nickname || author.name || "user";
  return {
    _id: id,
    nickname,
    username: author.username || nickname,
    avatarUrl: resolveAvatarUrl(author.avatarUrl, id)
  };
};

export const formatPost = (post: any, options?: any) => {
  const safeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const raw = post?.toObject ? post.toObject() : post;
  const locale = safeOptions.locale as Request["locale"] | undefined;
  const media = Array.isArray(raw?.media) ? raw.media : [];
  const images = media.filter((item: any) => item?.type === "image").map((item: any) => item.url);
  const videos = media.filter((item: any) => item?.type === "video").map((item: any) => item.url);
  const likeCount =
    typeof raw?.likeCount === "number" ? raw.likeCount : Array.isArray(raw?.likes) ? raw.likes.length : 0;
  const categoryLabel = getCategoryDisplay(raw?.category, locale).label;
  const typeLabel = getPostTypeLabel(raw?.type || "post", locale);

  return {
    _id: String(raw?._id || ""),
    slug: raw?.slug || undefined,
    text:
      resolveLocalizedTextField(raw, "text", locale, "") ||
      resolveLocalizedTextField(raw, "content", locale, "") ||
      resolveLocalizedTextField(raw, "excerpt", locale, ""),
    title: resolveLocalizedTextField(raw, "title", locale, raw?.title || ""),
    linkUrl: raw?.linkUrl || raw?.sourceUrl || undefined,
    category: raw?.category || "social",
    categoryLabel,
    type: raw?.type || "social",
    typeLabel,
    media: media.map((item: any) => ({
      url: item.url,
      type: item.type,
      ...(item.width ? { width: item.width } : {}),
      ...(item.height ? { height: item.height } : {}),
      ...(item.duration ? { duration: item.duration } : {})
    })),
    images: images.length ? images : Array.isArray(raw?.images) ? raw.images : [],
    videos: videos,
    likeCount,
    dislikeCount: typeof raw?.dislikeCount === "number" ? raw.dislikeCount : 0,
    commentCount:
      typeof raw?.commentCount === "number"
        ? raw.commentCount
        : Array.isArray(raw?.comments)
          ? raw.comments.length
          : 0,
    shareCount: typeof raw?.shareCount === "number" ? raw.shareCount : 0,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
    author: toAuthorDto((safeOptions as any).author || raw?.author || raw?.authorId),
    ...((safeOptions as any).reaction !== undefined ? { myReaction: (safeOptions as any).reaction } : {}),
    ...((safeOptions as any).currentUserId
      ? { isMine: String(raw?.authorId || raw?.author) === String((safeOptions as any).currentUserId) }
      : {})
  };
};

const getPostFilter = (idOrSlug: string) => {
  if (mongoose.isValidObjectId(idOrSlug)) return { _id: idOrSlug };
  return { slug: idOrSlug };
};

const findPostByIdOrSlug = async (idOrSlug: string) => {
  return Post.findOne(getPostFilter(idOrSlug)).lean();
};

const getAuthorMap = async (posts: any[]) => {
  const ids = Array.from(
    new Set(
      posts
        .map((post) => String(post.authorId || post.author || ""))
        .filter((id) => id && mongoose.isValidObjectId(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  if (!ids.length) return new Map<string, any>();
  const users = await User.find({ _id: { $in: ids } }, { username: 1, name: 1, avatarUrl: 1 }).lean();
  const map = new Map<string, any>();
  for (const user of users) {
    map.set(String(user._id), user);
  }
  return map;
};

const getReactionMap = async (postIds: string[], currentUserId?: string) => {
  if (!currentUserId || !postIds.length) return new Map<string, ReactionValue>();
  const objectIds = postIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return new Map<string, ReactionValue>();

  const reactions = await PostReaction.find({
    postId: { $in: objectIds },
    userId: new mongoose.Types.ObjectId(currentUserId)
  }).lean();

  const map = new Map<string, ReactionValue>();
  for (const reaction of reactions) {
    map.set(String(reaction.postId), reaction.value);
  }
  return map;
};

const syncReactionStats = async (postId: mongoose.Types.ObjectId) => {
  const grouped = await PostReaction.aggregate<{ _id: ReactionValue; count: number }>([
    { $match: { postId } },
    { $group: { _id: "$value", count: { $sum: 1 } } }
  ]);

  let likeCount = 0;
  let dislikeCount = 0;
  grouped.forEach((row) => {
    if (row._id === "like") likeCount = row.count;
    if (row._id === "dislike") dislikeCount = row.count;
  });

  const likedUserIds = await PostReaction.find({ postId, value: "like" }, { userId: 1 }).lean();
  const likes = likedUserIds.map((row) => row.userId);

  await Post.updateOne(
    { _id: postId },
    {
      $set: {
        likeCount,
        dislikeCount,
        likes
      }
    }
  );

  return { likeCount, dislikeCount };
};

const syncCommentCount = async (postId: mongoose.Types.ObjectId) => {
  const count = await Comment.countDocuments({ postId });
  await Post.updateOne({ _id: postId }, { $set: { commentCount: count } });
  return count;
};

export const listPosts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const sort = parseSort(req.query.sort);

    const type = typeof req.query.type === "string" && req.query.type.trim() ? req.query.type.trim().toLowerCase() : "social";
    const category = typeof req.query.category === "string" && req.query.category.trim() ? req.query.category.trim().toLowerCase() : undefined;

    const filters: Record<string, any> = { isActive: true, status: "active", type };
    if (category) filters.category = category;

    const [total, posts] = await Promise.all([
      Post.countDocuments(filters),
      Post.find(filters).sort(sort).skip(skip).limit(limit).lean()
    ]);

    const authorMap = await getAuthorMap(posts);
    const postIds = posts.map((post) => String(post._id));
    const reactionMap = await getReactionMap(postIds, req.user?._id);

    const items = posts.map((post) =>
      formatPost(post, {
        author: authorMap.get(String(post.authorId || post.author || "")),
        currentUserId: req.user?._id,
        reaction: reactionMap.get(String(post._id)) || null,
        locale: req.locale
      })
    );

    return res.json({ items, page, limit, total });
  } catch (err) {
    console.error("listPosts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const parsed = createPostSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const files = ((req.files as any[]) || []).slice(0, 4);
    const media = files.map((file) => {
      const relative = `/static/posts/${path.basename(file.filename || file.path || file.originalname)}`;
      const url = ensureAbsoluteUrl(relative) || relative;
      return {
        url,
        type: file.mimetype.startsWith("video/") ? "video" : "image"
      } as const;
    });

    const text = parsed.data.text?.trim() || "";
    const linkUrl = parsed.data.linkUrl;
    if (!text && !linkUrl && media.length === 0) {
      return res.status(400).json({ message: "Post requires text, media, or linkUrl" });
    }

    const category = (parsed.data.category || "social").toLowerCase();
    const type = (parsed.data.type || req.query.type || "social").toString().toLowerCase();
    const slug = await buildUniqueSlug(buildSlugBase(text || linkUrl || "post"));
    const imageUrls = media.filter((item) => item.type === "image").map((item) => item.url);
    const firstVideo = media.find((item) => item.type === "video")?.url;

    const post = await Post.create({
      author: req.user._id,
      authorId: req.user._id,
      title: text ? text.slice(0, 120) : "",
      slug,
      excerpt: text ? text.slice(0, 180) : "",
      content: text,
      text,
      media,
      images: imageUrls,
      videoUrl: firstVideo || "",
      category,
      type,
      linkUrl,
      sourceUrl: linkUrl,
      attachments: media.map((item) => ({ type: item.type, url: item.url })),
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
      shareCount: 0,
      likes: [],
      reports: 0,
      status: "active",
      isActive: true
    });

    const author = await User.findById(req.user._id, { username: 1, name: 1, avatarUrl: 1 }).lean();
    return res.status(201).json({ post: formatPost(post, { author, currentUserId: req.user._id, reaction: null, locale: req.locale }) });
  } catch (err) {
    console.error("createPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPostByIdOrSlug = async (req: Request, res: Response) => {
  try {
    const idOrSlug = req.params.idOrSlug || req.params.id;
    const post = await findPostByIdOrSlug(idOrSlug);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const author = await User.findById(post.authorId || post.author, { username: 1, name: 1, avatarUrl: 1 }).lean();
    const reaction =
      req.user?._id && mongoose.isValidObjectId(String(post._id))
        ? await PostReaction.findOne({
            postId: new mongoose.Types.ObjectId(String(post._id)),
            userId: new mongoose.Types.ObjectId(req.user._id)
          }).lean()
        : null;

    return res.json({
      post: formatPost(post, {
        author,
        currentUserId: req.user?._id,
        reaction: (reaction?.value as ReactionValue | undefined) || null,
        locale: req.locale
      })
    });
  } catch (err) {
    console.error("getPostByIdOrSlug error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const toggleReaction = async (req: Request, res: Response, targetValue: ReactionValue) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const id = req.params.id;
    const post = await findPostByIdOrSlug(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const postId = new mongoose.Types.ObjectId(String(post._id));
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const existing = await PostReaction.findOne({ postId, userId });

    let reaction: ReactionValue | null = targetValue;
    if (!existing) {
      await PostReaction.create({ postId, userId, value: targetValue });
    } else if (existing.value === targetValue) {
      await PostReaction.deleteOne({ _id: existing._id });
      reaction = null;
    } else {
      existing.value = targetValue;
      await existing.save();
    }

    const stats = await syncReactionStats(postId);
    const author = await User.findById(post.authorId || post.author, { username: 1, name: 1, avatarUrl: 1 }).lean();
    const updated = await Post.findById(postId).lean();

    return res.json({
      ok: true,
      reaction,
      likeCount: stats.likeCount,
      dislikeCount: stats.dislikeCount,
      post: updated ? formatPost(updated, { author, currentUserId: req.user._id, reaction, locale: req.locale }) : undefined
    });
  } catch (err) {
    console.error("toggleReaction error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const likePost = async (req: Request, res: Response) => toggleReaction(req, res, "like");

export const dislikePost = async (req: Request, res: Response) => toggleReaction(req, res, "dislike");

export const sharePost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = req.params.id;
    const post = await findPostByIdOrSlug(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { shareCount: 1 } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: "Post not found" });

    return res.json({ ok: true, shareCount: updated.shareCount || 0 });
  } catch (err) {
    console.error("sharePost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listPostComments = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const post = await findPostByIdOrSlug(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;

    const [total, comments] = await Promise.all([
      Comment.countDocuments({ postId: post._id }),
      Comment.find({ postId: post._id }).sort({ createdAt: 1 }).skip(skip).limit(limit).lean()
    ]);

    const userIds = Array.from(new Set(comments.map((comment) => String(comment.userId)).filter(Boolean))).map(
      (userId) => new mongoose.Types.ObjectId(userId)
    );
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }, { username: 1, name: 1, avatarUrl: 1 }).lean()
      : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const items = comments.map((comment) => {
      const user = userMap.get(String(comment.userId));
      return {
        _id: String(comment._id),
        text: comment.text,
        createdAt: comment.createdAt,
        user: user
          ? {
              _id: String(user._id),
              nickname: user.username || user.name || "user",
              avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id)
            }
          : null
      };
    });

    return res.json({ items, page, limit, total });
  } catch (err) {
    console.error("listPostComments error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createPostComment = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const parsed = commentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const post = await findPostByIdOrSlug(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const createdAt = new Date();
    const comment = await Comment.create({
      postId: post._id,
      userId: req.user._id,
      text: parsed.data.text
    });

    const commentCount = await syncCommentCount(new mongoose.Types.ObjectId(String(post._id)));
    await Post.updateOne(
      { _id: post._id },
      {
        $push: {
          comments: {
            user: req.user._id,
            text: parsed.data.text,
            createdAt
          }
        }
      }
    );

    const user = await User.findById(req.user._id, { username: 1, name: 1, avatarUrl: 1 }).lean();
    return res.status(201).json({
      ok: true,
      commentCount,
      comment: {
        _id: String(comment._id),
        text: comment.text,
        createdAt: comment.createdAt,
        user: user
          ? {
              _id: String(user._id),
              nickname: user.username || user.name || "user",
              avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id)
            }
          : null
      }
    });
  } catch (err) {
    console.error("createPostComment error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const topDiscussions = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 5, 20);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: { isActive: true, status: "active" } },
      { $sort: { likeCount: -1, commentCount: -1, shareCount: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const [items, total] = await Promise.all([
      Post.aggregate(pipeline),
      Post.countDocuments({ isActive: true, status: "active" })
    ]);
    const authorMap = await getAuthorMap(items);

    return res.json({
      items: items.map((post) => formatPost(post, { author: authorMap.get(String(post.authorId || post.author || "")), locale: req.locale })),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("topDiscussions error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Legacy aliases for existing imports/routes
export const feed = listPosts;
export const getPostDetail = getPostByIdOrSlug;
export const commentPost = createPostComment;
export const reportPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const post = await findPostByIdOrSlug(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const reports = Number(post.reports || 0) + 1;
    const updatePayload: Record<string, unknown> = { reports };
    if (reports >= 5) {
      updatePayload.status = "pending";
      updatePayload.isActive = false;
    }

    const updated = await Post.findByIdAndUpdate(post._id, { $set: updatePayload }, { new: true }).lean();
    return res.json({ post: updated ? formatPost(updated, { locale: req.locale }) : undefined });
  } catch (err) {
    console.error("reportPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markBestAnswer = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const commentId = String(req.body?.commentId || "").trim();
    if (!commentId) return res.status(400).json({ message: "commentId required" });

    const postDoc = await Post.findOne(getPostFilter(req.params.id));
    if (!postDoc) return res.status(404).json({ message: "Post not found" });
    const isOwner = String(postDoc.authorId || postDoc.author) === req.user._id;
    if (!isOwner && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const hasComment = postDoc.comments.some((comment: any) => String(comment?._id) === commentId);
    if (!hasComment) return res.status(404).json({ message: "Comment not found" });

    postDoc.bestAnswerId = new mongoose.Types.ObjectId(commentId);
    postDoc.comments = postDoc.comments.map((comment: any) => ({
      ...comment,
      isBestAnswer: String(comment?._id) === commentId
    }));
    await postDoc.save();

    return res.json({ post: formatPost(postDoc, { locale: req.locale }) });
  } catch (err) {
    console.error("markBestAnswer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
