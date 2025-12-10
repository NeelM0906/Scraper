const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/DashboardController');
const campaignController = require('../controllers/CampaignController');
const leadController = require('../controllers/LeadController');

// Dashboard & Analytics
router.get('/dashboard', dashboardController.getDashboard);
router.get('/analytics', dashboardController.getAnalytics);

// Campaigns
router.get('/campaigns', campaignController.getAll);
router.post('/campaigns', campaignController.create);
router.post('/campaigns/merge', campaignController.merge); // Merge route
router.get('/campaigns/:id', campaignController.getById);
router.put('/campaigns/:id', campaignController.update); // Update route
router.delete('/campaigns/:id', campaignController.delete); // Delete route
router.get('/campaigns/:id/status', campaignController.getStatus);

// Export
router.get('/campaigns/:id/export/csv', campaignController.exportCSV); // CSV Export
router.get('/campaigns/:id/leads/:index/vcard', campaignController.exportVCard);

// Leads
router.get('/campaigns/:id/leads', leadController.getLeads);
router.get('/leads/:campaignId/:leadIndex/vcard', leadController.exportVCard);

module.exports = router;
