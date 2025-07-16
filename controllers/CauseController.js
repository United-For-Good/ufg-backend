const { prisma } = require('../config/db');
const { put, del } = require('@vercel/blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const BLOB_TOKEN = process.env.VERCEL_BLOB_TOKEN;


const generateFileKey = (originalName, folder = 'causes') => {
  const fileExtension = path.extname(originalName);
  const sanitizedName = path.basename(originalName, fileExtension)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `${folder}/${uuidv4()}-${sanitizedName}${fileExtension}`;
};


const uploadMultipleToBlob = async (files, folder) => {
  const results = [];
  for (const file of files) {
    const fileKey = generateFileKey(file.originalname, folder);
    const { url } = await put(fileKey, file.buffer, {
      access: 'public',
      token: BLOB_TOKEN
    });
    results.push({
      url,
      originalName: file.originalname
    });
  }
  return results;
};


const deleteMultipleFromBlob = async (urls) => {
  await del(urls, { token: BLOB_TOKEN });
};

const createCause = async (req, res) => {
  try {
    let causesData = req.body.causes;
    
    if (typeof causesData === 'string') {
      causesData = JSON.parse(causesData);
    }
    if (!Array.isArray(causesData)) causesData = [causesData || req.body];

    const files = req.files || [];

    if (causesData.length === 0) {
      throw new Error('At least one cause is required');
    }

    const createdCauses = await prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < causesData.length; i++) {
        const data = causesData[i];
        const cause = await tx.cause.create({
          data: {
            name: data.name,
            shortDescription: data.shortDescription,
            description: data.description,
            goal: parseFloat(data.goal),
            color: data.color,
            fundUsage: data.fundUsage,
            status: data.status || 'OPEN',
            showOnWebsite: data.showOnWebsite === true || data.showOnWebsite === 'true',
          },
        });

        const images = [];
        
        const causeFiles = files.filter(f => f.fieldname === `images[${i}]` || (i === 0 && f.fieldname === 'images'));
        if (causeFiles.length > 0) {
          const uploadResults = await uploadMultipleToBlob(causeFiles, `causes/${cause.id}`);
          for (const result of uploadResults) {
            const isPrimary = images.length === 0;
            const causeImage = await tx.causeImage.create({
              data: {
                causeId: cause.id,
                url: result.url,
                altText: result.originalName,
                isPrimary
              }
            });
            images.push(causeImage);
          }
        }

        results.push({ ...cause, images });
      }
      return results;
    });

    res.status(201).json(createdCauses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating causes', error: error.message });
  }
};

const addImagesToCause = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files.length) return res.status(400).json({ message: 'No images provided' });

    const cause = await prisma.cause.findUnique({
      where: { id: parseInt(id), deletedAt: null },
      include: { images: { where: { deletedAt: null } } }
    });

    if (!cause) return res.status(404).json({ message: 'Cause not found' });

    let hasPrimary = cause.images.some(img => img.isPrimary);

    const uploadResults = await uploadMultipleToBlob(files, `causes/${id}`);

    const newImages = await prisma.$transaction(async (tx) => {
      const imgs = [];
      for (const result of uploadResults) {
        const isPrimary = !hasPrimary;
        hasPrimary = true; 
        const causeImage = await tx.causeImage.create({
          data: {
            causeId: cause.id,
            url: result.url,
            altText: result.originalName,
            isPrimary
          }
        });
        imgs.push(causeImage);
      }
      return imgs;
    });

    res.status(201).json(newImages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error adding images', error: error.message });
  }
};

const getAllCauses = async (req, res) => {
  try {
    let causes = await prisma.cause.findMany({
      where: { deletedAt: null, showOnWebsite: true },
      include: { images: { where: { deletedAt: null } } }
    });

    causes = await Promise.all(causes.map(async (cause) => {
      const totalRaised = await prisma.donation.aggregate({
        where: { causeId: cause.id, paymentStatus: 'CAPTURED' },
        _sum: { amount: true }
      });
      return { ...cause, raised: totalRaised._sum.amount || 0 };
    }));

    res.json(causes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching causes', error: error.message });
  }
};

const getCause = async (req, res) => {
  try {
    const { id } = req.params;
    let cause = await prisma.cause.findUnique({
      where: { id: parseInt(id), deletedAt: null },
      include: {
        images: { where: { deletedAt: null } },
        donations: {
          where: { paymentStatus: 'CAPTURED' },
          orderBy: { date: 'desc' },
          take: 3,
          select: { id: true, name: true, isAnonymous: true, amount: true, message: true, date: true }
        }
      }
    });
    if (!cause) return res.status(404).json({ message: 'Cause not found' });

    const totalRaised = await prisma.donation.aggregate({
      where: { causeId: cause.id, paymentStatus: 'CAPTURED' },
      _sum: { amount: true }
    });
    cause.raised = totalRaised._sum.amount || 0;

    res.json(cause);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching cause', error: error.message });
  }
};

const updateCause = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const data = {};
    if (update.name) data.name = update.name;
    if (update.shortDescription) data.shortDescription = update.shortDescription;
    if (update.description) data.description = update.description;
    if (update.goal) data.goal = parseFloat(update.goal);
    if (update.color) data.color = update.color;
    if (update.fundUsage) data.fundUsage = update.fundUsage;
    if (update.status) data.status = update.status;
    if (update.showOnWebsite !== undefined) data.showOnWebsite = update.showOnWebsite === true || update.showOnWebsite === 'true';

    const cause = await prisma.cause.update({
      where: { id: parseInt(id), deletedAt: null },
      data,
      include: { images: { where: { deletedAt: null } } }
    });

    res.json(cause);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating cause', error: error.message });
  }
};

const deleteCause = async (req, res) => {
  try {
    let ids = req.body.ids;
    if (!Array.isArray(ids)) ids = [req.body.id];

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const cause = await tx.cause.findUnique({
          where: { id: parseInt(id), deletedAt: null },
          include: { images: true }
        });
        if (!cause) continue;

        if (cause.images.length > 0) {
          await deleteMultipleFromBlob(cause.images.map(img => img.url));
        }

        await tx.cause.update({
          where: { id: parseInt(id) },
          data: { deletedAt: new Date() }
        });
        await tx.causeImage.updateMany({
          where: { causeId: parseInt(id) },
          data: { deletedAt: new Date() }
        });
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting causes', error: error.message });
  }
};

module.exports = {
  createCause,
  getAllCauses,
  getCause,
  updateCause,
  addImagesToCause,
  deleteCause
};