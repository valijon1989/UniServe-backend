import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAdminWorkspace,
  canonicalizeAdminDepartment,
  getAdminDepartmentStorageValues,
  getRoleTemplate,
  resolveDefaultAdminRoleNames
} from "../src/services/adminBlueprint";

test("department aliaslar canonical qiymatga normallashadi", () => {
  assert.equal(canonicalizeAdminDepartment("sales"), "products");
  assert.equal(canonicalizeAdminDepartment("engineering"), "technical_ops");
  assert.deepEqual(getAdminDepartmentStorageValues("products"), ["products", "sales"]);
});

test("staff admin default role department bo‘yicha tanlanadi", () => {
  assert.deepEqual(resolveDefaultAdminRoleNames("STAFF", "products"), ["PRODUCT_ADMIN_ROLE"]);
  assert.deepEqual(resolveDefaultAdminRoleNames("STAFF", "finance"), ["FINANCE_ADMIN_ROLE"]);
  assert.deepEqual(resolveDefaultAdminRoleNames("MANAGER", "products"), ["PLATFORM_PRODUCTS_ADMIN_ROLE"]);
  assert.deepEqual(resolveDefaultAdminRoleNames("STAFF", "content"), ["MODERATOR_ROLE", "CONTENT_ADMIN_ROLE"]);
});

test("product admin workspace faqat tegishli sidebar va queue elementlarini qaytaradi", () => {
  const role = getRoleTemplate("PRODUCT_ADMIN_ROLE");
  assert.ok(role);

  const workspace = buildAdminWorkspace({
    adminLevel: "STAFF",
    department: "products",
    permissions: role!.permissionKeys,
    roleNames: ["PRODUCT_ADMIN_ROLE"]
  });

  assert.equal(workspace.accessTier, "department");
  assert.equal(workspace.adminSuite, "PLATFORM_ADMIN");
  assert.equal(workspace.department, "products");
  assert.ok(workspace.sidebar.some((item) => item.id === "products"));
  assert.ok(workspace.sidebar.some((item) => item.id === "reports"));
  assert.ok(workspace.sidebar.some((item) => item.id === "categories"));
  assert.equal(workspace.sidebar.some((item) => item.id === "payments"), false);
  assert.equal(workspace.sidebar.some((item) => item.id === "settings"), false);
  assert.ok(workspace.menu.some((section) => section.id === "marketplace"));
  assert.ok(workspace.queueWidgets.some((item) => item.id === "pending_products"));
});

test("primary admin workspace governance qatlamlarini to‘liq ochadi", () => {
  const role = getRoleTemplate("SUPER_ADMIN_ROLE");
  assert.ok(role);

  const workspace = buildAdminWorkspace({
    adminLevel: "PRIMARY",
    department: "operations",
    permissions: role!.permissionKeys,
    roleNames: ["SUPER_ADMIN_ROLE"]
  });

  assert.equal(workspace.accessTier, "primary");
  assert.equal(workspace.adminSuite, "SUPER_ADMIN");
  assert.ok(workspace.sidebar.some((item) => item.id === "admins"));
  assert.ok(workspace.sidebar.some((item) => item.id === "security"));
  assert.ok(workspace.sidebar.some((item) => item.id === "logs"));
  assert.ok(workspace.sidebar.some((item) => item.id === "settings"));
  assert.equal(workspace.governance.canManageAdmins, true);
  assert.equal(workspace.governance.canManageRoles, true);
  assert.equal(workspace.governance.canManageSettings, true);
  assert.equal(workspace.governance.canReviewSecurity, true);
  assert.equal(workspace.governance.canOverrideCriticalActions, true);
});
