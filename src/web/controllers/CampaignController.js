const dataService = require('../services/DataService');
const campaignService = require('../services/CampaignService');
const vcardGenerator = require('../utils/vcardGenerator');

class CampaignController {
    getAll(req, res) {
        try {
            const campaigns = dataService.getCampaignData();
            res.json(campaigns);
        } catch (error) {
            console.error('Error getting campaigns:', error);
            res.status(500).json({ error: 'Failed to load campaigns' });
        }
    }

    getById(req, res) {
        try {
            const campaign = dataService.getCampaign(req.params.id);
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' });
            }

            const leads = dataService.getLeadsData(req.params.id);
            campaign.leads = leads;
            res.json(campaign);
        } catch (error) {
            console.error('Error getting campaign details:', error);
            res.status(500).json({ error: 'Failed to load campaign details' });
        }
    }

    create(req, res) {
        console.log('[DEBUG] CampaignController.create request body:', JSON.stringify(req.body, null, 2));
        try {
            const { name, industry, location, searchQuery, maxResults, yourService, contentStyle, searchMode, zipStart, zipEnd, batchSize } = req.body;

            console.log('[CampaignController] Request Body:', req.body);

            // Conditional validation
            if (searchMode === 'grid') {
                if (!zipStart || !zipEnd) {
                    return res.status(400).json({ error: 'Zip Start and Zip End are required for Grid Search' });
                }
                // Auto-set location name for display
                req.body.location = `Zip Range ${zipStart}-${zipEnd}`;

                // Validate batchSize
                const parallel = parseInt(batchSize, 10) || 1;
                if (parallel < 1 || parallel > 5) {
                    return res.status(400).json({ error: 'Parallel launches must be between 1 and 5' });
                }
                req.body.batchSize = parallel;

                // Let service handle maxResults logic for grid
            } else {
                if (!location) {
                    return res.status(400).json({ error: 'Location is required for Standard Search' });
                }
            }

            // Common validations
            if (!name || !industry || !searchQuery || !yourService) {
                return res.status(400).json({ error: 'Missing required common fields' });
            }

            // Mapping searchMode to mode for service
            if (searchMode) req.body.mode = searchMode;

            const campaignId = campaignService.startCampaign(req.body);

            res.json({
                success: true,
                campaignId,
                message: 'Campaign started successfully'
            });
        } catch (error) {
            console.error('Error creating campaign:', error);
            res.status(500).json({ error: 'Failed to create campaign' });
        }
    }

    getStatus(req, res) {
        const campaign = campaignService.getCampaignStatus(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json(campaign);
    }

    async update(req, res) {
        try {
            const { name } = req.body;
            const updated = await dataService.updateCampaign(req.params.id, { name });
            if (updated) res.json({ success: true, message: 'Updated successfully' });
            else res.status(404).json({ error: 'Campaign not found' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await dataService.deleteCampaign(req.params.id);
            res.json({ success: true, message: 'Deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async merge(req, res) {
        try {
            const { campaignIds, name } = req.body;
            if (!campaignIds || campaignIds.length < 2) return res.status(400).json({ error: 'Select at least 2 campaigns' });

            const newId = await campaignService.mergeCampaigns(campaignIds, name);
            res.json({ success: true, campaignId: newId });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async exportCSV(req, res) {
        try {
            const csvData = await dataService.exportToCSV(req.params.id);
            if (!csvData) return res.status(404).json({ error: 'Campaign not found' });

            const filename = `campaign_${req.params.id}_export.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvData);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Export failed' });
        }
    }

    exportVCard(req, res) {
        try {
            const leads = dataService.getLeadsData(req.params.id);
            const campaign = dataService.getCampaign(req.params.id);

            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' });
            }

            const vcards = leads.map(lead => vcardGenerator.generateVCard(lead)).join('\r\n\r\n');
            const filename = `${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_contacts.vcf`;

            res.setHeader('Content-Type', 'text/vcard');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(vcards);
        } catch (error) {
            console.error('Error generating vCard bundle:', error);
            res.status(500).json({ error: 'Failed to generate vCard bundle' });
        }
    }
}

module.exports = new CampaignController();
