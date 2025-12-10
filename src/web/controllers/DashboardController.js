const dataService = require('../services/DataService');
const analyticsService = require('../services/AnalyticsService');

class DashboardController {
    getDashboard(req, res) {
        try {
            const campaigns = dataService.getCampaignData();
            const userPrefs = dataService.loadUserPreferences();

            const totalCampaigns = campaigns.length;
            const totalLeads = campaigns.reduce((sum, campaign) =>
                sum + (campaign.results?.totalLeads || 0), 0);
            const totalPriorityLeads = campaigns.reduce((sum, campaign) =>
                sum + (campaign.results?.priorityLeads || 0), 0);
            const averageScore = campaigns.length > 0 ?
                Math.round(campaigns.reduce((sum, campaign) =>
                    sum + (campaign.results?.averageScore || 0), 0) / campaigns.length) : 0;

            const recentActivity = campaigns.slice(0, 5).map(campaign => ({
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                industry: campaign.industry,
                executedAt: campaign.executedAt,
                totalLeads: campaign.results?.totalLeads || 0,
                priorityLeads: campaign.results?.priorityLeads || 0
            }));

            res.json({
                overview: {
                    totalCampaigns,
                    totalLeads,
                    totalPriorityLeads,
                    averageScore,
                    primaryIndustry: userPrefs?.industry || 'professional'
                },
                recentActivity,
                userPreferences: userPrefs
            });
        } catch (error) {
            console.error('Error getting dashboard data:', error);
            res.status(500).json({ error: 'Failed to load dashboard data' });
        }
    }

    getAnalytics(req, res) {
        try {
            const data = analyticsService.getAnalytics();
            res.json(data);
        } catch (error) {
            console.error('Error getting analytics:', error);
            res.status(500).json({ error: 'Failed to load analytics' });
        }
    }
}

module.exports = new DashboardController();
