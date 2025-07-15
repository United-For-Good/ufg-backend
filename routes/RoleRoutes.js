const { Router } = require("express");
const { authenticateUser, checkPermission } = require("../middlewares/authMiddleware");
const { createRole, getAllRoles, getRole, updateRole, deleteRole } = require("../controllers/RoleController");
const roleRoutes = Router();

roleRoutes.post("/", authenticateUser, checkPermission(["manage_roles"]), createRole);
roleRoutes.get("/", authenticateUser, getAllRoles);
roleRoutes.get("/:id", authenticateUser, getRole);
roleRoutes.put("/:id", authenticateUser, checkPermission(["manage_roles"]), updateRole);
roleRoutes.delete("/:id", authenticateUser, checkPermission(["manage_roles"]), deleteRole);

module.exports = { roleRoutes };