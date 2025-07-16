const { Router } = require('express');
const { createDonation,deleteDonation,getAllDonations,getCauseDonations,getDonation,getDonationSummary,updateDonation } = require('../controllers/DonatationController');

const donationRoutes = Router();


donationRoutes.post('/', createDonation);


donationRoutes.post('/search', getAllDonations);


donationRoutes.get('/:id', getDonation);


donationRoutes.put('/', updateDonation);


donationRoutes.delete('/', deleteDonation);


donationRoutes.post('/cause', getCauseDonations);


donationRoutes.post('/summary', getDonationSummary);

module.exports = donationRoutes;