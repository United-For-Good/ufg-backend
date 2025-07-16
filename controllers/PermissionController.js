const { prisma } = require("../config/db");

const createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { name, deletedAt: null },
    });
    if (existingPermission) {
      return res.status(400).json({ message: "Permission name already exists" });
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        description,
      },
      include: {
        permissionAssignments: true,
      },
    });

    res.status(201).json({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating permission", error: error.message });
  }
};

const getAllPermissions = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        permissionAssignments: true,
      },
    });

    const formattedPermissions = permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    }));

    res.json(formattedPermissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching permissions", error: error.message });
  }
};

const getPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permissionId = parseInt(id);
    if (isNaN(permissionId)) {
      return res.status(400).json({ message: "Invalid permission ID" });
    }

    const permission = await prisma.permission.findUnique({
      where: {
        id: permissionId,
        deletedAt: null,
      },
      include: {
        permissionAssignments: true,
      },
    });

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.json({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching permission", error: error.message });
  }
};

const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permissionId = parseInt(id);
    if (isNaN(permissionId)) {
      return res.status(400).json({ message: "Invalid permission ID" });
    }

    const { name, description } = req.body;

    const permissionExists = await prisma.permission.findUnique({
      where: {
        id: permissionId,
        deletedAt: null,
      },
    });

    if (!permissionExists) {
      return res.status(404).json({ message: "Permission not found" });
    }

    if (name) {
      const nameExists = await prisma.permission.findUnique({
        where: { name, deletedAt: null },
      });
      if (nameExists && nameExists.id !== permissionId) {
        return res.status(400).json({ message: "Permission name already exists" });
      }
    }

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        name: name || permissionExists.name,
        description: description || permissionExists.description,
      },
      include: {
        permissionAssignments: true,
      },
    });

    res.json({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating permission", error: error.message });
  }
};

const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permissionId = parseInt(id);
    if (isNaN(permissionId)) {
      return res.status(400).json({ message: "Invalid permission ID" });
    }

    const permissionExists = await prisma.permission.findUnique({
      where: {
        id: permissionId,
        deletedAt: null,
      },
    });

    if (!permissionExists) {
      return res.status(404).json({ message: "Permission not found" });
    }

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Permission deleted successfully",
      permission: {
        id: permission.id,
        name: permission.name,
        description: permission.description,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
        deletedAt: permission.deletedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting permission", error: error.message });
  }
};

module.exports = {
  createPermission,
  getAllPermissions,
  getPermission,
  updatePermission,
  deletePermission,
};