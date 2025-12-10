const dataService = require('./DataService');

class AnalyticsService {
    getAnalytics() {
        const campaigns = dataService.getCampaignData();

        // Industry distribution
        const industryStats = {};
        campaigns.forEach(campaign => {
            const industry = campaign.industry || 'unknown';
            if (!industryStats[industry]) {
                industryStats[industry] = { campaigns: 0, totalLeads: 0, avgScore: 0 };
            }
            industryStats[industry].campaigns++;
            industryStats[industry].totalLeads += campaign.results?.totalLeads || 0;
            industryStats[industry].avgScore += campaign.results?.averageScore || 0;
        });

        // Calculate averages
        Object.keys(industryStats).forEach(industry => {
            industryStats[industry].avgScore = Math.round(
                industryStats[industry].avgScore / industryStats[industry].campaigns
            );
        });

        // Lead quality distribution
        const qualityDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
        campaigns.forEach(campaign => {
            const leads = dataService.getLeadsData(campaign.id);
            leads.forEach(lead => {
                const priority = lead.intelligence?.priority || 'LOW';
                qualityDistribution[priority]++;
            });
        });

        // Campaign performance over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCampaigns = campaigns.filter(campaign =>
            new Date(campaign.executedAt) >= thirtyDaysAgo
        );

        return {
            industryStats,
            qualityDistribution,
            campaignTrends: {
                totalCampaigns: campaigns.length,
                recentCampaigns: recentCampaigns.length,
                totalLeads: campaigns.reduce((sum, c) => sum + (c.results?.totalLeads || 0), 0),
                avgQualityScore: campaigns.length > 0 ?
                    Math.round(campaigns.reduce((sum, c) => sum + (c.results?.averageScore || 0), 0) / campaigns.length) : 0
            }
        };
    }
}

module.exports = new AnalyticsService();
