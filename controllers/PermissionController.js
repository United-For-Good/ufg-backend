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
      return res
        .status(400)
        .json({ message: "Permission name already exists" });
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
    res.status(500).json({ message: "Error creating permission" });
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
    res.status(500).json({ message: "Error fetching permissions" });
  }
};

const getPermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await prisma.permission.findUnique({
      where: {
        id: id,
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
    res.status(500).json({ message: "Error fetching permission" });
  }
};

const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const permissionExists = await prisma.permission.findUnique({
      where: {
        id: id,
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
      if (nameExists && nameExists.id !== id) {
        return res
          .status(400)
          .json({ message: "Permission name already exists" });
      }
    }

    const permission = await prisma.permission.update({
      where: { id },
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
    res.status(500).json({ message: "Error updating permission" });
  }
};

const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permissionExists = await prisma.permission.findUnique({
      where: {
        id: id,
        deletedAt: null,
      },
    });

    if (!permissionExists) {
      return res.status(404).json({ message: "Permission not found" });
    }

    const permission = await prisma.permission.update({
      where: { id },
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
    res.status(500).json({ message: "Error deleting permission" });
  }
};

module.exports = {
  createPermission,
  getAllPermissions,
  getPermission,
  updatePermission,
  deletePermission,
};