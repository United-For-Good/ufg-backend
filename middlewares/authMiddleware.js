const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = parseInt(decoded.userId);
    if (isNaN(userId)) {
      return res.status(401).json({ message: 'Invalid user ID in token' });
    }

    const user = await prisma.user.findUnique({
      where: { 
        id: userId,
        deletedAt: null
      },
      include: { 
        roleAssignments: {
          where: { deletedAt: null },
          include: { 
            role: {
              include: {
                permissionAssignments: {
                  where: { deletedAt: null },
                  include: { permission: true }
                }
              }
            }
          }
        }
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const checkPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    if (!Array.isArray(permissions)) permissions = [permissions];

    const userPermissions = req.user.roleAssignments.flatMap(ra => 
      ra.role.permissionAssignments.map(pa => pa.permission.name)
    );

    if (userPermissions.includes('all_permissions')) {
      return next();
    }

    const hasPermission = permissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

const checkRole = (role) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const userRoles = req.user.roleAssignments.map(ra => ra.role.name);

    if (!userRoles.includes(role)) {
      return res.status(403).json({ message: 'Insufficient role privileges' });
    }

    next();
  };
};

module.exports = { authenticateUser, checkPermission, checkRole };