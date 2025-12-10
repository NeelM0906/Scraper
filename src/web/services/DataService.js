const fs = require('fs');
const path = require('path');

class DataService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../../output');
        this.prefsFile = path.join(__dirname, '../../user-preferences.json'); // Adjusted path relative to src/web/services
    }

    loadUserPreferences() {
        // Need to check where user-preferences.json is actually stored relative to this file
        // Assumed logic from server.js: fs.existsSync('user-preferences.json') (root dir)
        // Adjusting to look in project root
        const rootPrefs = path.join(process.cwd(), 'user-preferences.json');

        try {
            if (fs.existsSync(rootPrefs)) {
                return JSON.parse(fs.readFileSync(rootPrefs, 'utf8'));
            }
        } catch (error) {
            console.log('Could not load user preferences:', error.message);
        }
        return null;
    }

    getCampaignData() {
        if (!fs.existsSync(this.outputDir)) {
            return [];
        }

        const campaigns = [];
        const campaignDirs = fs.readdirSync(this.outputDir).filter(dir =>
            fs.statSync(path.join(this.outputDir, dir)).isDirectory() && dir.startsWith('campaign_')
        );

        for (const dir of campaignDirs) {
            const campaignPath = path.join(this.outputDir, dir);
            const infoPath = path.join(campaignPath, 'campaign_info.json');

            if (fs.existsSync(infoPath)) {
                try {
                    const campaignInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                    campaignInfo.id = dir;
                    campaignInfo.path = campaignPath;
                    campaigns.push(campaignInfo);
                } catch (error) {
                    console.log(`Error reading campaign info for ${dir}:`, error.message);
                }
            }
        }

        // Sort by execution date (newest first)
        campaigns.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
        return campaigns;
    }

    getLeadsData(campaignId) {
        const campaignPath = path.join(this.outputDir, campaignId);
        const leadsPath = path.join(campaignPath, 'leads_with_intelligence.json');

        if (fs.existsSync(leadsPath)) {
            try {
                return JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
            } catch (error) {
                console.log(`Error reading leads data for ${campaignId}:`, error.message);
            }
        }
        return [];
    }

    getCampaign(campaignId) {
        const campaigns = this.getCampaignData();
        return campaigns.find(c => c.id === campaignId);
    }

    saveCampaign(campaignData) {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const campaignOutputDir = path.join(this.outputDir, campaignData.id);
        if (!fs.existsSync(campaignOutputDir)) {
            fs.mkdirSync(campaignOutputDir, { recursive: true });
        }

        const campaignInfo = {
            id: campaignData.id,
            name: campaignData.name,
            industry: campaignData.industry,
            location: campaignData.location,
            searchQuery: campaignData.searchQuery,
            maxResults: campaignData.maxResults,
            mode: campaignData.mode,
            zipStart: campaignData.zipStart,
            zipEnd: campaignData.zipEnd,
            yourService: campaignData.yourService,
            contentStyle: campaignData.contentStyle,
            language: campaignData.language,
            results: campaignData.results,
            status: campaignData.status,
            executedAt: campaignData.executedAt || new Date().toISOString()
        };

        fs.writeFileSync(path.join(campaignOutputDir, 'campaign_info.json'), JSON.stringify(campaignInfo, null, 2));

        if (campaignData.leads) {
            fs.writeFileSync(path.join(campaignOutputDir, 'leads_with_intelligence.json'), JSON.stringify(campaignData.leads, null, 2));
        }
    }
    updateCampaign(id, updates) {
        const campaign = this.getCampaign(id);
        if (!campaign) return false;

        const campaignPath = path.join(this.outputDir, id);
        const infoPath = path.join(campaignPath, 'campaign_info.json');

        const updatedInfo = { ...campaign, ...updates };

        // Remove non-persisted fields if any (like 'path') which we added in getCampaignData but shouldn't save?
        // Actually getCampaignData added 'id' and 'path'. 'path' shouldn't be in JSON.
        delete updatedInfo.path;

        try {
            fs.writeFileSync(infoPath, JSON.stringify(updatedInfo, null, 2));
            return true;
        } catch (error) {
            console.error(`Error updating campaign ${id}:`, error);
            return false;
        }
    }

    deleteCampaign(id) {
        const campaignPath = path.join(this.outputDir, id);
        if (fs.existsSync(campaignPath)) {
            fs.rmSync(campaignPath, { recursive: true, force: true });
            return true;
        }
        return false;
    }

    exportToCSV(campaignId) {
        const leads = this.getLeadsData(campaignId);
        if (!leads || leads.length === 0) return null;

        // Define Headers
        const headers = [
            'Name', 'Phone', 'Address', 'Website', 'Rating', 'Reviews',
            'Industry', 'Location', 'Priority', 'Score', 'Analysis'
        ];

        // Map Rows
        const rows = leads.map(lead => {
            return [
                lead.name,
                lead.phone,
                lead.address,
                lead.website,
                lead.rating,
                lead.reviews,
                lead.industry,
                lead.location,
                lead.intelligence?.priority || 'LOW',
                lead.intelligence?.score || 0,
                // Escape quotes in analysis
                `"${(lead.intelligence?.analysis || '').replace(/"/g, '""')}"`
            ].map(field => {
                // Ensure CSV safety for all fields
                const stringVal = String(field || '');
                if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            }).join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }
}

module.exports = new DataService();
