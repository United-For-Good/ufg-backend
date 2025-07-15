const { prisma } = require("../config/db");

const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: "Permissions array is required" });
    }

    const existingRole = await prisma.role.findUnique({ where: { name, deletedAt: null } });
    if (existingRole) {
      return res.status(400).json({ message: "Role name already exists" });
    }

    const permissionChecks = await Promise.all(
      permissions.map(async (permissionName) => {
        const permission = await prisma.permission.findUnique({
          where: {
            name: permissionName,
            deletedAt: null,
          },
        });
        return permission;
      })
    );

    const invalidPermissions = permissionChecks.filter((p) => !p);
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        message: "Some permissions do not exist",
        invalidPermissions: permissions.filter((_, i) => !permissionChecks[i]),
      });
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissionAssignments: {
          create: permissionChecks.map((permission) => ({
            permission: {
              connect: { id: permission.id },
            },
          })),
        },
      },
      include: {
        permissionAssignments: {
          include: {
            permission: true,
          },
        },
      },
    });

    const assignedPermissions = role.permissionAssignments.map(
      (pa) => pa.permission.name
    );

    res.status(201).json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: assignedPermissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating role" });
  }
};

const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        permissionAssignments: {
          include: {
            permission: true,
          },
        },
        roleAssignments: true,
      },
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissionAssignments.map((pa) => pa.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    res.json(formattedRoles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching roles" });
  }
};

const getRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: {
        id: id,
        deletedAt: null,
      },
      include: {
        permissionAssignments: {
          include: {
            permission: true,
          },
        },
        roleAssignments: true,
      },
    });

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissionAssignments.map((pa) => pa.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching role" });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const roleExists = await prisma.role.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!roleExists) {
      return res.status(404).json({ message: "Role not found" });
    }

    const data = {};
    if (name && name !== roleExists.name) {
      const nameExists = await prisma.role.findUnique({ where: { name, deletedAt: null } });
      if (nameExists) {
        return res.status(400).json({ message: "Role name already exists" });
      }
      data.name = name;
    }

    if (description) data.description = description;

    if (permissions) {
      if (!Array.isArray(permissions)) {
        return res
          .status(400)
          .json({ message: "Permissions must be an array" });
      }

      const permissionChecks = await Promise.all(
        permissions.map(async (permissionName) => {
          const permission = await prisma.permission.findUnique({
            where: {
              name: permissionName,
              deletedAt: null,
            },
          });
          return permission;
        })
      );

      const invalidPermissions = permissionChecks.filter((p) => !p);
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          message: "Some permissions do not exist",
          invalidPermissions: permissions.filter(
            (_, i) => !permissionChecks[i]
          ),
        });
      }

      data.permissionAssignments = {
        deleteMany: {},
        create: permissionChecks.map((permission) => ({
          permission: {
            connect: { id: permission.id },
          },
        })),
      };
    }

    const role = await prisma.role.update({
        where: { id: id },
        data,
        include: {
          permissionAssignments: {
            include: {
              permission: true,
            },
          },
        },
      });

    res.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissionAssignments.map((pa) => pa.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating role" });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const roleExists = await prisma.role.findUnique({
      where: {
        id: id,
        deletedAt: null,
      },
    });

    if (!roleExists) {
      return res.status(404).json({ message: "Role not found" });
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Role deleted successfully",
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        deletedAt: role.deletedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting role" });
  }
};

module.exports = {
  createRole,
  getAllRoles,
  getRole,
  updateRole,
  deleteRole,
};