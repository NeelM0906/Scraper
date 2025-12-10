const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const BusinessScraper = require('../../scraper');
const MarketingAI = require('../../marketingAI');
const LeadIntelligence = require('../../leadIntelligence');
const DataService = require('./DataService');
const ZipCodeService = require('./ZipCodeService');

class CampaignService extends EventEmitter {
    constructor() {
        super();
        this.activeCampaigns = new Map();
        // We use DataService for persistence, so outputDir usage here is mostly for legacy or temp file handling if needed
        this.outputDir = path.join(__dirname, '../../../output');
    }

    startCampaign(campaignData) {
        const { name, industry, location, searchQuery, maxResults, yourService, contentStyle, language, mode, zipStart, zipEnd, batchSize } = campaignData;
        const campaignId = `campaign_${name.replace(/\s+/g, '_')}_${Date.now()}`;

        const campaign = {
            id: campaignId,
            name,
            industry,
            location,
            searchQuery,
            maxResults: parseInt(maxResults) || 120, // Default to 120 if undefined
            yourService,
            contentStyle: contentStyle || 'balanced',
            language: language || 'english',
            mode: mode || 'standard',
            zipStart,
            zipEnd,
            batchSize: batchSize || 1,
            status: 'starting',
            progress: 0,
            leads: [],
            startedAt: new Date().toISOString()
        };

        this.activeCampaigns.set(campaignId, campaign);

        // Emit started event
        this.emit('campaign_started', {
            campaignId,
            message: `Campaign "${name}" started`
        });

        // Start async execution
        this.executeCampaignAsync(campaignId, campaign);

        return campaignId;
    }

    getCampaignStatus(campaignId) {
        return this.activeCampaigns.get(campaignId);
    }

    async executeCampaignAsync(campaignId, campaignData) {
        this.emit('campaign_progress', { campaignId, progress: 0, message: `Campaign "${campaignData.name}" initialized` });
        console.log(`[CampaignService] Starting campaign: ${campaignId}`);

        try {
            // Determine search mode & Prepare queries
            let searchQueries = [];

            if (campaignData.mode === 'grid' && campaignData.zipStart && campaignData.zipEnd) {
                // Multi Zip Search Mode
                try {
                    const zips = ZipCodeService.generateRange(campaignData.zipStart, campaignData.zipEnd);
                    console.log(`[CampaignService] Generated ${zips.length} zip codes: ${zips.join(', ')}`);

                    searchQueries = zips.map(zip => ({
                        query: `${campaignData.searchQuery} ${zip}`,
                        zip: zip
                    }));
                } catch (err) {
                    console.error('Zip generation error:', err);
                    // Fallback to single if fail
                    searchQueries = [{
                        query: `${campaignData.searchQuery} ${campaignData.zipStart}`,
                        zip: campaignData.zipStart
                    }];
                }

                // Use user-defined maxResults (default to 120 if missing)
                // campaignData.maxResults = campaignData.maxResults || 120; 

            } else {
                // Standard Mode
                searchQueries = [{ query: campaignData.searchQuery }];
                if (campaignData.location) {
                    searchQueries[0].query += ` in ${campaignData.location}`;
                }
            }

            const totalConfiguredZips = searchQueries.length;
            const allLeadsMap = new Map(); // Use Map for deduplication by URL/Phone/Name

            // 1. Scraping Phase - Concurrent Batches
            const BATCH_SIZE = campaignData.batchSize || 1; // Default to 1 if not specified
            console.log(`[CampaignService] Running with ${BATCH_SIZE} parallel browsers. Max Results per Zip: ${campaignData.maxResults}`);

            // Helper to process a single query item
            const processQueryItem = async (item) => {
                const scraper = new BusinessScraper();
                try {
                    await scraper.init();
                    console.log(`[CampaignService] Scraping: ${item.query}`);

                    const rawResults = await scraper.scrapeGoogleMaps(item.query, campaignData.maxResults || 120);
                    console.log(`[CampaignService] Zip ${item.zip || 'Standard'} returned ${rawResults.length} raw results.`);
                    await scraper.close();
                    return rawResults;
                } catch (err) {
                    console.error(`[CampaignService] Error scraping ${item.query}:`, err);
                    if (scraper) await scraper.close();
                    return [];
                }
            };

            for (let i = 0; i < searchQueries.length; i += BATCH_SIZE) {
                const batch = searchQueries.slice(i, i + BATCH_SIZE);
                const currentProgress = Math.round((i / totalConfiguredZips) * 50);

                this.emit('campaign_progress', {
                    campaignId,
                    progress: currentProgress,
                    message: `Scraping batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.map(b => b.zip || 'Query').join(', ')})`
                });

                // Run batch concurrently
                const batchResults = await Promise.all(batch.map(item => processQueryItem(item)));

                // Process results from all scrapers in this batch
                for (const results of batchResults) {
                    for (const result of results) {
                        // FIX: Use result.id (URL) or result.name as primary keys. 
                        // Previous code used result.link/title which were undefined.
                        let uniqueKey = result.id || result.referenceLink || result.phone || `${result.name}|${result.address}`;

                        if (!allLeadsMap.has(uniqueKey)) {
                            const lead = {
                                ...result,
                                name: result.name || result.title, // content fallback
                                industry: campaignData.industry,
                                location: result.address || (typeof batch[0].zip === 'string' ? batch[0].zip : 'Unknown'),
                                rating: result.rating || 'N/A',
                                reviews: result.reviews || 0,
                                intelligence: {
                                    score: 0,
                                    priority: 'LOW',
                                    analysis: 'Pending analysis',
                                    marketingContent: {}
                                }
                            };
                            allLeadsMap.set(uniqueKey, lead);
                        }
                    }
                }

                // Small delay between batches to be safe
                if (i + BATCH_SIZE < searchQueries.length) await new Promise(r => setTimeout(r, 3000));
            }

            // No global scraper close needed here as we close per instance
            // await scraper.close();

            const allLeads = Array.from(allLeadsMap.values());

            // 2. Intelligence Phase
            this.emit('campaign_progress', { campaignId, progress: 50, message: `Analyzing ${allLeads.length} unique leads with AI...` });

            const intelligence = new LeadIntelligence();

            // Score leads (limit to batch of 100 for now to avoid massive API costs if user runs huge grid)
            // Ideally we'd batch this. For now let's just process them.
            const scoredLeads = await intelligence.scoreLeads(allLeads, campaignData.industry);

            // 3. Marketing Content Generation Phase
            this.emit('campaign_progress', { campaignId, progress: 80, message: 'Generating personalized marketing content...' });

            const marketingAI = new MarketingAI();
            const highPriorityLeads = scoredLeads.filter(lead =>
                (lead.intelligence?.priority === 'HIGH' || lead.intelligence?.priority === 'high')
            );

            // Limit content generation to top 5 to save tokens
            const contentGenerationTarget = highPriorityLeads.slice(0, 5);

            for (let i = 0; i < contentGenerationTarget.length; i++) {
                try {
                    const content = await marketingAI.generateIndustrySpecificContent(
                        contentGenerationTarget[i],
                        campaignData.industry,
                        campaignData.yourService,
                        campaignData.contentStyle,
                        campaignData.language
                    );

                    if (content && contentGenerationTarget[i].intelligence) {
                        contentGenerationTarget[i].intelligence.marketingContent = content;
                    }
                } catch (err) {
                    console.error('Content gen error:', err);
                }
            }

            // 4. Save and Finalize
            const stats = this.calculateStats(scoredLeads);

            const finalResults = {
                id: campaignId,
                ...campaignData,
                status: 'completed',
                leads: scoredLeads,
                results: stats,
                executedAt: new Date().toISOString()
            };

            await DataService.saveCampaign(finalResults);

            this.activeCampaigns.delete(campaignId);
            this.emit('campaign_completed', {
                campaignId,
                progress: 100,
                results: stats,
                message: `Grid search completed. Found ${scoredLeads.length} unique leads.`
            });

        } catch (error) {
            console.error(`[CampaignService] Campaign failed:`, error);
            this.activeCampaigns.delete(campaignId);
            this.emit('campaign_failed', {
                campaignId,
                message: error.message
            });
        }
    }

    async mergeCampaigns(campaignIds, newName) {
        console.log(`[CampaignService] Merging campaigns: ${campaignIds.join(', ')} into "${newName}"`);

        const allCampaigns = DataService.getCampaignData();
        const targets = allCampaigns.filter(c => campaignIds.includes(c.id));

        let mergedLeadsMap = new Map();

        // 1. Combine and Deduplicate
        for (const campaignInfo of targets) {
            const leads = DataService.getLeadsData(campaignInfo.id) || [];

            for (const lead of leads) {
                // Use same dedupe logic as scraping
                let uniqueKey = lead.link || lead.phone || `${lead.name}|${lead.address}`;
                if (!mergedLeadsMap.has(uniqueKey)) {
                    mergedLeadsMap.set(uniqueKey, lead);
                }
            }
        }

        const mergedLeads = Array.from(mergedLeadsMap.values());

        // 2. Create New Campaign Object
        const campaignId = `campaign_${newName.replace(/\s+/g, '_')}_${Date.now()}`;
        const stats = this.calculateStats(mergedLeads);

        const newCampaign = {
            id: campaignId,
            name: newName,
            industry: targets[0]?.industry || 'Merged',
            location: 'Merged Dataset',
            searchQuery: 'Merged',
            maxResults: stats.totalLeads,
            yourService: 'Merged Dataset',
            mode: 'merge',
            status: 'completed',
            leads: mergedLeads,
            results: stats,
            executedAt: new Date().toISOString()
        };

        // 3. Save
        await DataService.saveCampaign(newCampaign);

        return campaignId;
    }

    calculateStats(leads) {
        return {
            totalLeads: leads.length,
            priorityLeads: leads.filter(l => l.intelligence?.priority === 'HIGH' || l.intelligence?.priority === 'high').length,
            averageScore: leads.length > 0
                ? (leads.reduce((acc, l) => acc + (l.intelligence?.score || 0), 0) / leads.length).toFixed(1)
                : 0
        };
    }
}

module.exports = new CampaignService();
