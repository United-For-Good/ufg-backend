const bcrypt = require('bcryptjs');
const { prisma } = require("../config/db");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({ 
      where: { email, deletedAt: null } 
    });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const roleExists = await prisma.role.findUnique({ 
      where: { name: role, deletedAt: null } 
    });

    if (!roleExists) {
      return res.status(400).json({ message: "Specified role does not exist" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        roleAssignments: {
          create: {
            role: {
              connect: { id: parseInt(roleExists.id) },
            },
          },
        },
      },
      include: {
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    const assignedRole = user.roleAssignments[0]?.role.name;

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: assignedRole,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                permissionAssignments: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: parseInt(user.id) }, process.env.JWT_SECRET);

    const roles = user.roleAssignments.map((ra) => ra.role.name);
    const permissions = user.roleAssignments
      .flatMap((ra) => ra.role.permissionAssignments)
      .map((pa) => pa.permission.name);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles,
        permissions: permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;
    const name = payload.name;

    let user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                permissionAssignments: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Email is not registered, please sign up first" });
    }

    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: parseInt(user.id) },
        data: { googleId },
        include: {
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissionAssignments: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } else if (user.googleId !== googleId) {
      return res.status(401).json({ message: "Google account mismatch" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is inactive" });
    }

    const token = jwt.sign({ userId: parseInt(user.id) }, process.env.JWT_SECRET);

    const roles = user.roleAssignments.map((ra) => ra.role.name);
    const permissions = user.roleAssignments
      .flatMap((ra) => ra.role.permissionAssignments)
      .map((pa) => pa.permission.name);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: roles,
        permissions: permissions,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: "Error logging in with Google", error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                permissionAssignments: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roleAssignments[0]?.role.name || "",
      permissions: user.roleAssignments
        .flatMap((ra) => ra.role.permissionAssignments)
        .map((pa) => pa.permission.name),
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};

const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roleAssignments[0]?.role.name,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: "Error fetching user", error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { email, password, name, role } = req.body;

    const data = {};
    if (email) data.email = email;
    if (name) data.name = name;
    if (password) data.hashedPassword = await bcrypt.hash(password, 10);
    if (role) {
      const roleExists = await prisma.role.findUnique({
        where: { name: role, deletedAt: null },
      });
      if (!roleExists) {
        return res.status(400).json({ message: "Specified role does not exist" });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: {
        ...data,
        ...(role && {
          roleAssignments: {
            deleteMany: {},
            create: {
              role: {
                connect: { id: parseInt(roleExists.id) },
              },
            },
          },
        }),
      },
      include: {
        roleAssignments: {
          include: {
            role: true,
          },
        },
      },
    });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roleAssignments[0]?.role.name,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: "Error updating user", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
};

module.exports = {
  createUser,
  loginUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  googleLogin
};