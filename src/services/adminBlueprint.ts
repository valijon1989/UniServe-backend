export const ADMIN_LEVELS = ["PRIMARY", "MANAGER", "STAFF"] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const ADMIN_MFA_METHODS = ["TOTP", "PASSKEY", "EMAIL_OTP"] as const;
export type AdminMfaMethod = (typeof ADMIN_MFA_METHODS)[number];

export const ADMIN_DEPARTMENT_VALUES = [
  "operations",
  "products",
  "services",
  "community",
  "agents",
  "support",
  "finance",
  "content",
  "technical_ops",
  "sales",
  "engineering",
  "ops"
] as const;
export type AdminDepartment = (typeof ADMIN_DEPARTMENT_VALUES)[number];

export const ADMIN_CANONICAL_DEPARTMENTS = [
  "operations",
  "products",
  "services",
  "community",
  "agents",
  "support",
  "finance",
  "content",
  "technical_ops"
] as const;
export type CanonicalAdminDepartment = (typeof ADMIN_CANONICAL_DEPARTMENTS)[number];

export const ADMIN_SCOPE_MODULES = [
  "products",
  "services",
  "community",
  "users",
  "agents",
  "orders",
  "payments",
  "content",
  "moderation",
  "reports",
  "analytics",
  "taxonomy",
  "admins",
  "settings",
  "audit",
  "*"
] as const;
export type AdminScopeModule = (typeof ADMIN_SCOPE_MODULES)[number];

export interface AdminScope {
  module: AdminScopeModule;
  region?: string;
  countryCode?: string;
  categoryId?: string;
  subcategoryId?: string;
}

type PermissionGroup =
  | "core"
  | "products"
  | "services"
  | "agents"
  | "users"
  | "community"
  | "orders"
  | "finance"
  | "moderation"
  | "content"
  | "taxonomy"
  | "analytics"
  | "technical"
  | "sessions";

type NavigationLayer = "global-control" | "department-management" | "review-action" | "governance-security";
export type AdminSuite = "SUPER_ADMIN" | "PLATFORM_ADMIN" | "MODERATOR" | "SUPPORT_ADMIN";

export interface AdminPermissionDefinition {
  key: string;
  label: string;
  group: PermissionGroup;
  groupLabel: string;
  description: string;
  critical?: boolean;
  legacy?: boolean;
}

export interface AdminRoleTemplate {
  name: string;
  label: string;
  description: string;
  adminLevel: AdminLevel;
  departments?: CanonicalAdminDepartment[];
  permissionKeys: string[];
  legacyAlias?: boolean;
}

export interface AdminNavigationItem {
  id: string;
  label: string;
  href: string;
  layer: NavigationLayer;
  permissionAny: string[];
  scopeModules?: AdminScopeModule[];
  description?: string;
}

export interface AdminQueueWidget {
  id: string;
  label: string;
  permissionAny: string[];
}

export interface AdminDashboardCard {
  id: string;
  label: string;
  permissionAny: string[];
}

export interface AdminSuiteDefinition {
  id: AdminSuite;
  label: string;
  description: string;
  responsibilities: string[];
  roleNames: string[];
}

const GROUP_LABELS: Record<PermissionGroup, string> = {
  core: "Core",
  products: "Products",
  services: "Services",
  agents: "Agents",
  users: "Users",
  community: "Community",
  orders: "Orders & Bookings",
  finance: "Finance",
  moderation: "Moderation",
  content: "Content",
  taxonomy: "Taxonomy",
  analytics: "Analytics",
  technical: "Technical Ops",
  sessions: "Sessions & Security"
};

const definePermission = <K extends string>(
  group: PermissionGroup,
  key: K,
  label: string,
  description: string,
  options?: { critical?: boolean; legacy?: boolean }
): AdminPermissionDefinition & { key: K } => ({
  key,
  label,
  group,
  groupLabel: GROUP_LABELS[group],
  description,
  critical: options?.critical,
  legacy: options?.legacy
});

const dedupe = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

export const ADMIN_PERMISSION_DEFINITIONS = [
  definePermission("core", "dashboard.view", "View dashboard", "Open the admin dashboard and summary widgets."),
  definePermission("core", "dashboard.read", "Read dashboard", "Legacy dashboard read permission.", { legacy: true }),
  definePermission("analytics", "analytics.view", "View analytics", "Access growth, conversion, and performance analytics."),
  definePermission("core", "admin.manage", "Admin override", "Use admin-wide override actions across modules.", {
    critical: true,
    legacy: true
  }),
  definePermission("core", "settings.manage", "Manage settings", "Change global platform, policy, and automation settings.", {
    critical: true
  }),
  definePermission("core", "admins.view", "View admins", "View admin list, workload, and assignment data."),
  definePermission("core", "admins.create", "Create admins", "Invite or create helper admin candidates."),
  definePermission("core", "admins.read", "Read admins", "Legacy admin read permission.", { legacy: true }),
  definePermission("core", "admins.manage", "Manage admins", "Manage admin lifecycle at a high level.", { critical: true }),
  definePermission("core", "admins.invite", "Invite admins", "Invite or nominate helper admins."),
  definePermission("core", "admins.approve", "Approve admins", "Approve pending admin candidates.", { critical: true }),
  definePermission("core", "admins.revoke", "Revoke admins", "Revoke or suspend admin access.", { critical: true }),
  definePermission(
    "core",
    "admins.assign_permissions",
    "Assign custom permissions",
    "Assign or revoke direct per-admin permission overrides.",
    { critical: true }
  ),
  definePermission("core", "admins.roles.manage", "Manage admin roles", "Assign or remove granular admin roles.", {
    critical: true
  }),
  definePermission("core", "admins.roles.write", "Write admin roles", "Legacy admin role write permission.", {
    critical: true,
    legacy: true
  }),
  definePermission("core", "admins.scopes.manage", "Manage admin scopes", "Limit admins by region, category, or module scope."),
  definePermission("core", "admins.scopes.write", "Write admin scopes", "Legacy admin scope write permission.", {
    legacy: true
  }),
  definePermission(
    "core",
    "admins.department.manage",
    "Manage departments",
    "Update admin department and position assignments."
  ),
  definePermission("core", "admins.department.write", "Write departments", "Legacy department write permission.", {
    legacy: true
  }),
  definePermission("core", "rbac.view", "View RBAC", "View role templates and permission matrix."),
  definePermission("core", "rbac.read", "Read RBAC", "Legacy RBAC read permission.", { legacy: true }),
  definePermission("core", "rbac.manage", "Manage RBAC", "Create or update reusable custom roles.", { critical: true }),
  definePermission("core", "rbac.write", "Write RBAC", "Legacy RBAC write permission.", { critical: true, legacy: true }),
  definePermission("sessions", "audit.view", "View audit logs", "View admin action history and governance logs."),
  definePermission("sessions", "audit.read", "Read audit logs", "Legacy audit read permission.", { legacy: true }),
  definePermission("sessions", "logs.read", "Read technical logs", "Read system and moderation related logs.", {
    legacy: true
  }),
  definePermission("sessions", "sessions.view", "View sessions", "View admin sessions and device history."),
  definePermission("sessions", "sessions.read", "Read sessions", "Legacy admin session read permission.", {
    legacy: true
  }),
  definePermission("sessions", "sessions.revoke", "Revoke sessions", "Terminate active admin sessions.", {
    critical: true
  }),

  definePermission("products", "products.view", "View products", "View product listings and product queues."),
  definePermission("products", "products.create", "Create products", "Create or recreate product listings."),
  definePermission("products", "products.edit", "Edit products", "Edit product data and status."),
  definePermission("products", "products.approve", "Approve products", "Approve pending product listings."),
  definePermission("products", "products.reject", "Reject products", "Reject or request changes on product listings."),
  definePermission("products", "products.delete", "Delete products", "Permanently delete product listings.", {
    critical: true
  }),
  definePermission("products", "products.feature", "Feature products", "Pin or feature product listings."),
  definePermission("products", "listings.read_all", "Read listings", "Legacy cross-listing read permission.", {
    legacy: true
  }),
  definePermission("products", "listings.moderate", "Moderate listings", "Legacy cross-listing moderation permission.", {
    legacy: true
  }),

  definePermission("services", "services.view", "View services", "View service listings and service moderation queue."),
  definePermission("services", "services.create", "Create services", "Create or restore service listings."),
  definePermission("services", "services.edit", "Edit services", "Edit pricing, duration, and service details."),
  definePermission("services", "services.approve", "Approve services", "Approve pending service listings."),
  definePermission("services", "services.reject", "Reject services", "Reject or request edits on services."),
  definePermission("services", "services.delete", "Delete services", "Permanently delete service listings.", {
    critical: true
  }),
  definePermission("services", "services.feature", "Feature services", "Feature services in curated surfaces."),

  definePermission("agents", "agents.view", "View agents", "View agent profiles, performance, and history."),
  definePermission("agents", "agents.read", "Read agents", "Legacy agent read permission.", { legacy: true }),
  definePermission("agents", "agents.verify", "Verify agents", "Approve agent verification and compliance checks.", {
    critical: true
  }),
  definePermission("agents", "agents.suspend", "Suspend agents", "Suspend or freeze agent access.", {
    critical: true
  }),
  definePermission("agents", "agents.freeze", "Freeze agents", "Legacy agent freeze permission.", {
    critical: true,
    legacy: true
  }),
  definePermission("agents", "agents.note", "Write agent notes", "Attach internal notes or quality feedback to agents."),
  definePermission("agents", "agents.badge", "Manage agent badges", "Assign or revoke agent badges and ranks."),

  definePermission("users", "users.view", "View users", "View user profiles, appeals, and restrictions."),
  definePermission("users", "users.read", "Read users", "Legacy user read permission.", { legacy: true }),
  definePermission("users", "users.edit", "Edit users", "Edit user support metadata and account notes."),
  definePermission("users", "users.update", "Update users", "Legacy user update permission.", { legacy: true }),
  definePermission("users", "users.warn", "Warn users", "Issue warnings or soft restrictions to users."),
  definePermission("users", "users.suspend", "Suspend users", "Suspend user access temporarily.", { critical: true }),
  definePermission("users", "users.freeze", "Freeze users", "Legacy user freeze permission.", {
    critical: true,
    legacy: true
  }),
  definePermission("users", "users.ban", "Ban users", "Apply permanent user bans.", { critical: true }),

  definePermission("community", "community.view", "View community", "View groups, channels, posts, and comments."),
  definePermission(
    "community",
    "community.moderate",
    "Moderate community",
    "Legacy community moderation permission.",
    { legacy: true }
  ),
  definePermission("community", "groups.view", "View groups", "View community groups and channels."),
  definePermission("community", "groups.moderate", "Moderate groups", "Moderate group/channel visibility and safety."),
  definePermission("community", "posts.moderate", "Moderate posts", "Moderate community posts."),
  definePermission("community", "comments.moderate", "Moderate comments", "Moderate community comments."),

  definePermission("orders", "orders.view", "View orders", "View product orders and service bookings."),
  definePermission("orders", "orders.read", "Read orders", "Legacy order read permission.", { legacy: true }),
  definePermission("orders", "orders.manage", "Manage orders", "Resolve order issues, status overrides, and booking actions."),
  definePermission("orders", "disputes.view", "View disputes", "View customer disputes and escalations."),
  definePermission("orders", "disputes.resolve", "Resolve disputes", "Resolve, escalate, or close disputes."),
  definePermission("orders", "disputes.decide", "Decide disputes", "Approve final dispute outcomes, refunds, or release decisions.", {
    critical: true
  }),
  definePermission("orders", "disputes.shopping.resolve", "Resolve shopping disputes", "Resolve product and marketplace shopping disputes."),
  definePermission("orders", "disputes.services.resolve", "Resolve service disputes", "Resolve general service disputes."),
  definePermission("orders", "disputes.translation.resolve", "Resolve translation disputes", "Resolve translation workflow disputes."),
  definePermission("orders", "disputes.legal.resolve", "Resolve legal disputes", "Resolve legal workflow disputes."),
  definePermission("orders", "disputes.psychology.resolve", "Resolve psychology disputes", "Resolve private psychology disputes."),
  definePermission("orders", "disputes.education.resolve", "Resolve education disputes", "Resolve course and education disputes."),
  definePermission("orders", "disputes.consulting.resolve", "Resolve consulting disputes", "Resolve consulting disputes."),
  definePermission("orders", "disputes.sport.resolve", "Resolve sport disputes", "Resolve sport/training disputes."),

  definePermission("finance", "payments.view", "View payments", "View payment logs and transaction snapshots."),
  definePermission("finance", "payments.read", "Read payments", "Legacy payment read permission.", { legacy: true }),
  definePermission("finance", "payments.manage", "Manage payments", "Manage transaction anomalies and finance actions."),
  definePermission("finance", "payments_admin", "Payments admin permission", "Use payment-admin review surfaces."),
  definePermission("finance", "refunds.manage", "Manage refunds", "Approve or reject refund requests.", {
    critical: true
  }),
  definePermission("finance", "refunds.approve", "Approve refunds", "Approve refund outcomes after dispute review.", {
    critical: true
  }),
  definePermission("finance", "release.approve", "Approve release", "Approve release of held escrow funds to sellers.", {
    critical: true
  }),
  definePermission("finance", "payouts.approve", "Approve payouts", "Approve or hold payouts and withdrawals.", {
    critical: true
  }),
  definePermission("finance", "payouts.hold", "Hold payouts", "Place payout requests on hold during risk or dispute review.", {
    critical: true
  }),
  definePermission("finance", "fraud.flag", "Flag fraud risk", "Mark suspicious buyer, seller, payout, or payment behaviour.", {
    critical: true
  }),
  definePermission("finance", "finance.audit.view", "View finance audit", "Read ledger, escrow bucket, and payout audit records."),

  definePermission("moderation", "moderation.view", "View moderation center", "Access the moderation control tower."),
  definePermission("moderation", "reports.view", "View reports", "View abuse reports and flagged queues."),
  definePermission("moderation", "reports.resolve", "Resolve reports", "Resolve, hide, or escalate reported content."),
  definePermission("moderation", "escalations.manage", "Manage escalations", "Escalate or override high-risk cases.", {
    critical: true
  }),

  definePermission("content", "content.view", "View content", "View banners, announcements, and media assets."),
  definePermission("content", "content.manage", "Manage content", "Update homepage sections and static content."),
  definePermission("content", "content.moderate", "Moderate content", "Legacy content moderation permission.", {
    legacy: true
  }),
  definePermission("content", "media.moderate", "Moderate media", "Review media uploads and unsafe assets."),

  definePermission("taxonomy", "taxonomy.view", "View taxonomy", "View categories, tags, and filter templates."),
  definePermission("taxonomy", "taxonomy.manage", "Manage taxonomy", "Manage category structure and attributes.", {
    critical: true
  }),

  definePermission("technical", "technical.view", "View technical ops", "View system health, queues, and API health."),
  definePermission("technical", "technical.manage", "Manage technical ops", "Operate system jobs and incident actions."),
  definePermission("technical", "system.health.view", "View system health", "Read server, queue, and storage health.")
] as const satisfies readonly AdminPermissionDefinition[];

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_DEFINITIONS)[number]["key"];

export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSION_DEFINITIONS.map((item) => item.key) as AdminPermissionKey[];

const permissionDefinitionMap = new Map<string, AdminPermissionDefinition>(ADMIN_PERMISSION_DEFINITIONS.map((item) => [item.key, item]));

const productPermissions = [
  "products.view",
  "products.create",
  "products.edit",
  "products.approve",
  "products.reject",
  "products.feature",
  "listings.read_all",
  "listings.moderate",
  "reports.view",
  "reports.resolve",
  "moderation.view",
  "taxonomy.view"
];

const servicePermissions = [
  "services.view",
  "services.create",
  "services.edit",
  "services.approve",
  "services.reject",
  "services.feature",
  "reports.view",
  "reports.resolve",
  "moderation.view",
  "agents.view",
  "taxonomy.view"
];

const communityPermissions = [
  "community.view",
  "community.moderate",
  "groups.view",
  "groups.moderate",
  "posts.moderate",
  "comments.moderate",
  "reports.view",
  "reports.resolve",
  "moderation.view",
  "users.view",
  "users.warn"
];

const agentPermissions = [
  "agents.view",
  "agents.read",
  "agents.verify",
  "agents.suspend",
  "agents.freeze",
  "agents.note",
  "agents.badge",
  "reports.view",
  "moderation.view",
  "users.view"
];

const supportPermissions = [
  "users.view",
  "users.read",
  "users.edit",
  "users.update",
  "users.warn",
  "users.suspend",
  "users.freeze",
  "orders.view",
  "orders.read",
  "payments.view",
  "payments.read",
  "disputes.view",
  "disputes.resolve",
  "disputes.decide",
  "refunds.manage",
  "reports.view",
  "reports.resolve",
  "moderation.view",
  "community.view"
];

const financePermissions = [
  "orders.view",
  "orders.read",
  "payments.view",
  "payments.read",
  "payments.manage",
  "payments_admin",
  "refunds.manage",
  "refunds.approve",
  "release.approve",
  "payouts.approve",
  "payouts.hold",
  "fraud.flag",
  "finance.audit.view",
  "disputes.view",
  "disputes.resolve",
  "disputes.decide",
  "analytics.view",
  "dashboard.view",
  "dashboard.read"
];

const contentPermissions = [
  "content.view",
  "content.manage",
  "content.moderate",
  "media.moderate",
  "products.feature",
  "services.feature",
  "taxonomy.view",
  "dashboard.view",
  "dashboard.read"
];

const technicalPermissions = [
  "technical.view",
  "technical.manage",
  "system.health.view",
  "logs.read",
  "sessions.view",
  "sessions.read",
  "sessions.revoke",
  "dashboard.view",
  "dashboard.read"
];

export const ADMIN_ROLE_TEMPLATES: AdminRoleTemplate[] = [
  {
    name: "SUPER_ADMIN_ROLE",
    label: "Super Admin",
    description: "Full-platform super admin with settings, payments, analytics, security, and admin governance control.",
    adminLevel: "PRIMARY",
    departments: ["operations"],
    permissionKeys: [...ADMIN_PERMISSION_KEYS]
  },
  {
    name: "PRIMARY_ROLE",
    label: "Primary Admin (Legacy)",
    description: "Legacy primary admin role kept for compatibility with existing governance flows.",
    adminLevel: "PRIMARY",
    departments: ["operations"],
    permissionKeys: [...ADMIN_PERMISSION_KEYS],
    legacyAlias: true
  },
  {
    name: "PLATFORM_PRODUCTS_ADMIN_ROLE",
    label: "Platform Admin · Products",
    description: "Platform-level admin for products, categories, pricing, inventory, and product analytics.",
    adminLevel: "MANAGER",
    departments: ["products"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "taxonomy.view",
      "taxonomy.manage",
      "orders.view",
      "orders.read",
      ...productPermissions
    ])
  },
  {
    name: "PLATFORM_SERVICES_ADMIN_ROLE",
    label: "Platform Admin · Services",
    description: "Platform-level admin for services, agents, availability, ratings, and service analytics.",
    adminLevel: "MANAGER",
    departments: ["services", "agents"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "taxonomy.view",
      "taxonomy.manage",
      "orders.view",
      "orders.read",
      ...servicePermissions,
      ...agentPermissions
    ])
  },
  {
    name: "PLATFORM_COMMUNITY_ADMIN_ROLE",
    label: "Platform Admin · Community",
    description: "Platform-level admin for posts, groups, channels, moderation policy, and community health.",
    adminLevel: "MANAGER",
    departments: ["community"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "taxonomy.view",
      ...communityPermissions,
      "content.view",
      "content.manage"
    ])
  },
  {
    name: "PLATFORM_FINANCE_ADMIN_ROLE",
    label: "Platform Admin · Finance",
    description: "Platform-level admin for escrow, disputes, refunds, payouts, fraud monitoring, and finance analytics.",
    adminLevel: "MANAGER",
    departments: ["finance"],
    permissionKeys: dedupe([...financePermissions, "orders.manage"])
  },
  {
    name: "FINANCE_SUPER_ADMIN_ROLE",
    label: "Finance Super Admin",
    description: "Owns escrow, payouts, refunds, disputes, and fraud override decisions.",
    adminLevel: "MANAGER",
    departments: ["finance"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "orders.view",
      "orders.read",
      "orders.manage",
      "payments.view",
      "payments.read",
      "payments.manage",
      "payments_admin",
      "refunds.manage",
      "refunds.approve",
      "release.approve",
      "payouts.approve",
      "payouts.hold",
      "fraud.flag",
      "finance.audit.view",
      "disputes.view",
      "disputes.resolve",
      "disputes.decide",
      "escalations.manage",
      "reports.view"
    ])
  },
  {
    name: "OPERATIONS_MANAGER_ROLE",
    label: "Operations Manager",
    description: "Cross-module operations manager without global settings or RBAC ownership.",
    adminLevel: "MANAGER",
    departments: ["operations"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "admins.view",
      "admins.read",
      "sessions.view",
      "sessions.read",
      "reports.view",
      "reports.resolve",
      "moderation.view",
      "escalations.manage",
      "orders.view",
      "orders.read",
      "orders.manage",
      "disputes.view",
      "disputes.resolve",
      ...productPermissions,
      ...servicePermissions,
      ...communityPermissions,
      ...agentPermissions,
      ...supportPermissions,
      ...financePermissions,
      ...contentPermissions,
      "technical.view",
      "system.health.view"
    ])
  },
  {
    name: "MODERATOR_ROLE",
    label: "Moderator",
    description: "Reviews spam, fake listings, abuse, reports, and unsafe marketplace or community content.",
    adminLevel: "STAFF",
    departments: ["content", "community"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "moderation.view",
      "reports.view",
      "reports.resolve",
      "products.view",
      "products.approve",
      "products.reject",
      "services.view",
      "services.approve",
      "services.reject",
      "community.view",
      "community.moderate",
      "groups.view",
      "groups.moderate",
      "posts.moderate",
      "comments.moderate",
      "users.view",
      "users.warn",
      "agents.view",
      "agents.note",
      "content.view",
      "content.moderate",
      "media.moderate"
    ])
  },
  {
    name: "PAYMENTS_ADMIN_ROLE",
    label: "Payments Admin",
    description: "Reviews payment lifecycle, escrow bucket anomalies, and release readiness.",
    adminLevel: "STAFF",
    departments: ["finance"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "payments.view",
      "payments.read",
      "payments.manage",
      "payments_admin",
      "finance.audit.view",
      "fraud.flag"
    ])
  },
  {
    name: "DISPUTE_ADMIN_ROLE",
    label: "Dispute Admin",
    description: "Runs dispute timelines, seller/buyer evidence review, and decision output.",
    adminLevel: "STAFF",
    departments: ["support", "finance"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "orders.view",
      "orders.read",
      "disputes.view",
      "disputes.resolve",
      "disputes.decide",
      "refunds.approve",
      "release.approve",
      "reports.view"
    ])
  },
  {
    name: "SHOPPING_DISPUTE_ADMIN_ROLE",
    label: "Shopping Dispute Admin",
    description: "Resolves escrow disputes for product orders and shopping flows.",
    adminLevel: "STAFF",
    departments: ["support", "finance"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "orders.view",
      "orders.read",
      "disputes.view",
      "disputes.shopping.resolve",
      "refunds.approve",
      "release.approve"
    ])
  },
  {
    name: "SERVICE_DISPUTE_ADMIN_ROLE",
    label: "Service Dispute Admin",
    description: "Resolves service booking disputes and category-aware completion evidence cases.",
    adminLevel: "STAFF",
    departments: ["support", "finance"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "orders.view",
      "orders.read",
      "disputes.view",
      "disputes.services.resolve",
      "disputes.translation.resolve",
      "disputes.legal.resolve",
      "disputes.psychology.resolve",
      "disputes.education.resolve",
      "disputes.consulting.resolve",
      "disputes.sport.resolve",
      "refunds.approve",
      "release.approve"
    ])
  },
  {
    name: "VERTICAL_DISPUTE_ADMIN_ROLE",
    label: "Vertical Dispute Admin",
    description: "Handles translation, legal, psychology, education, consulting, and sport dispute verticals.",
    adminLevel: "STAFF",
    departments: ["support", "services"],
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "disputes.view",
      "disputes.translation.resolve",
      "disputes.legal.resolve",
      "disputes.psychology.resolve",
      "disputes.education.resolve",
      "disputes.consulting.resolve",
      "disputes.sport.resolve",
      "refunds.approve",
      "release.approve"
    ])
  },
  {
    name: "PRODUCT_ADMIN_ROLE",
    label: "Product Admin",
    description: "Owns product listing review, moderation, and featured recommendations.",
    adminLevel: "STAFF",
    departments: ["products"],
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", "analytics.view", ...productPermissions])
  },
  {
    name: "SERVICE_ADMIN_ROLE",
    label: "Service Admin",
    description: "Owns service listing review, pricing moderation, and agent-service quality controls.",
    adminLevel: "STAFF",
    departments: ["services"],
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", "analytics.view", ...servicePermissions])
  },
  {
    name: "COMMUNITY_ADMIN_ROLE",
    label: "Community Admin",
    description: "Moderates groups, channels, posts, comments, and abuse reports.",
    adminLevel: "STAFF",
    departments: ["community"],
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", ...communityPermissions])
  },
  {
    name: "AGENT_ADMIN_ROLE",
    label: "Agent Verification Admin",
    description: "Handles agent onboarding, verification, badges, and agent quality issues.",
    adminLevel: "STAFF",
    departments: ["agents"],
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", "analytics.view", ...agentPermissions])
  },
  {
    name: "SUPPORT_ADMIN_ROLE",
    label: "Support Admin",
    description: "Handles user support, warnings, appeals, disputes, and escalation handoff.",
    adminLevel: "STAFF",
    departments: ["support"],
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", ...supportPermissions])
  },
  {
    name: "FINANCE_ADMIN_ROLE",
    label: "Finance Admin",
    description: "Handles payments, payout review, refunds, and suspicious transaction checks.",
    adminLevel: "STAFF",
    departments: ["finance"],
    permissionKeys: dedupe(financePermissions)
  },
  {
    name: "CONTENT_ADMIN_ROLE",
    label: "Content Admin",
    description: "Owns banners, featured surfaces, media moderation, and static content.",
    adminLevel: "STAFF",
    departments: ["content"],
    permissionKeys: dedupe(contentPermissions)
  },
  {
    name: "TECHNICAL_OPS_ROLE",
    label: "Technical Ops Admin",
    description: "Handles system health, queue health, and incident tooling without broad business edits.",
    adminLevel: "STAFF",
    departments: ["technical_ops"],
    permissionKeys: dedupe(technicalPermissions)
  },
  {
    name: "MANAGER_ROLE",
    label: "Manager (Legacy)",
    description: "Legacy manager role preserved for compatibility.",
    adminLevel: "MANAGER",
    permissionKeys: dedupe([
      "dashboard.view",
      "dashboard.read",
      "analytics.view",
      "users.view",
      "users.read",
      "users.edit",
      "users.update",
      "agents.view",
      "agents.read",
      "orders.view",
      "orders.read",
      "payments.view",
      "payments.read",
      "reports.view",
      "moderation.view",
      "admins.view",
      "admins.read",
      "sessions.view",
      "sessions.read"
    ]),
    legacyAlias: true
  },
  {
    name: "STAFF_ROLE",
    label: "Staff (Legacy)",
    description: "Legacy baseline admin role preserved for compatibility.",
    adminLevel: "STAFF",
    permissionKeys: dedupe(["dashboard.view", "dashboard.read", "reports.view", "moderation.view", "sessions.view", "sessions.read"]),
    legacyAlias: true
  }
];

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/admin",
    layer: "global-control",
    permissionAny: ["dashboard.view", "dashboard.read"],
    description: "Queue-first dashboard, alerts, and platform summary."
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    layer: "global-control",
    permissionAny: ["analytics.view"],
    description: "Revenue, marketplace growth, demand, and risk trends."
  },
  {
    id: "users",
    label: "Users",
    href: "/admin/users",
    layer: "department-management",
    permissionAny: ["users.view", "users.read"],
    scopeModules: ["users"],
    description: "Users, bans, verification history, transactions, and activity."
  },
  {
    id: "agents",
    label: "Agents",
    href: "/admin/agents",
    layer: "department-management",
    permissionAny: ["agents.view", "agents.read"],
    scopeModules: ["agents"],
    description: "Agent onboarding, verification, quality, ratings, and payouts."
  },
  {
    id: "products",
    label: "Products",
    href: "/admin/products",
    layer: "department-management",
    permissionAny: ["products.view", "listings.read_all"],
    scopeModules: ["products"],
    description: "Products, inventory, categories, pricing, and moderation queues."
  },
  {
    id: "services",
    label: "Services",
    href: "/admin/services",
    layer: "department-management",
    permissionAny: ["services.view", "listings.read_all"],
    scopeModules: ["services"],
    description: "Service listings, availability, ratings, agents, and moderation."
  },
  {
    id: "orders",
    label: "Orders",
    href: "/admin/orders",
    layer: "department-management",
    permissionAny: ["orders.view", "orders.read"],
    scopeModules: ["orders"],
    description: "Orders, bookings, fulfillment issues, complaints, and overrides."
  },
  {
    id: "payments",
    label: "Payments",
    href: "/admin/payments",
    layer: "department-management",
    permissionAny: ["payments.view", "payments.read"],
    scopeModules: ["payments"],
    description: "Escrow monitoring, transactions, refunds, payouts, and anomalies."
  },
  {
    id: "disputes",
    label: "Disputes",
    href: "/admin/disputes",
    layer: "department-management",
    permissionAny: ["disputes.view", "disputes.resolve", "disputes.decide"],
    scopeModules: ["orders", "payments"],
    description: "Disputes, refund requests, evidence review, and release decisions."
  },
  {
    id: "community",
    label: "Community",
    href: "/admin/community",
    layer: "department-management",
    permissionAny: ["community.view", "community.moderate", "groups.view"],
    scopeModules: ["community"],
    description: "Posts, groups, channels, comments, and community moderation."
  },
  {
    id: "reports",
    label: "Reports",
    href: "/admin/reports",
    layer: "review-action",
    permissionAny: ["reports.view", "moderation.view", "content.moderate"],
    scopeModules: ["reports", "community", "content", "users", "agents", "payments"],
    description: "Spam, abuse, fake listing, and safety report queues."
  },
  {
    id: "categories",
    label: "Categories",
    href: "/admin/taxonomy",
    layer: "department-management",
    permissionAny: ["taxonomy.view", "taxonomy.manage"],
    scopeModules: ["taxonomy", "products", "services"],
    description: "Categories, subcategories, tags, filters, templates."
  },
  {
    id: "admins",
    label: "Admins",
    href: "/admin/admins",
    layer: "governance-security",
    permissionAny: ["admins.view", "admins.create", "admins.read", "admins.manage", "admins.assign_permissions"],
    description: "Admin list, assignments, roles, and workload."
  },
  {
    id: "security",
    label: "Security",
    href: "/admin/security",
    layer: "governance-security",
    permissionAny: ["sessions.view", "sessions.read", "sessions.revoke", "technical.view", "system.health.view"],
    description: "Sessions, security posture, technical health, and access controls."
  },
  {
    id: "logs",
    label: "Logs",
    href: "/admin/logs",
    layer: "governance-security",
    permissionAny: ["audit.view", "audit.read", "logs.read"],
    description: "Audit trails, admin actions, governance history, and system logs."
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    layer: "governance-security",
    permissionAny: ["settings.manage", "technical.manage"],
    description: "Platform configs, rules, notifications, and automation."
  }
];

export const ADMIN_QUEUE_WIDGETS: AdminQueueWidget[] = [
  { id: "pending_products", label: "Pending products", permissionAny: ["products.approve", "listings.moderate"] },
  { id: "pending_services", label: "Pending services", permissionAny: ["services.approve"] },
  { id: "agent_verification", label: "Agent verification", permissionAny: ["agents.verify"] },
  { id: "report_queue", label: "Report queue", permissionAny: ["reports.view", "community.moderate", "content.moderate"] },
  { id: "flagged_content", label: "Flagged content", permissionAny: ["moderation.view", "reports.view"] },
  { id: "dispute_queue", label: "Dispute queue", permissionAny: ["disputes.view", "disputes.resolve"] },
  { id: "refund_queue", label: "Refund queue", permissionAny: ["refunds.manage", "refunds.approve"] },
  { id: "payout_queue", label: "Payout queue", permissionAny: ["payouts.approve"] },
  { id: "risk_alerts", label: "Risk alerts", permissionAny: ["fraud.flag", "payments.manage"] }
];

export const ADMIN_DASHBOARD_CARDS: AdminDashboardCard[] = [
  { id: "total_users", label: "Total users", permissionAny: ["users.view", "users.read", "admin.manage"] },
  { id: "total_agents", label: "Total agents", permissionAny: ["agents.view", "agents.read", "admin.manage"] },
  { id: "active_listings", label: "Active listings", permissionAny: ["products.view", "services.view", "listings.read_all"] },
  { id: "pending_approvals", label: "Pending approvals", permissionAny: ["products.approve", "services.approve", "agents.verify"] },
  { id: "open_disputes", label: "Open disputes", permissionAny: ["disputes.view", "disputes.resolve"] },
  { id: "refund_queue", label: "Refund queue", permissionAny: ["refunds.manage", "refunds.approve"] },
  { id: "unresolved_reports", label: "Unresolved reports", permissionAny: ["reports.view", "moderation.view"] },
  { id: "today_orders", label: "Today orders", permissionAny: ["orders.view", "orders.read"] },
  { id: "revenue_snapshot", label: "Revenue snapshot", permissionAny: ["payments.view", "payments.read"] },
  { id: "risk_alerts", label: "Risk alerts", permissionAny: ["fraud.flag", "payments.manage"] },
  { id: "system_status", label: "System status", permissionAny: ["technical.view", "system.health.view"] }
];

export const ADMIN_SUITE_DEFINITIONS: AdminSuiteDefinition[] = [
  {
    id: "SUPER_ADMIN",
    label: "Super Admin",
    description: "Full-platform governance over settings, payments, security, analytics, and admin roles.",
    responsibilities: ["platform settings", "payment system", "admin roles", "global analytics", "security"],
    roleNames: ["SUPER_ADMIN_ROLE", "PRIMARY_ROLE"]
  },
  {
    id: "PLATFORM_ADMIN",
    label: "Platform Admin",
    description: "Owns marketplace domains such as products, services, community, finance, and operations.",
    responsibilities: ["products", "services", "community", "finance", "categories", "orders"],
    roleNames: [
      "PLATFORM_PRODUCTS_ADMIN_ROLE",
      "PLATFORM_SERVICES_ADMIN_ROLE",
      "PLATFORM_COMMUNITY_ADMIN_ROLE",
      "PLATFORM_FINANCE_ADMIN_ROLE",
      "FINANCE_SUPER_ADMIN_ROLE",
      "OPERATIONS_MANAGER_ROLE",
      "PRODUCT_ADMIN_ROLE",
      "SERVICE_ADMIN_ROLE",
      "COMMUNITY_ADMIN_ROLE",
      "AGENT_ADMIN_ROLE",
      "FINANCE_ADMIN_ROLE",
      "CONTENT_ADMIN_ROLE",
      "TECHNICAL_OPS_ROLE"
    ]
  },
  {
    id: "MODERATOR",
    label: "Moderator",
    description: "Runs spam, abuse, fake listing, and unsafe-content review queues across the marketplace.",
    responsibilities: ["content moderation", "reports handling", "spam review", "fake listing detection"],
    roleNames: ["MODERATOR_ROLE"]
  },
  {
    id: "SUPPORT_ADMIN",
    label: "Support Admin",
    description: "Handles disputes, refund complaints, seller-buyer issues, and support escalations.",
    responsibilities: ["disputes", "refund requests", "buyer complaints", "seller complaints", "tickets"],
    roleNames: [
      "SUPPORT_ADMIN_ROLE",
      "DISPUTE_ADMIN_ROLE",
      "SHOPPING_DISPUTE_ADMIN_ROLE",
      "SERVICE_DISPUTE_ADMIN_ROLE",
      "VERTICAL_DISPUTE_ADMIN_ROLE"
    ]
  }
];

const DEPARTMENT_ALIAS_MAP: Record<string, CanonicalAdminDepartment> = {
  operations: "operations",
  operation: "operations",
  ops: "operations",
  general: "operations",
  products: "products",
  product: "products",
  sales: "products",
  services: "services",
  service: "services",
  community: "community",
  groups: "community",
  agents: "agents",
  agent: "agents",
  support: "support",
  user_support: "support",
  finance: "finance",
  financial: "finance",
  content: "content",
  media: "content",
  technical: "technical_ops",
  technical_ops: "technical_ops",
  tech: "technical_ops",
  engineering: "technical_ops"
};

const DEPARTMENT_STORAGE_MAP: Record<CanonicalAdminDepartment, AdminDepartment[]> = {
  operations: ["operations", "ops"],
  products: ["products", "sales"],
  services: ["services"],
  community: ["community"],
  agents: ["agents"],
  support: ["support"],
  finance: ["finance"],
  content: ["content"],
  technical_ops: ["technical_ops", "engineering"]
};

const LAYER_ORDER: NavigationLayer[] = [
  "global-control",
  "department-management",
  "review-action",
  "governance-security"
];

const LAYER_LABELS: Record<NavigationLayer, string> = {
  "global-control": "Global Control",
  "department-management": "Department Management",
  "review-action": "Review & Action",
  "governance-security": "Governance & Security"
};

export const normalizeAdminDepartment = (value: unknown): CanonicalAdminDepartment | undefined => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return undefined;
  return DEPARTMENT_ALIAS_MAP[raw];
};

export const canonicalizeAdminDepartment = (value: unknown): CanonicalAdminDepartment | null =>
  normalizeAdminDepartment(value) || null;

export const getAdminDepartmentStorageValues = (value: unknown): AdminDepartment[] => {
  const canonical = normalizeAdminDepartment(value);
  return canonical ? [...DEPARTMENT_STORAGE_MAP[canonical]] : [];
};

export const getPermissionDefinition = (key: string): AdminPermissionDefinition | undefined => permissionDefinitionMap.get(key);

export const getPermissionDefinitions = (keys: string[]): AdminPermissionDefinition[] =>
  dedupe(keys)
    .map((key) => permissionDefinitionMap.get(key))
    .filter(Boolean) as AdminPermissionDefinition[];

export const getRoleTemplate = (name: string): AdminRoleTemplate | undefined =>
  ADMIN_ROLE_TEMPLATES.find((role) => role.name === name);

export const hasAnyPermission = (
  permissions: string[],
  required: string[],
  adminLevel?: AdminLevel | null
): boolean => {
  if (adminLevel === "PRIMARY") return true;
  const allowed = new Set(permissions);
  return required.some((key) => allowed.has(key));
};

const hasAnyScope = (
  scopes: AdminScope[] | undefined,
  requiredModules: AdminScopeModule[] | undefined,
  adminLevel?: AdminLevel | null
) => {
  if (adminLevel === "PRIMARY") return true;
  if (!requiredModules?.length) return true;
  if (!scopes?.length) return true;

  const allowed = new Set(scopes.map((scope) => scope.module));
  if (allowed.has("*")) return true;
  return requiredModules.some((moduleName) => allowed.has(moduleName));
};

export const resolveDefaultAdminRoleNames = (
  adminLevel?: AdminLevel | null,
  department?: unknown
): string[] => {
  const normalizedDepartment = canonicalizeAdminDepartment(department);
  if (adminLevel === "PRIMARY") return ["SUPER_ADMIN_ROLE"];
  if (adminLevel === "MANAGER") {
    switch (normalizedDepartment) {
      case "products":
        return ["PLATFORM_PRODUCTS_ADMIN_ROLE"];
      case "services":
      case "agents":
        return ["PLATFORM_SERVICES_ADMIN_ROLE"];
      case "community":
        return ["PLATFORM_COMMUNITY_ADMIN_ROLE"];
      case "finance":
        return ["PLATFORM_FINANCE_ADMIN_ROLE"];
      case "support":
        return ["SUPPORT_ADMIN_ROLE"];
      case "content":
        return ["MODERATOR_ROLE", "CONTENT_ADMIN_ROLE"];
      case "technical_ops":
        return ["TECHNICAL_OPS_ROLE"];
      default:
        return ["OPERATIONS_MANAGER_ROLE"];
    }
  }

  switch (normalizedDepartment) {
    case "products":
      return ["PRODUCT_ADMIN_ROLE"];
    case "services":
      return ["SERVICE_ADMIN_ROLE"];
    case "community":
      return ["COMMUNITY_ADMIN_ROLE"];
    case "agents":
      return ["AGENT_ADMIN_ROLE"];
    case "support":
      return ["SUPPORT_ADMIN_ROLE"];
    case "finance":
      return ["FINANCE_ADMIN_ROLE"];
    case "content":
      return ["MODERATOR_ROLE", "CONTENT_ADMIN_ROLE"];
    case "technical_ops":
      return ["TECHNICAL_OPS_ROLE"];
    default:
      return ["STAFF_ROLE"];
  }
};

export const resolveAdminSuite = (payload: {
  adminLevel?: AdminLevel | null;
  department?: unknown;
  roleNames?: string[];
}): AdminSuite => {
  const adminLevel = payload.adminLevel || null;
  const department = canonicalizeAdminDepartment(payload.department);
  const roleNames = new Set(dedupe(payload.roleNames || []));

  if (adminLevel === "PRIMARY" || roleNames.has("SUPER_ADMIN_ROLE") || roleNames.has("PRIMARY_ROLE")) {
    return "SUPER_ADMIN";
  }

  if (
    roleNames.has("SUPPORT_ADMIN_ROLE") ||
    roleNames.has("DISPUTE_ADMIN_ROLE") ||
    roleNames.has("SHOPPING_DISPUTE_ADMIN_ROLE") ||
    roleNames.has("SERVICE_DISPUTE_ADMIN_ROLE") ||
    roleNames.has("VERTICAL_DISPUTE_ADMIN_ROLE") ||
    department === "support"
  ) {
    return "SUPPORT_ADMIN";
  }

  if (roleNames.has("MODERATOR_ROLE") || department === "content") {
    return "MODERATOR";
  }

  return "PLATFORM_ADMIN";
};

export const resolveAdminNavigation = (
  permissions: string[],
  adminLevel?: AdminLevel | null,
  scopes?: AdminScope[]
): AdminNavigationItem[] =>
  ADMIN_NAVIGATION_ITEMS.filter(
    (item) => hasAnyPermission(permissions, item.permissionAny, adminLevel) && hasAnyScope(scopes, item.scopeModules, adminLevel)
  );

export const resolveAdminQueueWidgets = (permissions: string[], adminLevel?: AdminLevel | null): AdminQueueWidget[] =>
  ADMIN_QUEUE_WIDGETS.filter((item) => hasAnyPermission(permissions, item.permissionAny, adminLevel));

export const resolveAdminDashboardCards = (
  permissions: string[],
  adminLevel?: AdminLevel | null
): AdminDashboardCard[] => ADMIN_DASHBOARD_CARDS.filter((item) => hasAnyPermission(permissions, item.permissionAny, adminLevel));

export const buildAdminWorkspace = (payload: {
  adminLevel?: AdminLevel | null;
  department?: unknown;
  permissions: string[];
  roleNames?: string[];
  scopes?: AdminScope[];
}) => {
  const adminLevel = payload.adminLevel || null;
  const department = canonicalizeAdminDepartment(payload.department);
  const roleNames = dedupe(payload.roleNames || []).sort();
  const sidebar = resolveAdminNavigation(payload.permissions, adminLevel, payload.scopes);
  const queueWidgets = resolveAdminQueueWidgets(payload.permissions, adminLevel);
  const dashboardCards = resolveAdminDashboardCards(payload.permissions, adminLevel);
  const adminSuite = resolveAdminSuite({ adminLevel, department, roleNames });
  const suite = ADMIN_SUITE_DEFINITIONS.find((item) => item.id === adminSuite) || null;
  const layers = LAYER_ORDER.map((layer) => ({
    id: layer,
    label: LAYER_LABELS[layer],
    items: sidebar.filter((item) => item.layer === layer)
  })).filter((layer) => layer.items.length);
  const menu = [
    {
      id: "overview",
      label: "Overview",
      items: sidebar.filter((item) => ["dashboard", "analytics"].includes(item.id))
    },
    {
      id: "marketplace",
      label: "Marketplace",
      items: sidebar.filter((item) =>
        ["users", "agents", "products", "services", "orders", "payments", "disputes", "community", "reports", "categories"].includes(
          item.id
        )
      )
    },
    {
      id: "governance",
      label: "Governance",
      items: sidebar.filter((item) => ["admins", "security", "logs", "settings"].includes(item.id))
    }
  ].filter((section) => section.items.length);

  const governance = {
    canManageAdmins: hasAnyPermission(
      payload.permissions,
      ["admins.create", "admins.manage", "admins.approve", "admins.revoke", "admins.assign_permissions"],
      adminLevel
    ),
    canManageRoles: hasAnyPermission(payload.permissions, ["admins.roles.manage", "admins.roles.write", "rbac.manage", "rbac.write"], adminLevel),
    canManageSettings: hasAnyPermission(payload.permissions, ["settings.manage"], adminLevel),
    canViewAudit: hasAnyPermission(payload.permissions, ["audit.view", "audit.read", "logs.read"], adminLevel),
    canApprovePayouts: hasAnyPermission(payload.permissions, ["payouts.approve"], adminLevel),
    canReviewSecurity: hasAnyPermission(
      payload.permissions,
      ["sessions.view", "sessions.read", "sessions.revoke", "technical.view", "system.health.view"],
      adminLevel
    ),
    canOverrideCriticalActions: adminLevel === "PRIMARY" || hasAnyPermission(payload.permissions, ["admin.manage"], adminLevel)
  };

  return {
    model: "multi-layer-control",
    accessTier:
      adminLevel === "PRIMARY"
        ? "primary"
        : roleNames.includes("OPERATIONS_MANAGER_ROLE") || roleNames.includes("MANAGER_ROLE")
          ? "operations"
          : "department",
    adminSuite,
    suite,
    hierarchy: ADMIN_SUITE_DEFINITIONS,
    department,
    roleNames,
    layout: {
      sidebar: "fixed",
      primaryWorkMode: "queue-first",
      detailMode: "table-detail-split"
    },
    sidebar,
    menu,
    layers,
    dashboardCards,
    queueWidgets,
    governance
  };
};
