const { prisma } = require('../config/db');

const createDonation = async (req, res) => {
  try {
    let donationsData = req.body.donations;
    if (!Array.isArray(donationsData)) donationsData = [req.body];

    if (donationsData.length === 0) {
      return res.status(400).json({ message: 'At least one donation is required' });
    }

    for (const data of donationsData) {
      if (!data.amount || !data.causeId) {
        return res.status(400).json({ message: 'Amount and causeId are required for all donations' });
      }
      const cause = await prisma.cause.findUnique({
        where: { id: parseInt(data.causeId), deletedAt: null }
      });
      if (!cause) {
        return res.status(400).json({ message: `Cause with ID ${data.causeId} not found` });
      }
      if (data.userId) {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(data.userId), deletedAt: null }
        });
        if (!user) {
          return res.status(400).json({ message: `User with ID ${data.userId} not found` });
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const data of donationsData) {
        const donation = await tx.donation.create({
          data: {
            userId: data.userId ? parseInt(data.userId) : null,
            name: data.name,
            email: data.email || null,
            amount: parseFloat(data.amount),
            message: data.message,
            batch: data.batch,
            isAnonymous: data.isAnonymous || false,
            causeId: parseInt(data.causeId),
            orderId: data.orderId,
            paymentId: data.paymentId,
            paymentStatus: data.paymentStatus || 'PENDING',
            paymentMethod: data.paymentMethod,
            paymentCapturedAt: data.paymentCapturedAt ? new Date(data.paymentCapturedAt) : null,
          }
        });
        results.push(donation);
      }
      return results;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating donations', error: error.message });
  }
};

const getAllDonations = async (req, res) => {
  try {
    const { startDate, endDate, causeId, status, search } = req.body;
    const where = { deletedAt: null };
    if (status) where.paymentStatus = status;
    if (causeId) where.causeId = parseInt(causeId);
    if (startDate || endDate) where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { message: { contains: search } }
      ];
    }

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { cause: true, user: true }
    });
    res.json(donations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching donations', error: error.message });
  }
};

const getDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const donationId = parseInt(id);
    if (isNaN(donationId)) {
      return res.status(400).json({ message: 'Invalid donation ID' });
    }

    const donation = await prisma.donation.findUnique({
      where: { id: donationId, deletedAt: null },
      include: { cause: true, user: true }
    });
    if (!donation) return res.status(404).json({ message: 'Donation not found' });
    res.json(donation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching donation', error: error.message });
  }
};

const updateDonation = async (req, res) => {
  try {
    let updates = Array.isArray(req.body) ? req.body : [req.body];

    const parsedUpdates = updates.map(update => ({
      ...update,
      id: parseInt(update.id),
    })).filter(update => !isNaN(update.id));
    if (parsedUpdates.length === 0) {
      return res.status(400).json({ message: 'No valid donation IDs provided' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const update of parsedUpdates) {
        const donationId = update.id;
        const donationExists = await tx.donation.findUnique({
          where: { id: donationId, deletedAt: null }
        });
        if (!donationExists) {
          throw new Error(`Donation with ID ${donationId} not found`);
        }

        const data = {};
        if (update.amount) data.amount = parseFloat(update.amount);
        if (update.paymentStatus) data.paymentStatus = update.paymentStatus;
        if (update.message) data.message = update.message;
        if (update.name !== undefined) data.name = update.name;
        if (update.email !== undefined) data.email = update.email;
        if (update.isAnonymous !== undefined) data.isAnonymous = update.isAnonymous;
        if (update.causeId) {
          const cause = await tx.cause.findUnique({
            where: { id: parseInt(update.causeId), deletedAt: null }
          });
          if (!cause) {
            throw new Error(`Cause with ID ${update.causeId} not found`);
          }
          data.causeId = parseInt(update.causeId);
        }
        if (update.userId) {
          const user = await tx.user.findUnique({
            where: { id: parseInt(update.userId), deletedAt: null }
          });
          if (!user) {
            throw new Error(`User with ID ${update.userId} not found`);
          }
          data.userId = parseInt(update.userId);
        } else if (update.userId === null) {
          data.userId = null;
        }
        if (update.paymentMethod) data.paymentMethod = update.paymentMethod;
        if (update.paymentCapturedAt) data.paymentCapturedAt = new Date(update.paymentCapturedAt);

        const donation = await tx.donation.update({
          where: { id: donationId, deletedAt: null },
          data,
          include: { cause: true, user: true }
        });
        results.push(donation);
      }
      return results;
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating donations', error: error.message });
  }
};

const deleteDonation = async (req, res) => {
  try {
    let ids = req.body.ids;
    if (!Array.isArray(ids)) ids = [req.params.id];

    const parsedIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (parsedIds.length === 0) {
      return res.status(400).json({ message: 'No valid donation IDs provided' });
    }

    let deletedIds = await prisma.$transaction(async (tx) => {
      for (const id of parsedIds) {
        const donation = await tx.donation.findUnique({
          where: { id, deletedAt: null }
        });
        if (!donation) continue;

        await tx.donation.update({
          where: { id },
          data: { deletedAt: new Date() }
        });
      }
    });

    res.status(204).json({deletedIds});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting donations', error: error.message });
  }
};

const getCauseDonations = async (req, res) => {
  try {
    let { causeIds, startDate, endDate, status, search } = req.body;
    if (!Array.isArray(causeIds)) causeIds = [causeIds];

    const parsedCauseIds = causeIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (parsedCauseIds.length === 0) {
      return res.status(400).json({ message: 'No valid cause IDs provided' });
    }

    const where = { causeId: { in: parsedCauseIds }, deletedAt: null };
    if (status) where.paymentStatus = status;
    if (startDate || endDate) where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { message: { contains: search } }
      ];
    }

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { user: true, cause: true }
    });
    res.json(donations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching cause donations', error: error.message });
  }
};

const getDonationSummary = async (req, res) => {
  try {
    const { causeIds } = req.body;
    const where = { paymentStatus: 'CAPTURED', deletedAt: null };

    if (causeIds) {
      const parsedCauseIds = Array.isArray(causeIds)
        ? causeIds.map(id => parseInt(id)).filter(id => !isNaN(id))
        : [parseInt(causeIds)].filter(id => !isNaN(id));
      if (parsedCauseIds.length === 0) {
        return res.status(400).json({ message: 'No valid cause IDs provided' });
      }
      where.causeId = { in: parsedCauseIds };
    }

    const summary = await prisma.donation.groupBy({
      by: ['causeId'],
      where,
      _sum: { amount: true },
      _count: { id: true }
    });

    const result = summary.map(item => ({
      causeId: item.causeId,
      totalAmount: item._sum.amount || 0,
      donationCount: item._count.id
    }));

    const total = await prisma.donation.aggregate({
      where,
      _sum: { amount: true }
    });

    res.json({
      total: total._sum.amount || 0,
      causes: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching donation summary', error: error.message });
  }
};

module.exports = {
  createDonation,
  getAllDonations,
  getDonation,
  updateDonation,
  deleteDonation,
  getCauseDonations,
  getDonationSummary
};