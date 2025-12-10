const dataService = require('../services/DataService');
const vcardGenerator = require('../utils/vcardGenerator');

class LeadController {
    getLeads(req, res) {
        try {
            const leads = dataService.getLeadsData(req.params.id);
            const { page = 1, limit = 20, priority, minScore } = req.query;

            let filteredLeads = leads;

            if (priority) {
                filteredLeads = filteredLeads.filter(lead =>
                    lead.intelligence?.priority === priority.toUpperCase()
                );
            }

            if (minScore) {
                filteredLeads = filteredLeads.filter(lead =>
                    (lead.intelligence?.score || 0) >= parseInt(minScore)
                );
            }

            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

            res.json({
                leads: paginatedLeads,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: filteredLeads.length,
                    totalPages: Math.ceil(filteredLeads.length / limit)
                }
            });
        } catch (error) {
            console.error('Error getting leads:', error);
            res.status(500).json({ error: 'Failed to load leads' });
        }
    }

    exportVCard(req, res) {
        try {
            const { campaignId, leadIndex } = req.params;
            const leads = dataService.getLeadsData(campaignId);
            const lead = leads[parseInt(leadIndex)];

            if (!lead) {
                return res.status(404).json({ error: 'Lead not found' });
            }

            const vcard = vcardGenerator.generateVCard(lead);
            const filename = `${(lead.name || 'contact').replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;

            res.setHeader('Content-Type', 'text/vcard');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(vcard);
        } catch (error) {
            console.error('Error generating vCard:', error);
            res.status(500).json({ error: 'Failed to generate vCard' });
        }
    }
}

module.exports = new LeadController();
