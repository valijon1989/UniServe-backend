import { Request, Response } from "express";
import mongoose from "mongoose";
import { Post } from "../models/Post";
import { User } from "../models/User";
import { respondAuthRequired } from "../utils/controllerResponses";

const slugifyText = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
};

const buildSlug = (title: string) => {
  const base = slugifyText(title) || "news";
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
};

const EXCLUDED_NEWS_CATEGORIES = new Set([
  "product",
  "products",
  "service",
  "services",
  "listing",
  "listings",
  "marketplace",
  "construction",
  "education",
  "taxi",
  "delivery"
]);

const normalizeCategory = (value: unknown): string => String(value || "community").trim().toLowerCase();

const isAllowedNewsCategory = (value: unknown): boolean => !EXCLUDED_NEWS_CATEGORIES.has(normalizeCategory(value));

const formatNews = (news: any) => {
  const result = news?.toObject ? news.toObject() : { ...news };
  result.coverImage = result.coverImage || (Array.isArray(result.images) && result.images.length ? result.images[0] : "");
  result.excerpt = result.excerpt || result.text || "";
  result.content = result.content || result.text || "";
  result.location = result.location || "";
  result.language = result.language || "Uzbek";
  result.type = result.type || "article";
  result.status = result.status || "active";
  result.sourceUrl = result.sourceUrl || "";
  result.isFeatured = Boolean(result.isFeatured);
  result.isActive = typeof result.isActive === "boolean" ? result.isActive : true;
  result.commentsCount = Array.isArray(result.comments) ? result.comments.length : 0;
  result.createdAt = result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt;
  result.updatedAt = result.updatedAt instanceof Date ? result.updatedAt.toISOString() : result.updatedAt;
  return result;
};

export const listNews = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    const filters: any = {
      isActive: true,
      status: "active",
      category: { $nin: Array.from(EXCLUDED_NEWS_CATEGORIES) }
    };

    if (req.query.category) {
      const requestedCategory = String(req.query.category).toLowerCase();
      if (!isAllowedNewsCategory(requestedCategory)) {
        return res.json({ page, limit, total: 0, totalPages: 1, featured: [], items: [] });
      }
      filters.category = requestedCategory;
    }
    if (req.query.location) filters.location = String(req.query.location);
    if (req.query.language) filters.language = String(req.query.language);
    if (req.query.type) filters.type = String(req.query.type).toLowerCase();

    const timeframe = String(req.query.timeframe || "").toLowerCase();
    if (timeframe === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      filters.createdAt = { $gte: start };
    } else if (timeframe === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      filters.createdAt = { $gte: start };
    } else if (timeframe === "month") {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      filters.createdAt = { $gte: start };
    }

    const queryTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (queryTerm) {
      const regex = new RegExp(queryTerm, "i");
      filters.$or = [{ title: regex }, { content: regex }, { excerpt: regex }, { text: regex }];
    }

    const sort: Record<string, mongoose.SortOrder> =
      req.query.sort === "popular"
        ? { views: -1, createdAt: -1 }
        : { isFeatured: -1, createdAt: -1 };

    const [total, items, featured] = await Promise.all([
      Post.countDocuments(filters),
      Post.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "name username avatarUrl role"),
      Post.find({
        isFeatured: true,
        isActive: true,
        status: "active",
        category: { $nin: Array.from(EXCLUDED_NEWS_CATEGORIES) }
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate("author", "name username avatarUrl role")
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      featured: featured.map(formatNews),
      items: items.map(formatNews)
    });
  } catch (err) {
    console.error("listNews error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getNewsDetail = async (req: Request, res: Response) => {
  try {
    const identifier = req.params.slug;
    const filter = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { slug: identifier };
    const news = await Post.findOne(filter).populate("author", "name username avatarUrl role");
    if (!news) return res.status(404).json({ message: "News item not found" });
    if (!isAllowedNewsCategory(news.category)) {
      return res.status(404).json({ message: "News item not found" });
    }

    news.views = (news.views || 0) + 1;
    await news.save();

    const relatedPosts = await Post.find({
      category: news.category,
      _id: { $ne: news._id },
      status: "active",
      isActive: true
    })
      .sort({ createdAt: -1 })
      .limit(3);

    return res.json({
      news: formatNews(news),
      relatedPosts: relatedPosts.map(formatNews)
    });
  } catch (err) {
    console.error("getNewsDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createNews = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const {
      title,
      excerpt,
      text,
      content,
      images,
      coverImage,
      videoUrl,
      attachments,
      location,
      category,
      type,
      language,
      sourceUrl
    } = req.body;

    const normalizedCategory = normalizeCategory(category);
    if (!isAllowedNewsCategory(normalizedCategory)) {
      return res.status(400).json({ message: "Product/service related categories are not allowed in news feed" });
    }

    const normalizedImages = Array.isArray(images)
      ? images
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];
    if (coverImage && typeof coverImage === "string" && coverImage.trim()) {
      normalizedImages.unshift(coverImage.trim());
    }

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const typeValue = String((item as any).type || "").trim().toLowerCase();
            const urlValue = String((item as any).url || "").trim();
            const nameValue = String((item as any).name || "").trim();
            if (!urlValue) return null;
            return { type: typeValue || "file", url: urlValue, name: nameValue || undefined };
          })
          .filter(Boolean)
      : [];

    const fullText = String(content || text || "").trim();
    const normalizedTitle = String(title || "").trim() || (fullText ? fullText.slice(0, 60) : "");
    if (!normalizedTitle) {
      return res.status(400).json({ message: "Title or content is required" });
    }
    if (!fullText && !normalizedImages.length && !videoUrl && !sourceUrl && !normalizedAttachments.length) {
      return res.status(400).json({ message: "Post body is empty" });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dailyLimit = Number(process.env.NEWS_DAILY_LIMIT || 30);
    const todayCount = await Post.countDocuments({
      author: user._id,
      createdAt: { $gte: startOfDay }
    });

    if (todayCount >= dailyLimit) {
      return res.status(429).json({ message: "Daily news limit reached" });
    }

    const slug = buildSlug(normalizedTitle);
    const news = await Post.create({
      author: user._id,
      title: normalizedTitle,
      slug,
      excerpt: String(excerpt || "").trim() || fullText.slice(0, 200),
      text: fullText,
      content: fullText,
      images: normalizedImages.slice(0, 10),
      videoUrl: typeof videoUrl === "string" ? videoUrl.trim() : "",
      attachments: normalizedAttachments as any,
      location: location || "",
      category: normalizedCategory,
      type: (type || "tip").toLowerCase(),
      language: (language || "Uzbek").toString(),
      sourceUrl: sourceUrl?.startsWith("http") ? sourceUrl : "",
      status: "active",
      isFeatured: false,
      isActive: true
    });

    return res.status(201).json({ news: formatNews(news) });
  } catch (err) {
    console.error("createNews error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reportNews = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const { slug } = req.params;
    const news = await Post.findOne(
      mongoose.isValidObjectId(slug) ? { _id: slug } : { slug }
    );
    if (!news) return res.status(404).json({ message: "News item not found" });

    news.reports = (news.reports || 0) + 1;
    if (news.reports >= 5) {
      news.status = "blocked" as any;
      news.isActive = false;
    }
    await news.save();
    return res.json({ news: formatNews(news) });
  } catch (err) {
    console.error("reportNews error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateNewsStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { slug } = req.params;
    const { status, isActive, isFeatured } = req.body;
    if (!["active", "pending", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const news = await Post.findOne(
      mongoose.isValidObjectId(slug) ? { _id: slug } : { slug }
    );
    if (!news) return res.status(404).json({ message: "News item not found" });

    news.status = status as any;
    if (typeof isActive === "boolean") {
      news.isActive = isActive;
    }
    if (typeof isFeatured === "boolean") {
      news.isFeatured = isFeatured;
    }
    await news.save();

    return res.json({ news: formatNews(news) });
  } catch (err) {
    console.error("updateNewsStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
