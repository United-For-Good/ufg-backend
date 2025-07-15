const { Router } = require("express");
const { createUser, loginUser, getAllUsers,getUser,updateUser,deleteUser, googleLogin } = require("../controllers/UserController");
const { authenticateUser, checkPermission } = require("../middlewares/authMiddleware");

const userRoutes = Router();

userRoutes.post("/", authenticateUser, checkPermission(["manage_users"]), createUser);
userRoutes.post("/login", loginUser);
userRoutes.post("/google-login", googleLogin);
userRoutes.get("/", authenticateUser, getAllUsers);  // Added auth for security, as it returns sensitive info
userRoutes.get("/:id", authenticateUser, getUser);
userRoutes.put("/:id", authenticateUser, checkPermission(["manage_users"]), updateUser);
userRoutes.delete("/:id", authenticateUser, checkPermission(["manage_users"]), deleteUser);

module.exports = userRoutes;