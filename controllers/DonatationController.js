// controllers/donationController.js
const { prisma } = require('../config/db');

const createDonation = async (req, res) => {
  try {
    let donationsData = req.body.donations; // Array or single
    if (!Array.isArray(donationsData)) donationsData = [req.body];

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const data of donationsData) {
        const donation = await tx.donation.create({
          data: {
            userId: data.userId,
            name: data.name,
            email: data.email,
            amount: parseFloat(data.amount),
            message: data.message,
            batch: data.batch,
            isAnonymous: data.isAnonymous || false,
            causeId: data.causeId,
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
    res.status(500).json({ message: 'Error creating donations' });
  }
};

const getAllDonations = async (req, res) => {
  try {
    const { startDate, endDate, causeId, status, search } = req.body; // From body
    const where = {};
    if (status) where.paymentStatus = status;
    if (causeId) where.causeId = causeId;
    if (startDate || endDate) where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
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
    res.status(500).json({ message: 'Error fetching donations' });
  }
};

const getDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const donation = await prisma.donation.findUnique({
      where: { id },
      include: { cause: true, user: true }
    });
    if (!donation) return res.status(404).json({ message: 'Donation not found' });
    res.json(donation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching donation' });
  }
};

const updateDonation = async (req, res) => {
  try {
    let updates = req.body.updates; // Array of { id, ...fields }
    if (!Array.isArray(updates)) updates = [req.body];

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const update of updates) {
        const data = {};
        if (update.amount) data.amount = parseFloat(update.amount);
        if (update.paymentStatus) data.paymentStatus = update.paymentStatus;
        if (update.message) data.message = update.message;
        // Add other fields as needed

        const donation = await tx.donation.update({
          where: { id: update.id },
          data
        });
        results.push(donation);
      }
      return results;
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating donations' });
  }
};

const deleteDonation = async (req, res) => {
  try {
    let ids = req.body.ids;
    if (!Array.isArray(ids)) ids = [req.params.id];

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        await tx.donation.update({
          where: { id },
          data: { deletedAt: new Date() }
        });
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting donations' });
  }
};

const getCauseDonations = async (req, res) => {
  try {
    let { causeIds, startDate, endDate, status, search } = req.body; // causeIds array or single
    if (!Array.isArray(causeIds)) causeIds = [causeIds];

    const where = { causeId: { in: causeIds } };
    if (status) where.paymentStatus = status;
    if (startDate || endDate) where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { user: true }
    });
    res.json(donations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching cause donations' });
  }
};

const getDonationSummary = async (req, res) => {
  try {
    const { startDate, endDate, causeIds, groupBy } = req.body; // causeIds array
    const where = { paymentStatus: 'CAPTURED' };
    if (causeIds) where.causeId = { in: Array.isArray(causeIds) ? causeIds : [causeIds] };
    if (startDate || endDate) where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);

    const total = await prisma.donation.aggregate({
      where,
      _sum: { amount: true }
    });

    let grouped = [];
    if (groupBy) {
      let groupField;
      if (groupBy === 'day') groupField = 'DATE(date)';
      else if (groupBy === 'month') groupField = 'DATE_FORMAT(date, "%Y-%m")';
      else if (groupBy === 'year') groupField = 'YEAR(date)';
      else return res.status(400).json({ message: 'Invalid groupBy' });

      const causeFilter = causeIds ? `AND causeId IN ('${(Array.isArray(causeIds) ? causeIds : [causeIds]).join("','")}')` : '';
      grouped = await prisma.$queryRawUnsafe(`
        SELECT ${groupField} as period, SUM(amount) as sum
        FROM Donation
        WHERE paymentStatus = 'CAPTURED'
          ${causeFilter}
          ${startDate ? `AND date >= '${startDate}'` : ''}
          ${endDate ? `AND date <= '${endDate}'` : ''}
        GROUP BY period
        ORDER BY period DESC
      `);
    }

    res.json({ total: total._sum.amount || 0, grouped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching donation summary' });
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