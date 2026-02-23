import { Request, Response } from "express";
import mongoose from "mongoose";
import { CommunityGroupActivityModel } from "../models/CommunityGroupActivity";
import { CommunityGroupModel } from "../models/CommunityGroup";
import { Post } from "../models/Post";
import { User } from "../models/User";
import { formatPost } from "./postController";
import { communityGroupFixtures } from "../data/communityGroups";
import { communityPostFixtures, CommunityPostFixture } from "../data/communityPosts";

const buildGroupDto = (group: any) => {
  const lastActivity = group.lastActivity || group.updatedAt;
  const reviews = (group.reviews || []).slice(-3).map((review: any) => ({
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: review.userId
      ? {
          id: review.userId,
          name: review.userName,
          username: review.username,
          avatarUrl: review.avatarUrl
        }
      : undefined
  }));

  const hostProfile = group.createdBy
    ? {
        id: group.createdBy._id,
        name: group.createdBy.name,
        username: group.createdBy.username,
        role: group.createdBy.role,
        avatarUrl: group.createdBy.avatarUrl,
        isVerified: group.createdBy.isVerified
      }
    : null;

  return {
    id: group._id,
    title: group.title,
    description: group.description,
    type: group.groupType || group.channelType || "group",
    category: group.category,
    isVerified: Boolean(group.isVerified),
    lastActivity,
    reviews,
    reviewCount: group.reviews?.length || 0,
    spamReports: group.spamReports,
    members: group.members,
    host: hostProfile ? hostProfile.name || hostProfile.username : null,
    hostProfile,
    privacy: group.privacy,
    requiresApproval: Boolean(group.requiresApproval),
    pendingApprovals: group.pendingApprovals || 0,
    tags: group.tags,
    channelType: group.channelType,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
};

const formatActivityEntry = (entry: any) => ({
  id: entry._id,
  action: entry.action,
  rating: entry.rating,
  reason: entry.reason,
  metadata: entry.metadata,
  createdAt: entry.createdAt,
  user: entry.user
    ? {
        id: entry.user._id,
        name: entry.user.name,
        username: entry.user.username,
        avatarUrl: entry.user.avatarUrl,
        role: entry.user.role,
        isVerified: entry.user.isVerified
      }
    : null
});

const normalizePrivacy = (value?: string) => {
  const allowed = ["public", "private", "secret"];
  if (!value) return "public";
  if (allowed.includes(value)) return value;
  return "public";
};

const normalizeType = (value?: string) => {
  if (value === "channel" || value === "group") return value;
  return undefined;
};

const fallbackGroupMap = new Map<string, typeof communityGroupFixtures[number]>();
communityGroupFixtures.forEach((fixture) => {
  fallbackGroupMap.set(fixture.slug, fixture);
  if (fixture.legacyId) {
    fallbackGroupMap.set(fixture.legacyId, fixture);
  }
});

const buildFallbackGroup = (fixture: typeof communityGroupFixtures[number]) => {
  return buildGroupDto({
    _id: fixture.slug,
    title: fixture.title,
    description: fixture.description,
    category: fixture.category,
    tags: fixture.tags,
    members: fixture.members,
    rating: fixture.rating,
    ratingVotes: fixture.ratingVotes,
    spamReports: fixture.spamReports,
    groupType: fixture.groupType,
    channelType: fixture.channelType,
    privacy: fixture.privacy,
    requiresApproval: fixture.requiresApproval,
    isVerified: true,
    lastActivity: new Date(fixture.lastActivity),
    reviews: [],
    createdBy: fixture.host
      ? {
          _id: fixture.slug,
          name: fixture.host.name,
          username: fixture.host.username,
          avatarUrl: fixture.host.avatarUrl,
          role: "USER",
          isVerified: true
        }
      : undefined
  });
};

const toFallbackActivityFeed = (slug: string) =>
  (communityPostFixtures.filter((fixture) => fixture.groupSlug === slug) || []).map((fixture) =>
    formatActivityEntry({
      _id: fixture.slug,
      action: fixture.type === "question" ? "question" : "post",
      rating: undefined,
      reason: fixture.body,
      metadata: { attachments: fixture.attachments },
      createdAt: fixture.createdAt,
      user: {
        _id: fixture.slug,
        name: fixture.authorRole === "AGENT" ? "Community Agent" : "Community Member",
        username: fixture.authorRole === "AGENT" ? "community_agent" : "community_user",
        avatarUrl: "/static/avatars/user1.jpg",
        role: fixture.authorRole,
        isVerified: fixture.authorRole === "AGENT"
      }
    })
  );

const convertFixtureToPost = (fixture: CommunityPostFixture) => {
  const images = fixture.attachments.filter((item) => item.type === "image").map((item) => item.url);
  const videoUrl = fixture.attachments.find((item) => item.type === "video")?.url || "";
  return formatPost({
    toObject() {
      return this;
    },
    _id: fixture.slug,
    slug: fixture.slug,
    title: fixture.title,
    text: fixture.body,
    content: fixture.body,
    excerpt: fixture.body.slice(0, 120),
    category: fixture.category,
    type: fixture.type,
    author: {
      _id: fixture.slug,
      name: fixture.authorRole === "AGENT" ? "Community Agent" : "Community Member",
      username: fixture.authorRole === "AGENT" ? "community_agent" : "community_user",
      avatarUrl: "/static/avatars/user1.jpg",
      role: fixture.authorRole
    },
    images,
    attachments: fixture.attachments,
    likes: Array.from({ length: fixture.likes }).map((_, index) => index),
    comments: Array.from({ length: fixture.replies }).map(() => ({
      user: { name: "Fallback User", username: "fallback_user" },
      text: "Javob",
      createdAt: fixture.createdAt
    })),
    createdAt: fixture.createdAt,
    updatedAt: fixture.createdAt
  });
};

export const listGroups = async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const requestedType =
      typeof req.query.type === "string" ? normalizeType(req.query.type) : undefined;
    const filter: Record<string, any> = { isActive: true };
    if (category && category !== "all") filter.category = category;
    if (requestedType) filter.groupType = requestedType;

    const groups = await CommunityGroupModel.find(filter)
      .populate("createdBy", "name username role avatarUrl isVerified")
      .sort({ isVerified: -1, lastActivity: -1, members: -1 })
      .lean();

    return res.json({ groups: groups.map(buildGroupDto) });
  } catch (err) {
    console.error("listGroups error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getGroupDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let group: any = null;
    let lookupKey: string | undefined;

    if (mongoose.Types.ObjectId.isValid(id)) {
      group = await CommunityGroupModel.findById(id)
        .populate("createdBy", "name username avatarUrl role isVerified")
        .lean();
      lookupKey = group?.slug;
    }

    if (!group) {
      group = await CommunityGroupModel.findOne({ slug: id })
        .populate("createdBy", "name username avatarUrl role isVerified")
        .lean();
      lookupKey = group?.slug || id;
    } else {
      lookupKey = group.slug;
    }

    if (!group && lookupKey) {
      const fallbackFixture = fallbackGroupMap.get(lookupKey);
      if (fallbackFixture) {
        return res.json({
          group: buildFallbackGroup(fallbackFixture),
          activityFeed: toFallbackActivityFeed(fallbackFixture.slug),
          membership: {
            isMember: Boolean(req.user),
            requiresApproval: fallbackFixture.requiresApproval,
            pendingApprovals: 0
          }
        });
      }
    }

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const activities = await CommunityGroupActivityModel.find({ group: group._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("user", "name username avatarUrl role isVerified");

    return res.json({
      group: buildGroupDto(group),
      activityFeed: activities.map(formatActivityEntry),
      membership: {
        isMember: Boolean(req.user),
        requiresApproval: group.requiresApproval,
        pendingApprovals: group.pendingApprovals || 0
      }
    });
  } catch (err) {
    console.error("getGroupDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  try {
    const { title, description, category, tags, type, privacy, requiresApproval } = req.body;
    if (!title || !category) {
      return res.status(400).json({ message: "title and category are required" });
    }
    const userId = req.user?._id;
    const groupType = normalizeType(type);
    const privacyMode = normalizePrivacy(privacy);
    const preparedTags = Array.isArray(tags) ? tags.slice(0, 10) : [];

    const group = await CommunityGroupModel.create({
      title,
      description: description || "",
      category,
      tags: preparedTags,
      groupType,
      channelType: groupType,
      privacy: privacyMode,
      requiresApproval: Boolean(requiresApproval),
      lastActivity: new Date(),
      createdBy: userId
    });

    await group.populate("createdBy", "name username role avatarUrl");

    return res.status(201).json({ group: buildGroupDto(group) });
  } catch (err) {
    console.error("createGroup error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCommunityGroupPosts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 60);
    const skip = (page - 1) * limit;

    const group =
      mongoose.Types.ObjectId.isValid(id)
        ? await CommunityGroupModel.findById(id)
        : await CommunityGroupModel.findOne({ slug: id });
    const fallbackSlug = group?.slug || id;

    const filters: any = {
      isActive: true,
      status: "active"
    };
    if (group?.slug) {
      filters.communityGroup = group._id;
    } else if (mongoose.Types.ObjectId.isValid(id)) {
      filters.communityGroup = id;
    }

    if (req.query.type) filters.type = String(req.query.type).toLowerCase();
    if (req.query.category) filters.category = String(req.query.category).toLowerCase();
    if (req.query.language) filters.language = String(req.query.language);

    const queryTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (queryTerm) {
      const regex = new RegExp(queryTerm, "i");
      filters.$or = [{ title: regex }, { text: regex }, { content: regex }, { excerpt: regex }];
    }

    const sort: Record<string, mongoose.SortOrder> =
      req.query.sort === "popular"
        ? { views: -1, likes: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [total, posts] = await Promise.all([
      Post.countDocuments(filters),
      Post.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "name username avatarUrl role region")
        .populate("comments.user", "name username avatarUrl role")
    ]);

    const formatted = posts.map(formatPost);
    if (formatted.length < 3 && fallbackSlug) {
      const fallbackPosts = communityPostFixtures
        .filter((fixture) => fixture.groupSlug === fallbackSlug)
        .slice(0, Math.max(0, 6 - formatted.length))
        .map(convertFixtureToPost);
      formatted.push(...fallbackPosts);
    }

    const totalItems = Math.max(total, formatted.length);

    return res.json({
      page,
      limit,
      total: totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
      posts: formatted.slice(0, 6)
    });
  } catch (err) {
    console.error("getCommunityGroupPosts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCommunityPosts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 60);
    const skip = (page - 1) * limit;

    const filters: any = {
      isActive: true,
      status: "active"
    };
    let fallbackSlug: string | undefined;
    if (req.query.groupId) {
      const groupId = String(req.query.groupId);
      if (mongoose.Types.ObjectId.isValid(groupId)) {
        filters.communityGroup = groupId;
      } else {
        fallbackSlug = groupId;
        const fallbackGroup = await CommunityGroupModel.findOne({ slug: groupId });
        if (fallbackGroup) {
          filters.communityGroup = fallbackGroup._id;
        }
      }
    }
    if (req.query.type) filters.type = String(req.query.type).toLowerCase();
    if (req.query.category) filters.category = String(req.query.category).toLowerCase();
    if (req.query.language) filters.language = String(req.query.language);

    const queryTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (queryTerm) {
      const regex = new RegExp(queryTerm, "i");
      filters.$or = [{ title: regex }, { text: regex }, { content: regex }, { excerpt: regex }];
    }

    const sort: Record<string, mongoose.SortOrder> =
      req.query.sort === "popular"
        ? { views: -1, likes: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [total, posts] = await Promise.all([
      Post.countDocuments(filters),
      Post.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "name username avatarUrl role region")
        .populate("comments.user", "name username avatarUrl role")
    ]);

    const formatted = posts.map(formatPost);
    let fallbackPosts: any[] = [];
    if (fallbackSlug) {
      fallbackPosts = communityPostFixtures
        .filter((fixture) => fixture.groupSlug === fallbackSlug)
        .slice(0, Math.max(0, limit - formatted.length))
        .map(convertFixtureToPost);
    }
    const combined = [...formatted, ...fallbackPosts].slice(0, limit);
    const totalItems = Math.max(total, combined.length);

    return res.json({
      page,
      limit,
      total: totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
      posts: combined
    });
  } catch (err) {
    console.error("getCommunityPosts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const logActivity = async (groupId: any, userId: any, action: string, payload: Record<string, unknown> = {}) => {
  if (!userId) return;
  try {
    await CommunityGroupActivityModel.create({
      group: groupId,
      user: userId,
      action: action === "leave" ? "leave" : action === "rate" ? "rate" : action === "report" ? "report" : "join",
      metadata: payload
    });
  } catch (err) {
    console.error("logActivity error", err);
  }
};

export const rateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ratingValue = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }
    const group = await CommunityGroupModel.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const reviewer = req.user?._id
      ? await User.findById(req.user._id).select("name username role avatarUrl")
      : null;

    const votes = group.ratingVotes || 0;
    const totalScore = (group.rating || 0) * votes;
    const nextVotes = votes + 1;
    group.ratingVotes = nextVotes;
    group.rating = Number(((totalScore + ratingValue) / nextVotes).toFixed(2));

    group.reviews = [
      ...(group.reviews || []).slice(-9),
      {
        userId: reviewer?._id,
        userName: reviewer?.name || "Anonymous",
        username: reviewer?.username,
        role: reviewer?.role,
        avatarUrl: reviewer?.avatarUrl,
        rating: ratingValue,
        comment,
        createdAt: new Date()
      }
    ];

    group.lastActivity = new Date();
    await group.save();

    await logActivity(id, req.user?._id, "rate", { rating: ratingValue, comment });

    return res.json({ group: buildGroupDto(await group.populate("createdBy", "name username role avatarUrl")) });
  } catch (err) {
    console.error("rateGroup error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reportGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || "").trim();
    const group = await CommunityGroupModel.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    group.spamReports = (group.spamReports || 0) + 1;
    if (group.spamReports >= 3) group.isVerified = false;
    group.lastActivity = new Date();
    await group.save();

    await logActivity(id, req.user?._id, "report", { reason });

    return res.json({
      spamReports: group.spamReports,
      isVerified: group.isVerified,
      message: group.isVerified ? "Report registered" : "Group flagged for review"
    });
  } catch (err) {
    console.error("reportGroup error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const modifyMembership = async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    const group = await CommunityGroupModel.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const normalized = action === "leave" ? "leave" : "join";
    group.lastActivity = new Date();

    if (normalized === "leave") {
      group.members = Math.max(0, group.members - 1);
    } else {
      if (group.requiresApproval) {
        group.pendingApprovals = (group.pendingApprovals || 0) + 1;
      } else {
        group.members += 1;
      }
    }

    await group.save();
    await logActivity(id, req.user?._id, normalized, { requiresApproval: group.requiresApproval });

    return res.json({
      members: group.members,
      pendingApprovals: group.pendingApprovals,
      requiresApproval: group.requiresApproval,
      action: normalized,
      pendingApproval: normalized === "join" && group.requiresApproval
    });
  } catch (err) {
    console.error("modifyMembership error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
