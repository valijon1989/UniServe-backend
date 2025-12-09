import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { ProductCategory, ProductCategoryDocument } from './schemas/product-category.schema';

type SortOrder = 'createdAt' | 'priceLow' | 'priceHigh' | 'popular' | 'rating' | 'best';

@Injectable()
export class ProductsService {
  private readonly cacheTtlMs = 60 * 1000;
  private readonly detailCache = new Map<string, { expiresAt: number; value: any }>();
  private popularCache: { key: string; expiresAt: number; value: any } | null = null;

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductCategory.name) private readonly categoryModel: Model<ProductCategoryDocument>,
  ) {}

  async list(query: any) {
    const page = Math.max(1, this.toNumber(query.page) || 1);
    const limit = Math.max(1, Math.min(100, this.toNumber(query.limit) || 12));

    const priceMin = this.toNumber(query.priceMin);
    const priceMax = this.toNumber(query.priceMax);
    const ratingMin = this.toNumber(query.ratingMin);

    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      throw new BadRequestException('priceMin cannot be greater than priceMax');
    }

    const filters: any = {};
    if (query.category) {
      filters.category = this.mapCategorySlug(query.category);
    }
    if (query.subCategory) filters.subCategory = query.subCategory;
    if (query.vendorId) filters.vendor = query.vendorId;
    if (query.brand) filters.brand = query.brand;
    if (query.condition) filters.condition = query.condition;
    if (priceMin !== undefined || priceMax !== undefined) {
      filters.price = {};
      if (priceMin !== undefined) filters.price.$gte = priceMin;
      if (priceMax !== undefined) filters.price.$lte = priceMax;
    }
    if (ratingMin !== undefined) {
      filters['rating.avg'] = { $gte: ratingMin };
    }

    const hasFilters =
      Boolean(filters.subCategory) ||
      Boolean(filters.vendor) ||
      Boolean(filters.price) ||
      Boolean(filters['rating.avg']) ||
      Boolean(filters.brand) ||
      Boolean(filters.condition) ||
      Boolean(search);

    const order: SortOrder = query.order || (hasFilters ? 'createdAt' : 'best');
    const sort = this.getSort(order);
    const search = typeof query.search === 'string' ? query.search.trim() : '';

    const foodSubCategories = ['tayyor-maxsulotlar', 'yarim-tayyor-maxsulotlar', 'bolalar', 'gushtli-maxsulotlar', 'exclusive'];
    const electronicsSubCategories = ['pc', 'mobile', 'tv', 'game', 'cameras', 'others'];
    const clothingSubCategories = [
      'erkaklar',
      'ayollar',
      'bolalar-kiyim',
      'bolalar-keksalar',
      'sport',
      'poyabzal',
      'aksesuar',
      'maxsus',
    ];
    const beautySubCategories = [
      'atirlar',
      'yuz-kremlari',
      'soch-parvarishi',
      'makiyaj',
      'gigiena',
      'tana-parvarishi',
      'qol-oyoq',
      'erkaklar-parvarishi',
      'quyosh-himoya',
      'muammoli-teri',
    ];
    const autoSubCategories = ['avtomobil', 'avtomobil-extiyot-qismlari', 'texnika', 'texnika-extiyot-qismlari'];
    const homeSubCategories = ['chang-yutkich', 'kir-yuvish', 'oshxona-texnikalari', 'sovutkich', 'muzlatkich', 'havo-sovutgich', 'havo-tozalagich', 'others'];
    const isFoodCategory =
      filters.category === 'oziq-ovqat' ||
      filters.category === 'food' ||
      filters.subCategory === 'oziq-ovqat' ||
      filters.subCategory === 'food' ||
      foodSubCategories.includes(filters.subCategory);
    const isElectronicsCategory =
      filters.category === 'elektronika' ||
      filters.category === 'electronics' ||
      filters.subCategory === 'elektronika' ||
      filters.subCategory === 'electronics' ||
      electronicsSubCategories.includes(filters.subCategory);
    const isClothingCategory =
      filters.category === 'kiyim-kechak' ||
      filters.category === 'clothing' ||
      filters.subCategory === 'kiyim-kechak' ||
      filters.subCategory === 'clothing' ||
      clothingSubCategories.includes(filters.subCategory);
    const isBeautyCategory =
      filters.category === 'gozallik' ||
      filters.category === 'beauty' ||
      filters.subCategory === 'gozallik' ||
      filters.subCategory === 'beauty' ||
      beautySubCategories.includes(filters.subCategory);
    const isAutoCategory =
      filters.category === 'avto-texnika' ||
      filters.subCategory === 'avto-texnika' ||
      autoSubCategories.includes(filters.subCategory);
    const isHomeCategory =
      filters.category === 'maishiy-uskunalar' ||
      filters.subCategory === 'maishiy-uskunalar' ||
      homeSubCategories.includes(filters.subCategory);
    if (isFoodCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedFoodProducts();
    }
    if (isElectronicsCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedElectronicsProducts();
    }
    if (isClothingCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedClothingProducts();
    }
    if (isBeautyCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedBeautyProducts();
    }
    if (isAutoCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedAutoProducts();
    }
    if (isHomeCategory) {
      await this.ensureSeedCategories();
      await this.ensureSeedHomeProducts();
    }

    const usePopularCache =
      (order === 'popular' || order === 'best') &&
      !search &&
      !filters.category &&
      !filters.subCategory &&
      !filters.vendor &&
      !filters.price &&
      !filters['rating.avg'] &&
      page === 1;
    const cacheKey = usePopularCache ? JSON.stringify({ order, page, limit }) : undefined;
    if (usePopularCache && this.popularCache && this.popularCache.key === cacheKey && this.popularCache.expiresAt > Date.now()) {
      return this.popularCache.value;
    }

    const result = await this.fetchWithSearch(filters, search, sort, page, limit);
    if (usePopularCache) {
      this.popularCache = { key: cacheKey!, expiresAt: Date.now() + this.cacheTtlMs, value: result };
    }
    return result;
  }

  async detail(idOrSlug: string) {
    await this.incrementStat(idOrSlug, 'views', false);
    this.popularCache = null;
    const cached = this.detailCache.get(idOrSlug);
    if (cached && cached.expiresAt > Date.now()) {
      const nextValue = {
        ...cached.value,
        stats: {
          ...(cached.value.stats || { views: 0, likes: 0, purchases: 0 }),
          views: (cached.value.stats?.views || 0) + 1,
        },
      };
      this.detailCache.set(idOrSlug, { expiresAt: Date.now() + this.cacheTtlMs, value: nextValue });
      return nextValue;
    }

    const product = await this.findOrStubProduct(idOrSlug);

    if (!product) throw new NotFoundException('Product not found');

    const vendorMeta = await this.buildVendorMeta(product.vendor as any);
    const payload = this.mapDetailProduct(product, vendorMeta.totalProducts);
    this.detailCache.set(idOrSlug, { expiresAt: Date.now() + this.cacheTtlMs, value: payload });
    return payload;
  }

  async incrementStat(idOrSlug: string, field: 'views' | 'likes' | 'purchases', invalidateCache = true) {
    const update = { $inc: { [`stats.${field}`]: 1 } };
    let product = await this.productModel
      .findOneAndUpdate(
        Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug },
        update,
        { new: true },
      )
      .populate({ path: 'vendor', populate: { path: 'user', select: 'name avatarUrl' } });
    if (!product) {
      await this.ensureStubProduct(idOrSlug);
      product = await this.productModel
        .findOneAndUpdate(
          Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug },
          update,
          { new: true },
        )
        .populate({ path: 'vendor', populate: { path: 'user', select: 'name avatarUrl' } });
    }
    if (!product) throw new NotFoundException('Product not found');
    if (invalidateCache) {
      this.detailCache.delete(idOrSlug);
      this.popularCache = null;
    }
    return { stats: product.stats };
  }

  async listCategories() {
    await this.ensureSeedCategories();
    const categories = await this.categoryModel.find({ parent: null }).sort({ order: 1, name: 1 }).lean();
    return { categories };
  }

  async listSubCategories(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Category not found');
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Category not found');
    await this.ensureSeedFoodSubCategories(category);
    await this.ensureSeedElectronicsSubCategories(category);
    await this.ensureSeedClothingSubCategories(category);
    await this.ensureSeedBeautySubCategories(category);
    await this.ensureSeedAutoSubCategories(category);
    await this.ensureSeedHomeSubCategories(category);
    return this.categoryModel.find({ parent: id }).lean();
  }

  private async fetchWithSearch(filters: any, search: string, sort: Record<string, any>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    let searchFilter = { ...filters };
    let projection: any = undefined;
    let sortSpec: Record<string, any> = { ...sort };

    if (search) {
      searchFilter = { ...filters, $text: { $search: search } };
      projection = { score: { $meta: 'textScore' } };
      sortSpec = { score: { $meta: 'textScore' }, ...sort };
    }

    let [products, total] = await Promise.all([
      this.productModel
        .find(searchFilter, projection)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .populate({ path: 'vendor', populate: { path: 'user', select: 'name avatarUrl' } })
        .lean(),
      this.productModel.countDocuments(searchFilter),
    ]);

    if (search && total === 0) {
      const regex = new RegExp(search, 'i');
      searchFilter = { ...filters, $or: [{ name: regex }, { description: regex }, { vendorName: regex }] };
      projection = undefined;
      sortSpec = { ...sort };
      [products, total] = await Promise.all([
        this.productModel
          .find(searchFilter, projection)
          .sort(sortSpec)
          .skip(skip)
          .limit(limit)
          .populate({ path: 'vendor', populate: { path: 'user', select: 'name avatarUrl' } })
          .lean(),
        this.productModel.countDocuments(searchFilter),
      ]);
    }

    const totalPages = limit ? Math.ceil(total / limit) : 0;
    return {
      page,
      limit,
      total,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      products: products.map((p) => this.mapListProduct(p)),
    };
  }

  private getSort(order: SortOrder) {
    const sortMap: Record<SortOrder, Record<string, 1 | -1>> = {
      createdAt: { createdAt: -1 },
      priceLow: { price: 1 },
      priceHigh: { price: -1 },
      popular: { 'stats.views': -1 },
      rating: { 'rating.avg': -1 },
      best: { 'stats.purchases': -1, 'stats.likes': -1, 'stats.views': -1 },
    };
    const sort = sortMap[order];
    if (!sort) throw new BadRequestException('Invalid order');
    return sort;
  }

  private toNumber(value: any): number | undefined {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private mapListProduct(product: any) {
    return {
      _id: product._id?.toString?.() ?? product._id,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice,
      rating: product.rating || { avg: 0, count: 0 },
      stats: product.stats || { views: 0, likes: 0, purchases: 0 },
      thumbnail: product.thumbnail || product.images?.[0] || null,
      vendor: this.mapVendor(product.vendor),
    };
  }

  private mapDetailProduct(product: any, totalProducts?: number) {
    const vendor = this.mapVendor(product.vendor);
    return {
      _id: product._id?.toString?.() ?? product._id,
      name: product.name,
      vendorId: product.vendor?._id?.toString?.() || product.vendor,
      category: product.category,
      subCategory: product.subCategory,
      price: product.price,
      oldPrice: product.oldPrice,
      rating: product.rating || { avg: 0, count: 0 },
      stats: product.stats || { views: 0, likes: 0, purchases: 0 },
      images: product.images || [],
      thumbnail: product.thumbnail || product.images?.[0] || null,
      description: product.description,
      specifications: product.specifications || {},
      vendor: vendor
        ? {
            ...vendor,
            totalProducts: totalProducts ?? 0,
            rating: vendor.rating ?? product.vendor?.rating,
            verified: product.vendor?.verificationStatus === 'verified',
          }
        : undefined,
    };
  }

  private mapVendor(vendor: any) {
    if (!vendor) return undefined;
    const user = vendor.user as any;
    return {
      _id: vendor._id?.toString?.() ?? vendor,
      name: user?.name || vendor.vendorName || vendor.name,
      rating: vendor.rating,
    };
  }

  private async buildVendorMeta(vendor: any) {
    const vendorId = vendor?._id?.toString?.() || vendor?.toString?.();
    const totalProducts = vendorId ? await this.productModel.countDocuments({ vendor: vendorId }) : 0;
    return { totalProducts };
  }

  private mapCategorySlug(input: string) {
    const normalized = String(input || '').toLowerCase();
    const map: Record<string, string> = {
      electronics: 'elektronika',
      elektronika: 'elektronika',
      clothing: 'kiyim-kechak',
      'kiyim-kechak': 'kiyim-kechak',
      food: 'oziq-ovqat',
      'oziq-ovqat': 'oziq-ovqat',
      beauty: 'gozallik',
      gozallik: 'gozallik',
      'auto-tech': 'avto-texnika',
      auto: 'avto-texnika',
      'avto-texnika': 'avto-texnika',
      home: 'maishiy-uskunalar',
      appliances: 'maishiy-uskunalar',
      'maishiy-uskunalar': 'maishiy-uskunalar',
    };
    return map[normalized] || input;
  }

  private async ensureSeedCategories() {
    const defaults = [
      {
        slug: 'oziq-ovqat',
        name: "Oziq-ovqat",
        icon: 'ri-restaurant-line',
        order: 1,
        backgroundColor: '#e7f6e8', // yashil ohang
        accentColor: '#2e7d32',
      },
      {
        slug: 'elektronika',
        name: 'Elektronika',
        icon: 'ri-smartphone-line',
        order: 2,
        backgroundColor: '#e8f0ff', // elektr ko'k ohang
        accentColor: '#2962ff',
      },
      {
        slug: 'kiyim-kechak',
        name: 'Kiyim-kechak',
        icon: 'ri-t-shirt-line',
        order: 3,
        backgroundColor: '#fff3e0', // yorqin issiq ohang
        accentColor: '#ff6f00',
      },
      {
        slug: 'gozallik',
        name: "Go'zallik",
        icon: 'ri-magic-line',
        order: 4,
        backgroundColor: '#ffe6f2', // pushti
        accentColor: '#ec407a',
      },
      {
        slug: 'avto-texnika',
        name: 'Avtomabil va texnika',
        icon: 'ri-car-line',
        order: 5,
        backgroundColor: '#e9ecf3', // neytral tex ohang
        accentColor: '#455a64',
      },
      {
        slug: 'maishiy-uskunalar',
        name: 'Maishiy uskunalar',
        icon: 'ri-home-gear-line',
        order: 6,
        backgroundColor: '#f2f8e4', // sariq-yashil
        accentColor: '#7cb342',
      },
    ];

    const ops = defaults.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: { $setOnInsert: c },
        upsert: true,
      },
    }));
    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedFoodSubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'oziq-ovqat') return;

    const subs = [
      { slug: 'tayyor-maxsulotlar', name: 'Tayyor mahsulotlar' },
      { slug: 'yarim-tayyor-maxsulotlar', name: 'Yarim tayyor mahsulotlar' },
      { slug: 'bolalar', name: 'Bolalar' },
      { slug: 'gushtli-maxsulotlar', name: "Go'shtli mahsulotlar" },
      { slug: 'exclusive', name: 'Exclusive' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedElectronicsSubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'elektronika') return;

    const subs = [
      { slug: 'pc', name: 'PC' },
      { slug: 'mobile', name: 'Mobile' },
      { slug: 'tv', name: 'TV' },
      { slug: 'game', name: 'Game' },
      { slug: 'cameras', name: 'Cameras' },
      { slug: 'others', name: 'Others' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedClothingSubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'kiyim-kechak') return;

    const subs = [
      { slug: 'erkaklar', name: 'Erkaklar' },
      { slug: 'ayollar', name: 'Ayollar' },
      { slug: 'bolalar-kiyim', name: 'Bolalar' },
      { slug: 'bolalar-keksalar', name: 'Bolalar va keksalar' },
      { slug: 'sport', name: 'Sport' },
      { slug: 'poyabzal', name: 'Poyabzal' },
      { slug: 'aksesuar', name: 'Aksesuarlar' },
      { slug: 'maxsus', name: 'Maxsus bo‘lim' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedBeautySubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'gozallik') return;

    const subs = [
      { slug: 'atirlar', name: 'Atirlar' },
      { slug: 'yuz-kremlari', name: 'Yuz kremlari' },
      { slug: 'soch-parvarishi', name: 'Soch uchun vositalar' },
      { slug: 'makiyaj', name: 'Makiyaj vositalari' },
      { slug: 'gigiena', name: 'Gigiena' },
      { slug: 'tana-parvarishi', name: 'Tana parvarishi' },
      { slug: 'qol-oyoq', name: "Qo'l-oyoq parvarishi" },
      { slug: 'erkaklar-parvarishi', name: 'Erkaklar parvarishi' },
      { slug: 'quyosh-himoya', name: 'Quyoshdan himoya' },
      { slug: 'muammoli-teri', name: 'Muammoli teri uchun' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedAutoSubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'avto-texnika') return;

    const subs = [
      { slug: 'avtomobil', name: 'Avtomobil' },
      { slug: 'avtomobil-extiyot-qismlari', name: 'Avtomobil ehtiyot qismlari' },
      { slug: 'texnika', name: 'Texnika' },
      { slug: 'texnika-extiyot-qismlari', name: 'Texnika ehtiyot qismlari' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedHomeSubCategories(parentCategory: ProductCategoryDocument) {
    if (!parentCategory || parentCategory.slug !== 'maishiy-uskunalar') return;

    const subs = [
      { slug: 'chang-yutkich', name: 'Chang yutkich' },
      { slug: 'kir-yuvish', name: 'Kir yuvish mashinasi' },
      { slug: 'oshxona-texnikalari', name: 'Oshxona texnikalari' },
      { slug: 'sovutkich', name: 'Sovutkich' },
      { slug: 'muzlatkich', name: 'Muzlatkich' },
      { slug: 'havo-sovutgich', name: 'Havo sovutgich' },
      { slug: 'havo-tozalagich', name: 'Havo tozalagich' },
      { slug: 'others', name: 'Others' },
    ];

    const ops = subs.map((s, idx) => ({
      updateOne: {
        filter: { slug: s.slug, parent: parentCategory._id },
        update: { $setOnInsert: { ...s, parent: parentCategory._id, order: idx + 1 } },
        upsert: true,
      },
    }));

    await this.categoryModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedFoodProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'tayyor-osh-1',
        name: 'Palov to‘plami',
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 120000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tayyor-salat-1',
        name: 'Vitaminli salat',
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 65000,
        thumbnail: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tayyor-shorva-1',
        name: "Go'shtli sho'rva",
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 80000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ready-1',
        name: 'Tayyor taom box (ready-1)',
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 115000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ready-2',
        name: 'Tayyor salat (ready-2)',
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 65000,
        thumbnail: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ready-3',
        name: 'Tayyor sho‘rva (ready-3)',
        subCategory: 'tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 85000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'yarim-tayyor-manti',
        name: 'Yarim tayyor manti',
        subCategory: 'yarim-tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 90000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'yarim-tayyor-pelmeni',
        name: 'Pelmeni to‘plami',
        subCategory: 'yarim-tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 75000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'yarim-tayyor-kotlet',
        name: 'Kotlet (yarim tayyor)',
        subCategory: 'yarim-tayyor-maxsulotlar',
        brand: 'Demo Kitchen',
        price: 85000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-pyure',
        name: 'Bolalar pyuresi',
        subCategory: 'bolalar',
        brand: 'Kids Taste',
        price: 45000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-snek',
        name: 'Organik snek',
        subCategory: 'bolalar',
        brand: 'Kids Taste',
        price: 35000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-sharbat',
        name: 'Tabiiy sharbat',
        subCategory: 'bolalar',
        brand: 'Kids Taste',
        price: 28000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gushtli-steak',
        name: "Mol go'shti steyk",
        subCategory: 'gushtli-maxsulotlar',
        brand: 'Prime Beef',
        price: 180000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gushtli-qiyma',
        name: 'Mol qiyma',
        subCategory: 'gushtli-maxsulotlar',
        brand: 'Prime Beef',
        price: 90000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gushtli-kolbasa',
        name: 'Tabaq kolbasa',
        subCategory: 'gushtli-maxsulotlar',
        brand: 'Prime Beef',
        price: 110000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'exclusive-sushi',
        name: 'Exclusive sushi boks',
        subCategory: 'exclusive',
        price: 240000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'exclusive-steak-premium',
        name: 'Premium steyk set',
        subCategory: 'exclusive',
        price: 320000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'exclusive-diet',
        name: 'Dietik gurme to‘plam',
        subCategory: 'exclusive',
        price: 210000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            category: 'oziq-ovqat',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} mahsuloti (demo).`,
            rating: { avg: 4 + (idx % 2 ? 0.3 : 0.1), count: 10 + idx },
            stats: { views: 100 + idx * 3, likes: 10 + idx, purchases: 5 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedElectronicsProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'pc-gaming-1',
        name: 'Gaming PC RTX',
        subCategory: 'pc',
        brand: 'MSI',
        condition: 'new',
        price: 8500000,
        thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'pc-1',
        name: 'Office PC (pc-1)',
        subCategory: 'pc',
        brand: 'Lenovo',
        condition: 'new',
        price: 2800000,
        thumbnail: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'pc-office-1',
        name: 'Office PC i5',
        subCategory: 'pc',
        brand: 'Dell',
        condition: 'used',
        price: 3200000,
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'pc-2',
        name: 'Mini PC (pc-2)',
        subCategory: 'pc',
        brand: 'Intel',
        condition: 'new',
        price: 2600000,
        thumbnail: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'pc-mini-1',
        name: 'Mini PC',
        subCategory: 'pc',
        brand: 'Intel',
        condition: 'new',
        price: 2900000,
        thumbnail: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'pc-3',
        name: 'Gaming PC (pc-3)',
        subCategory: 'pc',
        brand: 'Asus',
        condition: 'used',
        price: 4500000,
        thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'mobile-flagship-1',
        name: 'Flagship Smartphone',
        subCategory: 'mobile',
        brand: 'Samsung',
        condition: 'new',
        price: 11000000,
        thumbnail: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35f6?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'mobile-budget-1',
        name: 'Budget Phone',
        subCategory: 'mobile',
        brand: 'Xiaomi',
        condition: 'new',
        price: 2200000,
        thumbnail: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35f6?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'mobile-used-1',
        name: 'Second-hand Phone',
        subCategory: 'mobile',
        brand: 'Apple',
        condition: 'used',
        price: 4500000,
        thumbnail: 'https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tv-4k-1',
        name: '4K Smart TV',
        subCategory: 'tv',
        brand: 'LG',
        condition: 'new',
        price: 6400000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tv-oled-1',
        name: 'OLED TV',
        subCategory: 'tv',
        brand: 'Sony',
        condition: 'new',
        price: 9800000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tv-used-1',
        name: 'Used LED TV',
        subCategory: 'tv',
        brand: 'Samsung',
        condition: 'used',
        price: 2400000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'game-console-1',
        name: 'Next-gen Console',
        subCategory: 'game',
        brand: 'Sony',
        condition: 'new',
        price: 5500000,
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'game-handheld-1',
        name: 'Handheld Console',
        subCategory: 'game',
        brand: 'Nintendo',
        condition: 'new',
        price: 3200000,
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'game-used-1',
        name: 'Used Console',
        subCategory: 'game',
        brand: 'Microsoft',
        condition: 'used',
        price: 2800000,
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'camera-1',
        name: 'Mirrorless Camera',
        subCategory: 'cameras',
        brand: 'Canon',
        condition: 'new',
        price: 7800000,
        thumbnail: 'https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'camera-2',
        name: 'Action Camera',
        subCategory: 'cameras',
        brand: 'GoPro',
        condition: 'new',
        price: 2900000,
        thumbnail: 'https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'camera-used-1',
        name: 'Used DSLR',
        subCategory: 'cameras',
        brand: 'Nikon',
        condition: 'used',
        price: 3500000,
        thumbnail: 'https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'other-smartwatch-1',
        name: 'Smart Watch',
        subCategory: 'others',
        brand: 'Apple',
        condition: 'new',
        price: 2500000,
        thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'other-headphones-1',
        name: 'Wireless Headphones',
        subCategory: 'others',
        brand: 'Sony',
        condition: 'new',
        price: 1200000,
        thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'other-used-1',
        name: 'Used Accessories Box',
        subCategory: 'others',
        brand: 'Logitech',
        condition: 'used',
        price: 450000,
        thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            brand: p.brand,
            category: 'elektronika',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} (demo elektronika).`,
            condition: p.condition || 'new',
            rating: { avg: 4 + (idx % 2 ? 0.2 : 0.4), count: 12 + idx },
            stats: { views: 150 + idx * 4, likes: 15 + idx, purchases: 7 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedClothingProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'erkaklar-tshirt-1',
        name: 'Erkaklar T-shirt',
        subCategory: 'erkaklar',
        brand: 'UniWear',
        condition: 'new',
        price: 180000,
        thumbnail: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'erkaklar-jinsi-1',
        name: 'Erkaklar jinsi shim',
        subCategory: 'erkaklar',
        brand: 'DenimPro',
        condition: 'new',
        price: 320000,
        thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'erkaklar-kurtka-1',
        name: 'Yupqa kurtka',
        subCategory: 'erkaklar',
        brand: 'Windy',
        condition: 'used',
        price: 260000,
        thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ayollar-bluzka-1',
        name: 'Ayollar bluzka',
        subCategory: 'ayollar',
        brand: 'Velvet',
        condition: 'new',
        price: 210000,
        thumbnail: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ayollar-kofta-1',
        name: 'Ayollar kofta',
        subCategory: 'ayollar',
        brand: 'SoftLine',
        condition: 'new',
        price: 195000,
        thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'ayollar-plash-1',
        name: 'Ayollar plasch',
        subCategory: 'ayollar',
        brand: 'Velvet',
        condition: 'used',
        price: 300000,
        thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-kiyim-set-1',
        name: 'Bolalar kiyim set',
        subCategory: 'bolalar-kiyim',
        brand: 'KidsLine',
        condition: 'new',
        price: 160000,
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-kiyim-sport-1',
        name: 'Sportivka bolalar',
        subCategory: 'bolalar-kiyim',
        brand: 'KidsLine',
        condition: 'new',
        price: 155000,
        thumbnail: 'https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-kiyim-kurtka-1',
        name: 'Bolalar kurtka',
        subCategory: 'bolalar-kiyim',
        brand: 'KidsLine',
        condition: 'used',
        price: 140000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'sport-forma-1',
        name: 'Sport forma',
        subCategory: 'sport',
        brand: 'Athletix',
        condition: 'new',
        price: 230000,
        thumbnail: 'https://images.unsplash.com/photo-1503342332010-b0bd6f5f0edc?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'sport-leggins-1',
        name: 'Sport leggins',
        subCategory: 'sport',
        brand: 'Athletix',
        condition: 'new',
        price: 175000,
        thumbnail: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'sport-hoodie-1',
        name: 'Sport hoodie',
        subCategory: 'sport',
        brand: 'RunPro',
        condition: 'used',
        price: 185000,
        thumbnail: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'poyabzal-kross-1',
        name: 'Krossovka',
        subCategory: 'poyabzal',
        brand: 'Runner',
        condition: 'new',
        price: 350000,
        thumbnail: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'poyabzal-tufli-1',
        name: 'Klassik tufli',
        subCategory: 'poyabzal',
        brand: 'ClassicFit',
        condition: 'new',
        price: 420000,
        thumbnail: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'poyabzal-yozgi-1',
        name: 'Yozgi poyafzal',
        subCategory: 'poyabzal',
        brand: 'SunnyWalk',
        condition: 'used',
        price: 190000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'aksesuar-soat-1',
        name: 'Soat (aksesuar)',
        subCategory: 'aksesuar',
        brand: 'TimeUp',
        condition: 'new',
        price: 270000,
        thumbnail: 'https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'aksesuar-sumka-1',
        name: 'Sumka',
        subCategory: 'aksesuar',
        brand: 'Bagify',
        condition: 'new',
        price: 310000,
        thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'aksesuar-belbog-1',
        name: 'Belbog',
        subCategory: 'aksesuar',
        brand: 'LeatherCraft',
        condition: 'used',
        price: 145000,
        thumbnail: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-keksalar-set-1',
        name: 'Bolalar va keksalar cozy set',
        subCategory: 'bolalar-keksalar',
        brand: 'ComfortLine',
        condition: 'new',
        price: 185000,
        thumbnail: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-keksalar-cardigan-1',
        name: 'Yumshoq kardigan',
        subCategory: 'bolalar-keksalar',
        brand: 'ComfortLine',
        condition: 'new',
        price: 210000,
        thumbnail: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'bolalar-keksalar-non-slip-1',
        name: 'Non-slip paypoq',
        subCategory: 'bolalar-keksalar',
        brand: 'SafeStep',
        condition: 'new',
        price: 75000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'maxsus-eko-1',
        name: 'Eko material kostyum',
        subCategory: 'maxsus',
        brand: 'EcoWear',
        condition: 'new',
        price: 420000,
        thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'maxsus-premium-1',
        name: 'Premium limited hoodie',
        subCategory: 'maxsus',
        brand: 'LimitedLine',
        condition: 'new',
        price: 380000,
        thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'maxsus-tech-1',
        name: 'Techwear kurtka',
        subCategory: 'maxsus',
        brand: 'UrbanTech',
        condition: 'new',
        price: 450000,
        thumbnail: 'https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80',
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            brand: p.brand,
            category: 'kiyim-kechak',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} (demo kiyim-kechak).`,
            condition: p.condition || 'new',
            rating: { avg: 4 + (idx % 2 ? 0.25 : 0.35), count: 8 + idx },
            stats: { views: 90 + idx * 2, likes: 9 + idx, purchases: 4 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedBeautyProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'atir-ayollar-1',
        name: 'Ayollar atiri (floral)',
        subCategory: 'atirlar',
        brand: 'Lumiere',
        condition: 'new',
        price: 550000,
        thumbnail: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'atir-erkaklar-1',
        name: 'Erkaklar atiri (woody)',
        subCategory: 'atirlar',
        brand: 'Noir',
        condition: 'new',
        price: 520000,
        thumbnail: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'atir-unisex-1',
        name: 'Unisex atir (fresh)',
        subCategory: 'atirlar',
        brand: 'Pure Air',
        condition: 'new',
        price: 480000,
        thumbnail: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'krem-yuz-1',
        name: 'Namlovchi yuz kremi',
        subCategory: 'yuz-kremlari',
        brand: 'DermaSoft',
        condition: 'new',
        price: 220000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'krem-antiage-1',
        name: 'Anti-age krem',
        subCategory: 'yuz-kremlari',
        brand: 'TimeLess',
        condition: 'new',
        price: 310000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'krem-spf-1',
        name: 'SPF yuz kremi',
        subCategory: 'yuz-kremlari',
        brand: 'SunCare',
        condition: 'new',
        price: 190000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'soch-shampun-1',
        name: 'Kuchaytiruvchi shampun',
        subCategory: 'soch-parvarishi',
        brand: 'HairBoost',
        condition: 'new',
        price: 95000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'soch-balm-1',
        name: 'Soch balzami',
        subCategory: 'soch-parvarishi',
        brand: 'Silky',
        condition: 'new',
        price: 88000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'soch-elsep-1',
        name: 'Soch yog‘i',
        subCategory: 'soch-parvarishi',
        brand: 'ArganOil',
        condition: 'new',
        price: 135000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'makiyaj-tush-1',
        name: 'Ko‘zlar uchun tush',
        subCategory: 'makiyaj',
        brand: 'GlamLook',
        condition: 'new',
        price: 120000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'makiyaj-ruj-1',
        name: 'Mat ruj',
        subCategory: 'makiyaj',
        brand: 'GlamLook',
        condition: 'new',
        price: 110000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'makiyaj-tonal-1',
        name: 'Tonal krem',
        subCategory: 'makiyaj',
        brand: 'GlowUp',
        condition: 'new',
        price: 180000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gigiena-deo-1',
        name: 'Dezodorant',
        subCategory: 'gigiena',
        brand: 'FreshLine',
        condition: 'new',
        price: 85000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gigiena-gel-1',
        name: 'Dush geli',
        subCategory: 'gigiena',
        brand: 'FreshLine',
        condition: 'new',
        price: 75000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'gigiena-scrub-1',
        name: 'Tana skrubi',
        subCategory: 'gigiena',
        brand: 'FreshLine',
        condition: 'new',
        price: 99000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tana-losyon-1',
        name: 'Tana losyoni',
        subCategory: 'tana-parvarishi',
        brand: 'BodyCare',
        condition: 'new',
        price: 125000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tana-peeling-1',
        name: 'Tana pilingi',
        subCategory: 'tana-parvarishi',
        brand: 'BodyCare',
        condition: 'new',
        price: 135000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'tana-yog-1',
        name: 'Tana yog‘i',
        subCategory: 'tana-parvarishi',
        brand: 'BodyCare',
        condition: 'new',
        price: 145000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'qol-krem-1',
        name: "Qo'l kremi",
        subCategory: 'qol-oyoq',
        brand: 'HandSoft',
        condition: 'new',
        price: 65000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'oyoq-krem-1',
        name: 'Oyoq kremi',
        subCategory: 'qol-oyoq',
        brand: 'FootCare',
        condition: 'new',
        price: 70000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'qol-oyoq-skrab-1',
        name: "Qo'l-oyoq skrabi",
        subCategory: 'qol-oyoq',
        brand: 'HandSoft',
        condition: 'new',
        price: 82000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'erkak-shampun-1',
        name: 'Erkaklar shampuni',
        subCategory: 'erkaklar-parvarishi',
        brand: 'GentleMen',
        condition: 'new',
        price: 99000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'erkak-aftershave-1',
        name: 'Aftershave balzam',
        subCategory: 'erkaklar-parvarishi',
        brand: 'GentleMen',
        condition: 'new',
        price: 118000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'erkak-ujit-1',
        name: 'Ujituvchi gel',
        subCategory: 'erkaklar-parvarishi',
        brand: 'GentleMen',
        condition: 'new',
        price: 105000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'spf-50-1',
        name: 'SPF 50 krem',
        subCategory: 'quyosh-himoya',
        brand: 'SunCare',
        condition: 'new',
        price: 175000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'spf-stick-1',
        name: 'SPF stik',
        subCategory: 'quyosh-himoya',
        brand: 'SunCare',
        condition: 'new',
        price: 125000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'after-sun-1',
        name: 'After-sun losyon',
        subCategory: 'quyosh-himoya',
        brand: 'SunCare',
        condition: 'new',
        price: 135000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'acne-gel-1',
        name: 'Aknelarga qarshi gel',
        subCategory: 'muammoli-teri',
        brand: 'ClearFace',
        condition: 'new',
        price: 145000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'acne-tonic-1',
        name: 'Aknelarga qarshi tonik',
        subCategory: 'muammoli-teri',
        brand: 'ClearFace',
        condition: 'new',
        price: 115000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
      {
        slug: 'spot-treatment-1',
        name: 'Spot treatment',
        subCategory: 'muammoli-teri',
        brand: 'ClearFace',
        condition: 'new',
        price: 98000,
        thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            brand: p.brand,
            category: 'gozallik',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} (demo go'zallik).`,
            condition: p.condition || 'new',
            rating: { avg: 4 + (idx % 2 ? 0.2 : 0.35), count: 9 + idx },
            stats: { views: 95 + idx * 2, likes: 10 + idx, purchases: 4 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedAutoProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'auto-sedan-1',
        name: 'Sedan 2020 (import)',
        subCategory: 'avtomobil',
        brand: 'Hyundai',
        condition: 'used',
        price: 145000000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { mileage: '45,000 km', fuel: 'Petrol', transmission: 'Automatic' },
      },
      {
        slug: 'auto-suv-1',
        name: 'SUV AWD 2021',
        subCategory: 'avtomobil',
        brand: 'Kia',
        condition: 'used',
        price: 215000000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { mileage: '30,000 km', fuel: 'Petrol', transmission: 'Automatic' },
      },
      {
        slug: 'auto-hatch-1',
        name: 'Hatchback 2019',
        subCategory: 'avtomobil',
        brand: 'Chevrolet',
        condition: 'used',
        price: 98000000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { mileage: '60,000 km', fuel: 'Gas', transmission: 'Manual' },
      },
      {
        slug: 'auto-parts-brake-1',
        name: 'Tormoz disk to‘plami',
        subCategory: 'avtomobil-extiyot-qismlari',
        brand: 'Brembo',
        condition: 'new',
        price: 1800000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { model: 'Sedan/SUV', compatibility: 'Universal' },
      },
      {
        slug: 'auto-parts-oil-1',
        name: 'Motor moyi 5W-30',
        subCategory: 'avtomobil-extiyot-qismlari',
        brand: 'Shell',
        condition: 'new',
        price: 280000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '4L', type: 'Synthetic' },
      },
      {
        slug: 'auto-parts-filter-1',
        name: 'Havo filtri',
        subCategory: 'avtomobil-extiyot-qismlari',
        brand: 'Bosch',
        condition: 'new',
        price: 120000,
        thumbnail: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
        specifications: { model: 'Kia/Hyundai', type: 'OEM' },
      },
      {
        slug: 'tech-notebook-1',
        name: 'Texnika: Notebook i7',
        subCategory: 'texnika',
        brand: 'LG',
        condition: 'used',
        price: 9500000,
        thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
        specifications: { ram: '16GB', storage: '512GB SSD' },
      },
      {
        slug: 'tech-tv-1',
        name: 'Texnika: 4K TV 55"',
        subCategory: 'texnika',
        brand: 'Samsung',
        condition: 'new',
        price: 7200000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { resolution: '4K', panel: 'QLED' },
      },
      {
        slug: 'tech-ac-1',
        name: 'Texnika: Konditsioner 24k',
        subCategory: 'texnika',
        brand: 'Gree',
        condition: 'new',
        price: 8200000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { capacity: '24,000 BTU', type: 'Invertor' },
      },
      {
        slug: 'tech-parts-ssd-1',
        name: 'Texnika ehtiyot qismi: SSD 1TB',
        subCategory: 'texnika-extiyot-qismlari',
        brand: 'Samsung',
        condition: 'new',
        price: 950000,
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
        specifications: { type: 'NVMe', size: '1TB' },
      },
      {
        slug: 'tech-parts-psu-1',
        name: 'Texnika ehtiyot qismi: PSU 650W',
        subCategory: 'texnika-extiyot-qismlari',
        brand: 'Corsair',
        condition: 'new',
        price: 650000,
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
        specifications: { rating: '80+ Gold', modular: 'Yes' },
      },
      {
        slug: 'tech-parts-fan-1',
        name: 'Texnika ehtiyot qismi: Sovutgich',
        subCategory: 'texnika-extiyot-qismlari',
        brand: 'Noctua',
        condition: 'new',
        price: 350000,
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
        specifications: { size: '120mm', noise: 'Low' },
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            brand: p.brand,
            category: 'avto-texnika',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} (demo avto/texnika).`,
            condition: p.condition || 'used',
            specifications: p.specifications,
            rating: { avg: 4 + (idx % 2 ? 0.25 : 0.3), count: 15 + idx },
            stats: { views: 180 + idx * 4, likes: 18 + idx, purchases: 6 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }

  private async ensureSeedHomeProducts() {
    const fakeVendor = new Types.ObjectId('64a8f0b0c0ffee1234567890');
    const defaults = [
      {
        slug: 'vacuum-1',
        name: 'Chang yutkich (siklon)',
        subCategory: 'chang-yutkich',
        brand: 'Dyson',
        condition: 'new',
        price: 2800000,
        thumbnail: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=900&q=80',
        specifications: { power: '2000W', type: 'Cyclone' },
      },
      {
        slug: 'vacuum-2',
        name: 'Chang yutkich (sumkali)',
        subCategory: 'chang-yutkich',
        brand: 'Bosch',
        condition: 'new',
        price: 1450000,
        thumbnail: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=900&q=80',
        specifications: { power: '1800W', type: 'Bagged' },
      },
      {
        slug: 'vacuum-3',
        name: 'Robot chang yutkich',
        subCategory: 'chang-yutkich',
        brand: 'iRobot',
        condition: 'new',
        price: 3200000,
        thumbnail: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=900&q=80',
        specifications: { battery: '120 min', mapping: 'Yes' },
      },
      {
        slug: 'washer-1',
        name: 'Kir yuvish mashinasi 7kg',
        subCategory: 'kir-yuvish',
        brand: 'LG',
        condition: 'new',
        price: 4200000,
        thumbnail: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?auto=format&fit=crop&w=900&q=80',
        specifications: { capacity: '7kg', type: 'Front load' },
      },
      {
        slug: 'washer-2',
        name: 'Kir yuvish mashinasi 10kg',
        subCategory: 'kir-yuvish',
        brand: 'Samsung',
        condition: 'new',
        price: 5300000,
        thumbnail: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?auto=format&fit=crop&w=900&q=80',
        specifications: { capacity: '10kg', type: 'Front load' },
      },
      {
        slug: 'washer-3',
        name: 'Kir yuvish mashinasi (ustki yuklama)',
        subCategory: 'kir-yuvish',
        brand: 'Whirlpool',
        condition: 'new',
        price: 3100000,
        thumbnail: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?auto=format&fit=crop&w=900&q=80',
        specifications: { capacity: '8kg', type: 'Top load' },
      },
      {
        slug: 'kitchen-mixer-1',
        name: 'Planetar mikser',
        subCategory: 'oshxona-texnikalari',
        brand: 'KitchenAid',
        condition: 'new',
        price: 1750000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { bowl: '5L', speed: '6' },
      },
      {
        slug: 'kitchen-blender-1',
        name: 'Blender 1200W',
        subCategory: 'oshxona-texnikalari',
        brand: 'Philips',
        condition: 'new',
        price: 650000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { power: '1200W', jar: '1.5L' },
      },
      {
        slug: 'kitchen-microwave-1',
        name: 'Mikroto‘lqinli pech',
        subCategory: 'oshxona-texnikalari',
        brand: 'Panasonic',
        condition: 'new',
        price: 890000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '25L', grill: 'Yes' },
      },
      {
        slug: 'fridge-1',
        name: 'Sovutkich NoFrost',
        subCategory: 'sovutkich',
        brand: 'Samsung',
        condition: 'new',
        price: 6200000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '400L', type: 'NoFrost' },
      },
      {
        slug: 'fridge-2',
        name: 'Sovutkich (ikkita eshik)',
        subCategory: 'sovutkich',
        brand: 'LG',
        condition: 'new',
        price: 7800000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '500L', type: 'Side-by-side' },
      },
      {
        slug: 'fridge-3',
        name: 'Sovutkich (klassik)',
        subCategory: 'sovutkich',
        brand: 'Artel',
        condition: 'new',
        price: 3500000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '300L', type: 'Static' },
      },
      {
        slug: 'freezer-1',
        name: 'Muzlatkich (vertikal)',
        subCategory: 'muzlatkich',
        brand: 'Beko',
        condition: 'new',
        price: 4100000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '250L', type: 'Vertical' },
      },
      {
        slug: 'freezer-2',
        name: 'Muzlatkich (sandiq)',
        subCategory: 'muzlatkich',
        brand: 'Artel',
        condition: 'new',
        price: 2900000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '200L', type: 'Chest' },
      },
      {
        slug: 'freezer-3',
        name: 'Mini muzlatkich',
        subCategory: 'muzlatkich',
        brand: 'Hisense',
        condition: 'new',
        price: 1800000,
        thumbnail: 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80',
        specifications: { volume: '100L', type: 'Compact' },
      },
      {
        slug: 'aircooler-1',
        name: 'Havo sovutgich (portativ)',
        subCategory: 'havo-sovutgich',
        brand: 'Symphony',
        condition: 'new',
        price: 1450000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { tank: '20L', power: '200W' },
      },
      {
        slug: 'aircooler-2',
        name: 'Havo sovutgich (kattaroq)',
        subCategory: 'havo-sovutgich',
        brand: 'Artel',
        condition: 'new',
        price: 1850000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { tank: '30L', power: '250W' },
      },
      {
        slug: 'aircooler-3',
        name: 'Havo sovutgich (premium)',
        subCategory: 'havo-sovutgich',
        brand: 'Midea',
        condition: 'new',
        price: 2300000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { tank: '35L', power: '300W' },
      },
      {
        slug: 'airpurifier-1',
        name: 'Havo tozalagich HEPA',
        subCategory: 'havo-tozalagich',
        brand: 'Xiaomi',
        condition: 'new',
        price: 2100000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { filter: 'HEPA', area: '35 m2' },
      },
      {
        slug: 'airpurifier-2',
        name: 'Havo tozalagich (ionizator)',
        subCategory: 'havo-tozalagich',
        brand: 'Philips',
        condition: 'new',
        price: 2600000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { filter: 'HEPA+Carbon', area: '45 m2' },
      },
      {
        slug: 'airpurifier-3',
        name: 'Havo tozalagich (premium)',
        subCategory: 'havo-tozalagich',
        brand: 'Coway',
        condition: 'new',
        price: 3200000,
        thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
        specifications: { filter: 'HEPA', area: '55 m2' },
      },
      {
        slug: 'home-other-1',
        name: 'Kichik maishiy set',
        subCategory: 'others',
        brand: 'MixTech',
        condition: 'new',
        price: 850000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { items: 'Choynak, blender, toaster' },
      },
      {
        slug: 'home-other-2',
        name: 'Buxoriy tozalagich',
        subCategory: 'others',
        brand: 'Karcher',
        condition: 'new',
        price: 1750000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { power: '1500W', tank: '1L' },
      },
      {
        slug: 'home-other-3',
        name: 'Mini ventilyator',
        subCategory: 'others',
        brand: 'Xiaomi',
        condition: 'new',
        price: 250000,
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        specifications: { speed: 3, battery: 'Yes' },
      },
    ];

    const ops = defaults.map((p, idx) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            vendor: fakeVendor,
            brand: p.brand,
            category: 'maishiy-uskunalar',
            subCategory: p.subCategory,
            price: p.price,
            images: [p.thumbnail],
            thumbnail: p.thumbnail,
            description: `${p.name} (demo maishiy uskunalar).`,
            condition: p.condition || 'new',
            specifications: p.specifications,
            rating: { avg: 4 + (idx % 2 ? 0.2 : 0.35), count: 11 + idx },
            stats: { views: 130 + idx * 3, likes: 12 + idx, purchases: 5 + idx },
          },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(ops, { ordered: false });
  }
  private findProduct(idOrSlug: string) {
    const filter = Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
    return this.productModel.findOne(filter).populate({ path: 'vendor', populate: { path: 'user', select: 'name avatarUrl' } });
  }

  private async findOrStubProduct(idOrSlug: string) {
    let product = await this.findProduct(idOrSlug);
    if (!product) {
      await this.ensureStubProduct(idOrSlug);
      product = await this.findProduct(idOrSlug);
    }
    return product;
  }

  private async ensureStubProduct(slug: string) {
    if (Types.ObjectId.isValid(slug)) return;
    const existing = await this.productModel.findOne({ slug });
    if (existing) return;

    const { category, subCategory, name } = this.getStubCategoryInfo(slug);
    const fallbackImage = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';
    await this.productModel.create({
      name,
      slug,
      vendor: new Types.ObjectId('64a8f0b0c0ffee1234567890'),
      vendorName: 'Demo Vendor',
      category,
      subCategory,
      price: 150000,
      oldPrice: 175000,
      brand: 'Demo Brand',
      condition: 'new',
      images: [fallbackImage],
      thumbnail: fallbackImage,
      description: `${name} (auto-generated stub)`,
      rating: { avg: 4.3, count: 12 },
      stats: { views: 120, likes: 15, purchases: 6 },
    });
  }

  private getStubCategoryInfo(slug: string) {
    const s = slug.toLowerCase();
    if (s.includes('pc') || s.includes('mobile') || s.includes('tv') || s.includes('tech')) {
      return { category: 'elektronika', subCategory: 'pc', name: slug };
    }
    if (s.includes('ready') || s.includes('semi') || s.includes('food')) {
      return { category: 'oziq-ovqat', subCategory: 'tayyor-maxsulotlar', name: slug };
    }
    if (s.includes('frag') || s.includes('skin') || s.includes('beauty')) {
      return { category: 'gozallik', subCategory: 'makiyaj', name: slug };
    }
    if (s.includes('carpart')) {
      return { category: 'avto-texnika', subCategory: 'avtomobil-extiyot-qismlari', name: slug };
    }
    if (s.includes('car')) {
      return { category: 'avto-texnika', subCategory: 'avtomobil', name: slug };
    }
    if (s.includes('vac') || s.includes('wash') || s.includes('fridge')) {
      return { category: 'maishiy-uskunalar', subCategory: 'others', name: slug };
    }
    if (s.includes('men') || s.includes('women') || s.includes('kids')) {
      return { category: 'kiyim-kechak', subCategory: 'erkaklar', name: slug };
    }
    return { category: 'oziq-ovqat', subCategory: 'tayyor-maxsulotlar', name: slug };
  }
}
