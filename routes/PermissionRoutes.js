const { Router } = require("express");

const { authenticateUser, checkPermission } = require("../middlewares/authMiddleware");
const { createPermission, getAllPermissions, getPermission, updatePermission, deletePermission } = require("../controllers/PermissionController");
const permissionRoutes = Router();

permissionRoutes.post("/", authenticateUser, checkPermission(["manage_permissions"]), createPermission);
permissionRoutes.get("/", authenticateUser, getAllPermissions);
permissionRoutes.get("/:id", authenticateUser, getPermission);
permissionRoutes.put("/:id", authenticateUser, checkPermission(["manage_permissions"]), updatePermission);
permissionRoutes.delete("/:id", authenticateUser, checkPermission(["manage_permissions"]), deletePermission);

module.exports = { permissionRoutes };