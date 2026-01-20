import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { ServiceCategory, ServiceCategoryDocument } from './schemas/service-category.schema';
import { ServiceReaction, ServiceReactionDocument } from './schemas/service-reaction.schema';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ServicesService {
  private readonly viewRateLimitMs = 60 * 60 * 1000;
  private readonly viewRateLimit = new Map<string, number>();

  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(ServiceCategory.name) private readonly categoryModel: Model<ServiceCategoryDocument>,
    @InjectModel(ServiceReaction.name) private readonly reactionModel: Model<ServiceReactionDocument>,
    @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createCategory(data: Partial<ServiceCategory>) {
    return this.categoryModel.create(data);
  }

  async listCategories(type?: string) {
    await this.ensureSeedCategories();
    const query: any = { isActive: { $ne: false } };
    if (type) query.type = this.mapCategoryType(type);
    return this.categoryModel.find(query).sort({ order: 1, name: 1 }).lean();
  }

  async listCategoryTree() {
    await this.ensureSeedCategories();
    const categories = await this.categoryModel
      .find({ isActive: { $ne: false } })
      .sort({ order: 1, name: 1 })
      .lean();
    const byId = new Map<string, any>();
    const roots: any[] = [];
    categories.forEach((cat) => {
      const item = { ...cat, children: [] as any[] };
      byId.set(String(cat._id), item);
    });
    categories.forEach((cat) => {
      const entry = byId.get(String(cat._id));
      if (cat.parentId) {
        const parent = byId.get(String(cat.parentId));
        if (parent) parent.children.push(entry);
      } else {
        roots.push(entry);
      }
    });
    return roots;
  }

  async createService(agentUserId: string, data: Partial<Service>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    if (agent.agentType !== 'service') throw new BadRequestException('Agent type must be service');
    if (agent.verificationStatus !== 'verified') throw new BadRequestException('Agent not verified');
    if (data.priceMin === undefined && data.price !== undefined) {
      data.priceMin = data.price;
    }
    if (!data.pricingType) {
      data.pricingType = 'fixed';
    }
    if (!data.currency) {
      data.currency = 'KRW';
    }
    const resolvedCategory = await this.resolveCategoryInput(data.category as any);
    if (!resolvedCategory) throw new BadRequestException('Category not found');
    data.category = resolvedCategory;
    const categoryDoc = await this.categoryModel.findById(resolvedCategory);
    if (categoryDoc?.type) data.tab = categoryDoc.type;
    if (categoryDoc?.parentId && !data.subCategory) {
      data.subCategory = categoryDoc._id;
      data.category = categoryDoc.parentId;
    }
    if (data.subCategory) {
      const resolvedSub = await this.resolveCategoryInput(data.subCategory as any);
      if (!resolvedSub) throw new BadRequestException('Subcategory not found');
      data.subCategory = resolvedSub;
    }
    this.validateServicePayload(data, { requireTerms: true });
    return this.serviceModel.create({ ...data, agent: agent._id });
  }

  async myServices(agentUserId: string) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    return this.serviceModel.find({ agent: agent._id });
  }

  async updateService(agentUserId: string, id: string, data: Partial<Service>) {
    const agent = await this.agentModel.findOne({ user: agentUserId });
    if (!agent) throw new BadRequestException('Agent not found');
    if (agent.agentType !== 'service') throw new BadRequestException('Agent type must be service');
    if (agent.verificationStatus !== 'verified') throw new BadRequestException('Agent not verified');
    if (data.category) {
      const resolvedCategory = await this.resolveCategoryInput(data.category as any);
      if (!resolvedCategory) throw new BadRequestException('Category not found');
      data.category = resolvedCategory;
      const categoryDoc = await this.categoryModel.findById(resolvedCategory);
      if (categoryDoc?.type) data.tab = categoryDoc.type;
      if (categoryDoc?.parentId && !data.subCategory) {
        data.subCategory = categoryDoc._id;
        data.category = categoryDoc.parentId;
      }
    }
    if (data.subCategory) {
      const resolvedSub = await this.resolveCategoryInput(data.subCategory as any);
      if (!resolvedSub) throw new BadRequestException('Subcategory not found');
      data.subCategory = resolvedSub;
    }
    this.validateServicePayload(data, { partial: true });
    const svc = await this.serviceModel.findOneAndUpdate({ _id: id, agent: agent._id }, data, { new: true });
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async deleteService(agentUserId: string, id: string) {
    return this.updateService(agentUserId, id, { status: 'inactive' } as any);
  }

  async listFeed(query: any = {}) {
    await this.ensureSeedCategories();
    await this.ensureSeedServices();

    const filters: any = { status: 'active' };
    if (query.tab) {
      const tabValue = this.mapCategoryType(query.tab);
      filters.tab = tabValue;
    }
    if (query.deliveryMode && query.deliveryMode !== 'both') {
      filters.deliveryMode = query.deliveryMode;
    }
    if (query.minRating !== undefined) {
      filters['rating.avg'] = { $gte: this.toNumber(query.minRating) || 0 };
    }

    const priceMin = this.toNumber(query.minPrice);
    const priceMax = this.toNumber(query.maxPrice);
    if (priceMin !== undefined || priceMax !== undefined) {
      filters.priceMin = {};
      if (priceMin !== undefined) filters.priceMin.$gte = priceMin;
      if (priceMax !== undefined) filters.priceMin.$lte = priceMax;
    }

    const categoryFilters: any[] = [];
    if (query.category) {
      const category = await this.resolveCategoryBySlugOrId(query.category);
      if (!category) return { items: [], hasMore: false };
      const filter = await this.buildCategoryFilter(category);
      if (filter) categoryFilters.push(filter);
    }

    if (query.subCategory) {
      const subCategory = await this.resolveCategoryBySlugOrId(query.subCategory);
      if (!subCategory) return { items: [], hasMore: false };
      const filter = await this.buildCategoryFilter(subCategory);
      if (filter) categoryFilters.push(filter);
    }

    if (categoryFilters.length) {
      filters.$and = [...(filters.$and || []), ...categoryFilters];
    }

    if (query.providerType) {
      const providerType = this.mapCategoryType(query.providerType);
      const providers = await this.agentModel.find({ providerType, verificationStatus: 'verified' }).select('_id');
      if (!providers.length) return { items: [], hasMore: false };
      filters.agent = { $in: providers.map((p) => p._id) };
    }

    const search = typeof query.q === 'string' ? query.q.trim() : '';
    if (search) {
      filters.$text = { $search: search };
    }

    const limit = Math.max(1, Math.min(100, this.toNumber(query.limit) || 12));
    const cursorData = this.parseCursor(query.cursor);

    const sortKey = String(query.sort || '').toLowerCase();
    const sort = this.mapSort(sortKey);
    let services: any[] = [];
    let popularityScoreMap = new Map<string, number>();
    if (sortKey === 'popular') {
      const pipeline: any[] = [
        { $match: filters },
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $multiply: ['$stats.views', 0.2] },
                { $multiply: ['$stats.likes', 2] },
                { $multiply: ['$stats.saves', 3] },
                { $multiply: ['$stats.orders', 5] },
                { $multiply: ['$rating.avg', 1] },
              ],
            },
          },
        },
      ];
      if (cursorData && cursorData.value !== undefined && cursorData.id) {
        const score = Number(cursorData.value);
        pipeline.push({
          $match: {
            $or: [
              { popularityScore: { $lt: score } },
              { popularityScore: score, _id: { $lt: cursorData.id } },
            ],
          },
        });
      }
      pipeline.push({ $sort: { popularityScore: -1, _id: -1 } });
      pipeline.push({ $limit: limit + 1 });

      services = await this.serviceModel
        .aggregate([
          ...pipeline,
        ])
        .exec();
      services.forEach((svc) => {
        popularityScoreMap.set(String(svc._id), Number(svc.popularityScore || 0));
      });
      const ids = services.map((svc) => svc._id);
      const populated = await this.serviceModel
        .find({ _id: { $in: ids } })
        .populate('category')
        .populate('subCategory')
        .populate({ path: 'agent', populate: { path: 'user' } });
      const populatedMap = new Map(populated.map((svc) => [String(svc._id), svc]));
      services = ids.map((id) => populatedMap.get(String(id))).filter(Boolean) as any[];
    } else {
      const cursorFilter = this.buildCursorFilter(cursorData, sortKey);
      const finalFilters = cursorFilter ? { $and: [filters, cursorFilter] } : filters;
      services = await this.serviceModel
        .find(finalFilters)
        .sort(sort)
        .limit(limit + 1)
        .populate('category')
        .populate('subCategory')
        .populate({ path: 'agent', populate: { path: 'user' } });
    }

    const hasMore = services.length > limit;
    const trimmed = hasMore ? services.slice(0, limit) : services;
    const items = trimmed.map((svc) => this.buildServiceCard(svc));
    const last = trimmed[trimmed.length - 1];
    const nextCursor = last ? this.buildNextCursor(last, sortKey, popularityScoreMap) : null;
    return { items, nextCursor, hasMore };
  }

  async byId(id: string) {
    await this.ensureSeedServices();
    const filter = Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
    const svc = await this.serviceModel
      .findOne(filter)
      .populate('category')
      .populate('subCategory')
      .populate({ path: 'agent', populate: 'user' });
    if (!svc) throw new NotFoundException('Service not found');
    return this.buildServiceDetail(svc);
  }

  async trackView(id: string, ip?: string) {
    const key = `${id}:${ip || 'anonymous'}`;
    const now = Date.now();
    const last = this.viewRateLimit.get(key);
    if (last && now - last < this.viewRateLimitMs) {
      const svc = await this.serviceModel.findById(id);
      if (!svc) throw new NotFoundException('Service not found');
      return { stats: svc.stats };
    }
    this.viewRateLimit.set(key, now);
    return this.incrementStat(id, 'views');
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'shares' | 'saves' | 'orders') {
    const svc = await this.serviceModel.findByIdAndUpdate(id, { $inc: { [`stats.${field}`]: 1 } }, { new: true });
    if (!svc) throw new NotFoundException('Service not found');
    if (field === 'likes' || field === 'shares') {
      await this.agentModel.findByIdAndUpdate(svc.agent, { $inc: { [`stats.${field}`]: 1 } });
    }
    return { stats: svc.stats };
  }

  async likeService(id: string, userId: string) {
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const result = await this.reactionModel.updateOne(
      { userId, serviceId: id, type: 'like' },
      { $setOnInsert: { userId, serviceId: id, type: 'like' } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      await this.incrementStat(id, 'likes');
    }
    return { ok: true };
  }

  async unlikeService(id: string, userId: string) {
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const result = await this.reactionModel.deleteOne({ userId, serviceId: id, type: 'like' });
    if (result.deletedCount) {
      await this.serviceModel.findByIdAndUpdate(id, { $inc: { 'stats.likes': -1 } });
    }
    return { ok: true };
  }

  async saveService(id: string, userId: string) {
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const result = await this.reactionModel.updateOne(
      { userId, serviceId: id, type: 'save' },
      { $setOnInsert: { userId, serviceId: id, type: 'save' } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      await this.incrementStat(id, 'saves');
    }
    return { ok: true };
  }

  async unsaveService(id: string, userId: string) {
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const result = await this.reactionModel.deleteOne({ userId, serviceId: id, type: 'save' });
    if (result.deletedCount) {
      await this.serviceModel.findByIdAndUpdate(id, { $inc: { 'stats.saves': -1 } });
    }
    return { ok: true };
  }

  async listByProvider(providerId: string, query: any = {}) {
    const limit = Math.max(1, Math.min(100, this.toNumber(query.limit) || 12));
    const page = Math.max(1, this.toNumber(query.page) || 1);
    const skip = (page - 1) * limit;
    const sort = this.mapSort(query.sort);

    const services = await this.serviceModel
      .find({ agent: providerId, status: 'active' })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .populate('subCategory')
      .populate({ path: 'agent', populate: { path: 'user' } });

    return {
      items: services.map((svc) => this.buildServiceCard(svc)),
      page,
      limit,
      hasMore: services.length === limit,
    };
  }

  async markUsage(id: string, userId: string) {
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const exists = (svc.usedBy || []).some((u) => u.toString() === userId);
    if (!exists) {
      svc.usedBy = [...(svc.usedBy || []), new Types.ObjectId(userId)];
      svc.stats = svc.stats || { views: 0, likes: 0, shares: 0, usages: 0, saves: 0, orders: 0 };
      svc.stats.usages += 1;
      svc.stats.orders += 1;
      await svc.save();
      await this.agentModel.findByIdAndUpdate(svc.agent, { $inc: { 'stats.completed': 1 } });
    }
    return { stats: svc.stats, alreadyUsed: exists };
  }

  async rateService(id: string, userId: string, rating: number) {
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    const svc = await this.serviceModel.findById(id);
    if (!svc) throw new NotFoundException('Service not found');
    const used = (svc.usedBy || []).some((u) => u.toString() === userId);
    if (!used) throw new BadRequestException('Service must be used before rating');

    const current = svc.rating || { avg: 0, count: 0 };
    const nextCount = current.count + 1;
    const nextAvg = (current.avg * current.count + rating) / nextCount;
    svc.rating = { avg: Number(nextAvg.toFixed(2)), count: nextCount };
    await svc.save();

    const agent = await this.agentModel.findById(svc.agent);
    if (agent) {
      const agentCount = agent.ratingCount || 0;
      const agentAvg = agent.rating || 0;
      const nextAgentCount = agentCount + 1;
      const nextAgentAvg = (agentAvg * agentCount + rating) / nextAgentCount;
      agent.rating = Number(nextAgentAvg.toFixed(2));
      agent.ratingCount = nextAgentCount;
      await agent.save();
    }

    return { rating: svc.rating };
  }

  private validateServicePayload(
    data: Partial<Service>,
    options: { partial?: boolean; requireTerms?: boolean } = {},
  ) {
    const isPartial = options.partial ?? false;
    const requireTerms = options.requireTerms ?? false;
    if (requireTerms && data.termsAccepted !== true) {
      throw new BadRequestException('Terms must be accepted');
    }
    if (!isPartial || data.title !== undefined) {
      if (!data.title) throw new BadRequestException('Title is required');
    }
    if (!isPartial || data.pricingType !== undefined) {
      if (!data.pricingType) throw new BadRequestException('Pricing type is required');
    }
    if (!isPartial || data.priceMin !== undefined || data.price !== undefined) {
      const priceValue = data.priceMin ?? data.price;
      if (priceValue === undefined || priceValue === null) {
        throw new BadRequestException('Minimum price is required');
      }
    }
    if (!isPartial || data.description !== undefined) {
      if (!data.description) throw new BadRequestException('Description is required');
      const words = this.countWords(data.description);
      if (words > 500) throw new BadRequestException('Description must be 500 words or less');
    }
    if (!isPartial || data.images !== undefined || data.media !== undefined) {
      const images = Array.isArray(data.images) ? data.images : [];
      const mediaImages = Array.isArray(data.media)
        ? data.media.filter((m) => m?.type === 'image' && m?.url).map((m) => m.url)
        : [];
      const combined = images.length ? images : mediaImages;
      if (combined.length < 3) {
        throw new BadRequestException('At least 3 images are required');
      }
      if (combined.length > 20) throw new BadRequestException('No more than 20 images are allowed');
      if (new Set(combined).size !== combined.length) {
        throw new BadRequestException('Images must be unique');
      }
    }
    if (!isPartial || data.credentials !== undefined) {
      if (!Array.isArray(data.credentials) || data.credentials.length === 0) {
        throw new BadRequestException('At least one credential is required');
      }
      data.credentials.forEach((credential) => {
        if (!credential?.label || !credential?.url) {
          throw new BadRequestException('Credential entries must include label and url');
        }
      });
    }
  }

  private countWords(text: string) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  private async resolveCategory(input: string) {
    if (Types.ObjectId.isValid(input)) return input;
    const safe = this.escapeRegex(String(input));
    return this.categoryModel.findOne({ name: new RegExp(`^${safe}$`, 'i') });
  }

  private async resolveCategoryInput(input?: string | Types.ObjectId) {
    if (!input) return null;
    if (Types.ObjectId.isValid(String(input))) return new Types.ObjectId(String(input));
    const safe = this.escapeRegex(String(input));
    const category = await this.categoryModel.findOne({ name: new RegExp(`^${safe}$`, 'i') });
    return category?._id || null;
  }

  private async resolveCategoryBySlugOrId(input?: string) {
    if (!input) return null;
    if (Types.ObjectId.isValid(input)) return this.categoryModel.findById(input);
    const safe = this.escapeRegex(String(input));
    return this.categoryModel.findOne({ slug: new RegExp(`^${safe}$`, 'i') });
  }

  private async buildCategoryFilter(category: ServiceCategoryDocument | null) {
    if (!category) return null;
    const ids = await this.collectDescendantIds(category._id);
    if (!ids.length) return null;
    return {
      $or: [{ category: { $in: ids } }, { subCategory: { $in: ids } }],
    };
  }

  private async collectDescendantIds(rootId: Types.ObjectId) {
    const categories = await this.categoryModel.find({ isActive: { $ne: false } }).select('_id parentId').lean();
    const childrenMap = new Map<string, string[]>();
    categories.forEach((cat) => {
      const parentId = cat.parentId ? String(cat.parentId) : null;
      if (!parentId) return;
      const list = childrenMap.get(parentId) || [];
      list.push(String(cat._id));
      childrenMap.set(parentId, list);
    });
    const ids = new Set<string>();
    const queue = [String(rootId)];
    while (queue.length) {
      const current = queue.pop();
      if (!current || ids.has(current)) continue;
      ids.add(current);
      const children = childrenMap.get(current) || [];
      children.forEach((child) => {
        if (!ids.has(child)) queue.push(child);
      });
    }
    return Array.from(ids).map((id) => new Types.ObjectId(id));
  }

  private mapCategoryType(input: string) {
    const normalized = String(input || '').toLowerCase();
    if (['moddiy', 'material', 'materialy'].includes(normalized)) return 'material';
    if (['manaviy', 'manaviy', 'social', 'spiritual'].includes(normalized)) return 'social';
    return normalized;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private mapSort(order?: string) {
    const normalized = String(order || '').toLowerCase();
    if (['rating', 'top', 'best'].includes(normalized)) return { 'rating.avg': -1, _id: -1 };
    if (['price_low', 'price-min', 'low'].includes(normalized)) return { priceMin: 1, _id: -1 };
    if (['price_high', 'price-max', 'high'].includes(normalized)) return { priceMin: -1, _id: -1 };
    if (['new', 'latest', 'recent'].includes(normalized)) return { createdAt: -1, _id: -1 };
    return { createdAt: -1, _id: -1 };
  }

  private toNumber(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private parseCursor(cursor?: string) {
    if (!cursor) return null;
    const value = String(cursor);
    if (!value.includes('|')) {
      return null;
    }
    const [rawValue, rawId] = value.split('|');
    if (!rawId || !Types.ObjectId.isValid(rawId)) return null;
    return { value: rawValue, id: new Types.ObjectId(rawId) };
  }

  private buildCursorFilter(cursorData: { value: string; id: Types.ObjectId } | null, sortKey: string) {
    if (!cursorData || !cursorData.id) return null;
    const value = cursorData.value;
    if (['price_low', 'price_high', 'low', 'high'].includes(sortKey)) {
      const price = Number(value);
      if (!Number.isFinite(price)) return null;
      return {
        $or: [
          { priceMin: { [sortKey === 'price_low' || sortKey === 'low' ? '$gt' : '$lt']: price } },
          {
            priceMin: price,
            _id: { $lt: cursorData.id },
          },
        ],
      };
    }
    if (sortKey === 'rating') {
      const rating = Number(value);
      if (!Number.isFinite(rating)) return null;
      return {
        $or: [
          { 'rating.avg': { $lt: rating } },
          { 'rating.avg': rating, _id: { $lt: cursorData.id } },
        ],
      };
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
      $or: [
        { createdAt: { $lt: date } },
        { createdAt: date, _id: { $lt: cursorData.id } },
      ],
    };
  }

  private buildNextCursor(service: any, sortKey: string, popularityScoreMap: Map<string, number>) {
    const id = service._id?.toString?.() || '';
    if (!id) return null;
    if (sortKey === 'popular') {
      const score = popularityScoreMap.get(String(service._id)) ?? 0;
      return `${score}|${id}`;
    }
    if (['price_low', 'price_high', 'low', 'high'].includes(sortKey)) {
      const price = service.priceMin ?? 0;
      return `${price}|${id}`;
    }
    if (sortKey === 'rating') {
      const rating = service.rating?.avg ?? 0;
      return `${rating}|${id}`;
    }
    const createdAt = service.createdAt ? new Date(service.createdAt).toISOString() : null;
    return createdAt ? `${createdAt}|${id}` : null;
  }

  private buildServiceCard(service: any) {
    const media = this.normalizeMedia(service);
    const category = this.buildCategorySummary(service.category);
    return {
      id: service._id,
      title: service.title,
      media,
      priceMin: service.priceMin ?? service.price ?? 0,
      pricingType: service.pricingType ?? (service.price ? 'fixed' : undefined),
      currency: service.currency,
      ratingAvg: service.rating?.avg ?? 0,
      ratingCount: service.rating?.count ?? 0,
      stats: {
        views: service.stats?.views ?? 0,
        likes: service.stats?.likes ?? 0,
        saves: service.stats?.saves ?? 0,
      },
      provider: this.buildProviderSummary(service.agent),
      category,
    };
  }

  private buildServiceDetail(service: any) {
    return {
      ...this.buildServiceCard(service),
      slug: service.slug,
      description: service.description,
      deliveryMode: service.deliveryMode,
      serviceArea: service.serviceArea,
      tags: service.tags || [],
      credentials: service.credentials || [],
      status: service.status,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private buildProviderSummary(agent: any) {
    if (!agent) return null;
    const user = agent.user || {};
    return {
      id: agent._id,
      displayName: agent.displayName || user.name,
      avatarUrl: agent.avatarUrl || user.avatarUrl,
      isVerified: agent.verificationStatus === 'verified',
    };
  }

  private buildCategorySummary(category: any) {
    if (!category) return null;
    return {
      id: category._id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || null,
    };
  }

  private normalizeMedia(service: any) {
    if (Array.isArray(service.media) && service.media.length) return service.media;
    if (Array.isArray(service.images)) {
      return service.images.map((url: string) => ({ type: 'image', url }));
    }
    return [];
  }

  private async ensureSeedCategories() {
    const parents = [
      { name: 'Moddiy xizmatlar', slug: 'moddiy-xizmatlar', type: 'material', order: 1 },
      { name: 'Manaviy xizmatlar', slug: 'manaviy-xizmatlar', type: 'social', order: 2 },
    ];

    const parentOps = parents.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: { $setOnInsert: { ...c, isActive: true } },
        upsert: true,
      },
    }));
    await this.categoryModel.bulkWrite(parentOps, { ordered: false });

    const parentDocs = await this.categoryModel.find({ slug: { $in: parents.map((p) => p.slug) } });
    const parentMap = new Map(parentDocs.map((p) => [p.slug, p]));

    const levelOne = [
      { name: 'Delivery', slug: 'delivery', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-truck-line', order: 1 },
      { name: 'Taxi', slug: 'taxi', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-taxi-line', order: 2 },
      { name: 'Repair', slug: 'repair', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-tools-line', order: 3 },
      { name: 'Construction', slug: 'construction', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-hammer-line', order: 4 },
      { name: 'Cleaning', slug: 'cleaning', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-broom-line', order: 5 },
      { name: 'Moving', slug: 'moving', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-home-move-line', order: 6 },
      { name: 'Women Services', slug: 'women-services', type: 'material', parentSlug: 'moddiy-xizmatlar', icon: 'ri-user-heart-line', order: 7 },
      {
        name: "Texnik xizmat ko'rsatish",
        slug: 'texnik-xizmatlar',
        type: 'material',
        parentSlug: 'moddiy-xizmatlar',
        icon: 'ri-tools-fill',
        order: 8,
      },
      {
        name: "Ish topib berish",
        slug: 'ish-topish',
        type: 'material',
        parentSlug: 'moddiy-xizmatlar',
        icon: 'ri-briefcase-4-line',
        order: 9,
      },
      { name: 'Language', slug: 'language', type: 'social', parentSlug: 'manaviy-xizmatlar', icon: 'ri-book-open-line', order: 1 },
      { name: 'Translation', slug: 'translation', type: 'social', parentSlug: 'manaviy-xizmatlar', icon: 'ri-translate', order: 2 },
      { name: 'Legal', slug: 'legal', type: 'social', parentSlug: 'manaviy-xizmatlar', icon: 'ri-scales-3-line', order: 3 },
      { name: 'Consulting', slug: 'consulting', type: 'social', parentSlug: 'manaviy-xizmatlar', icon: 'ri-lightbulb-flash-line', order: 4 },
      { name: 'Education', slug: 'education', type: 'social', parentSlug: 'manaviy-xizmatlar', icon: 'ri-graduation-cap-line', order: 5 },
    ];

    const levelOneOps = levelOne.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: {
          $setOnInsert: {
            name: c.name,
            slug: c.slug,
            type: c.type,
            icon: c.icon,
            order: c.order,
            isActive: true,
            parentId: parentMap.get(c.parentSlug)?._id || null,
          },
        },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(levelOneOps, { ordered: false });

    const levelOneDocs = await this.categoryModel.find({ slug: { $in: levelOne.map((c) => c.slug) } });
    const levelOneMap = new Map(levelOneDocs.map((p) => [p.slug, p]));

    const levelTwo = [
      { name: "Mashinalarni ta'mirlash", slug: 'mashina-tamir', type: 'material', parentSlug: 'texnik-xizmatlar', icon: 'ri-car-line', order: 1 },
      {
        name: "Telefon va kompyuterlar ta'mirlash",
        slug: 'telefon-kompyuter-tamir',
        type: 'material',
        parentSlug: 'texnik-xizmatlar',
        icon: 'ri-smartphone-line',
        order: 2,
      },
      { name: 'Maishiy vositalar', slug: 'maishiy-vositalar', type: 'material', parentSlug: 'texnik-xizmatlar', icon: 'ri-tv-line', order: 3 },
      {
        name: 'Sanoat uskunalari',
        slug: 'sanoat-uskunalari',
        type: 'material',
        parentSlug: 'texnik-xizmatlar',
        icon: 'ri-factory-line',
        order: 4,
      },
      {
        name: "Dasturiy ta'minot va IT xizmatlari",
        slug: 'it-xizmatlar',
        type: 'material',
        parentSlug: 'texnik-xizmatlar',
        icon: 'ri-code-line',
        order: 5,
      },
      { name: 'Doimiy ishlar', slug: 'doimiy-ishlar', type: 'material', parentSlug: 'ish-topish', icon: 'ri-building-4-line', order: 1 },
      { name: 'Vaqtinchalik ishlar', slug: 'vaqtinchalik-ishlar', type: 'material', parentSlug: 'ish-topish', icon: 'ri-timer-line', order: 2 },
    ];

    const levelTwoOps = levelTwo.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: {
          $setOnInsert: {
            name: c.name,
            slug: c.slug,
            type: c.type,
            icon: c.icon,
            order: c.order,
            isActive: true,
            parentId: levelOneMap.get(c.parentSlug)?._id || null,
          },
        },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(levelTwoOps, { ordered: false });

    const levelTwoDocs = await this.categoryModel.find({ slug: { $in: levelTwo.map((c) => c.slug) } });
    const levelTwoMap = new Map(levelTwoDocs.map((p) => [p.slug, p]));

    const levelThree = [
      { name: 'Ichki mexanizmlar', slug: 'mashina-ichki', type: 'material', parentSlug: 'mashina-tamir', icon: 'ri-settings-3-line', order: 1 },
      { name: 'Kuzov (tashqi qism)', slug: 'mashina-kuzov', type: 'material', parentSlug: 'mashina-tamir', icon: 'ri-car-washing-line', order: 2 },
      { name: "Telefon ta'mirlash", slug: 'telefon-tamir', type: 'material', parentSlug: 'telefon-kompyuter-tamir', icon: 'ri-phone-line', order: 1 },
      { name: "Kompyuter ta'mirlash", slug: 'kompyuter-tamir', type: 'material', parentSlug: 'telefon-kompyuter-tamir', icon: 'ri-computer-line', order: 2 },
      { name: "Televizor ta'mirlash", slug: 'televizor-tamir', type: 'material', parentSlug: 'maishiy-vositalar', icon: 'ri-tv-2-line', order: 1 },
      {
        name: 'Kir yuvish mashinasi',
        slug: 'kir-yuvish-mashinasi-tamir',
        type: 'material',
        parentSlug: 'maishiy-vositalar',
        icon: 'ri-bubble-chart-line',
        order: 2,
      },
      { name: 'Chang yutgich', slug: 'changyutgich-tamir', type: 'material', parentSlug: 'maishiy-vositalar', icon: 'ri-blur-off-line', order: 3 },
      { name: 'Konditsioner', slug: 'konditsioner-tamir', type: 'material', parentSlug: 'maishiy-vositalar', icon: 'ri-snowflake-line', order: 4 },
      { name: 'Stanok va liniyalar', slug: 'stanok-tamir', type: 'material', parentSlug: 'sanoat-uskunalari', icon: 'ri-loader-3-line', order: 1 },
      { name: 'Generatorlar', slug: 'generator-tamir', type: 'material', parentSlug: 'sanoat-uskunalari', icon: 'ri-flashlight-line', order: 2 },
      { name: 'Qozonxona va isitish', slug: 'qozonxona-tamir', type: 'material', parentSlug: 'sanoat-uskunalari', icon: 'ri-fire-line', order: 3 },
      { name: "Dasturiy ta'minot o'rnatish", slug: 'software-install', type: 'material', parentSlug: 'it-xizmatlar', icon: 'ri-download-2-line', order: 1 },
      { name: 'Tarmoq sozlash', slug: 'tarmoq-sozlash', type: 'material', parentSlug: 'it-xizmatlar', icon: 'ri-wifi-line', order: 2 },
      { name: 'IT texnik yordam', slug: 'it-yordam', type: 'material', parentSlug: 'it-xizmatlar', icon: 'ri-customer-service-2-line', order: 3 },
    ];

    const levelThreeOps = levelThree.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: {
          $setOnInsert: {
            name: c.name,
            slug: c.slug,
            type: c.type,
            icon: c.icon,
            order: c.order,
            isActive: true,
            parentId: levelTwoMap.get(c.parentSlug)?._id || null,
          },
        },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(levelThreeOps, { ordered: false });
  }

  private async ensureSeedServices() {
    await this.ensureSeedCategories();
    const categories = await this.categoryModel.find({ parentId: { $ne: null } }).lean();
    const allCategories = await this.categoryModel.find().lean();
    const parentMap = new Map<string, any>();
    allCategories.forEach((p) => parentMap.set(String(p._id), p as any));

    const keywordMap: Record<string, string> = {
      delivery: 'courier delivery',
      taxi: 'taxi service',
      repair: 'repair workshop',
      construction: 'construction tools',
      cleaning: 'cleaning service',
      moving: 'moving service',
      'women-services': 'wellness service',
      language: 'language teacher',
      translation: 'translation desk',
      legal: 'legal consultation',
      consulting: 'business consulting',
      education: 'education classroom',
      'ish-topish': 'job placement',
      'doimiy-ishlar': 'factory worker',
      'vaqtinchalik-ishlar': 'temporary job',
      'texnik-xizmatlar': 'technical service',
      'mashina-tamir': 'car repair',
      'mashina-ichki': 'engine repair',
      'mashina-kuzov': 'auto body repair',
      'telefon-kompyuter-tamir': 'electronics repair',
      'telefon-tamir': 'phone repair',
      'kompyuter-tamir': 'computer repair',
      'maishiy-vositalar': 'home appliance repair',
      'televizor-tamir': 'tv repair',
      'kir-yuvish-mashinasi-tamir': 'washing machine repair',
      'changyutgich-tamir': 'vacuum cleaner repair',
      'konditsioner-tamir': 'air conditioner repair',
      'sanoat-uskunalari': 'industrial equipment',
      'stanok-tamir': 'industrial machinery',
      'generator-tamir': 'generator maintenance',
      'qozonxona-tamir': 'boiler service',
      'it-xizmatlar': 'it services',
      'software-install': 'software installation',
      'tarmoq-sozlash': 'network setup',
      'it-yordam': 'it support',
    };

    const buildSeededImageUrl = (keyword: string, seed: string, size: string) =>
      `https://source.unsplash.com/featured/${size}?${encodeURIComponent(keyword)}&sig=${encodeURIComponent(seed)}`;

    for (const category of categories) {
      const parent = parentMap.get(String(category.parentId));
      if (!parent) continue;
      const keyword = keywordMap[category.slug] || String(category.slug || '').replace(/-/g, ' ');
      const providerType = category.type;

      const agents = [];
      for (let idx = 0; idx < 3; idx += 1) {
        const agentEmail = `agent-${category.slug}-${idx + 1}@demo.local`;
        let user = await this.userModel.findOne({ email: agentEmail });
        const avatarUrl = buildSeededImageUrl(`${keyword} person`, `${category.slug}-agent-${idx + 1}`, '400x400');
        if (!user) {
          user = await this.userModel.create({
            name: `${category.name} agent ${idx + 1}`,
            email: agentEmail,
            password: 'Password123!',
            role: 'AGENT',
            avatarUrl,
            bio: `${category.name} boyicha tajribali mutaxassis.`,
          });
        } else {
          let updateNeeded = false;
          if (user.avatarUrl !== avatarUrl) {
            user.avatarUrl = avatarUrl;
            updateNeeded = true;
          }
          if (user.name !== `${category.name} agent ${idx + 1}`) {
            user.name = `${category.name} agent ${idx + 1}`;
            updateNeeded = true;
          }
          if (user.bio !== `${category.name} boyicha tajribali mutaxassis.`) {
            user.bio = `${category.name} boyicha tajribali mutaxassis.`;
            updateNeeded = true;
          }
          if (updateNeeded) {
            await user.save();
          }
        }

        let agent = await this.agentModel.findOne({ user: user._id });
        if (!agent) {
          agent = await this.agentModel.create({
            user: user._id,
            agentType: 'service',
            providerType,
            displayName: user.name,
            avatarUrl: user.avatarUrl,
            verificationStatus: 'verified',
            rating: 4.2 + idx * 0.2,
            ratingCount: 12 + idx * 4,
            stats: {
              completed: 28 + idx * 6,
              likes: 18 + idx * 5,
              shares: 7 + idx * 3,
              followers: 45 + idx * 9,
            },
          });
        } else if (agent.avatarUrl !== user.avatarUrl || agent.displayName !== user.name) {
          agent.avatarUrl = user.avatarUrl;
          agent.displayName = user.name;
          await agent.save();
        }
        agents.push(agent);
      }

      for (let idx = 0; idx < 10; idx += 1) {
        const slug = `seed-${category.slug}-${idx + 1}`;
        const agent = agents[idx % agents.length];
        const priceBase = 50000 + idx * 10000;
        const media = Array.from({ length: 3 }, (_, mediaIdx) => ({
          type: 'image',
          url: buildSeededImageUrl(keyword, `${category.slug}-svc-${idx + 1}-${mediaIdx + 1}`, '900x600'),
        }));
        const images = media.map((item) => item.url);
        await this.serviceModel.updateOne(
          { slug },
          {
            $setOnInsert: {
              slug,
              tab: providerType,
              agent: agent._id,
              category: parent._id,
              subCategory: category._id,
              title: `${category.name} xizmati ${idx + 1}`,
              description: `${category.name} bo'yicha professional xizmat (demo).`,
              pricingType: 'fixed',
              priceMin: priceBase,
              priceMax: priceBase + 50000,
              currency: 'KRW',
              tags: [category.slug, providerType],
              deliveryMode: providerType === 'social' ? 'online' : 'offline',
              media,
              images,
              credentials: [
                { label: 'Sertifikat', url: `https://example.com/docs/${slug}-cert.pdf` },
                { label: 'Litsenziya', url: `https://example.com/docs/${slug}-license.pdf` },
              ],
              rating: { avg: 4.1 + (idx % 3) * 0.2, count: 8 + idx },
              stats: { views: 80 + idx * 5, likes: 12 + idx, shares: 4 + idx, usages: 20 + idx, saves: 6 + idx, orders: 5 + idx },
              status: 'active',
            },
          },
          { upsert: true },
        );
      }
    }
  }
}
