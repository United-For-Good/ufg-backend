const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./config/db.js");
dotenv.config();
const app = express();
const port = process.env.PORT || 4000;
const { PrismaClient } = require("@prisma/client");
const userRoutes = require("./routes/UserRoutes.js");
const { permissionRoutes } = require("./routes/PermissionRoutes.js");
const { roleRoutes } = require("./routes/RoleRoutes.js");
const causeRoutes = require("./routes/CauseRoutes.js");
const prisma = new PrismaClient();

connectDB();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);
app.use(express.json({ limit: "30mb" }));


app.use("/users", userRoutes);
app.use("/permissions", permissionRoutes);
app.use("/roles", roleRoutes);
app.use("/causes",causeRoutes)


app.get("/", (req, res) => {
  try {
    res.send("United for Good Backend!");
  } catch (error) {
    console.error(error.message);
    res.status(400).send(error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});