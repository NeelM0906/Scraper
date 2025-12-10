
class ZipCodeService {
    /**
     * Generates a list of zip codes between start and end (inclusive).
     * Handles string padding (e.g. '07001').
     * @param {string} startZip 
     * @param {string} endZip 
     * @returns {string[]} Array of zip codes
     */
    static generateRange(startZip, endZip) {
        const start = parseInt(startZip, 10);
        const end = parseInt(endZip, 10);

        if (isNaN(start) || isNaN(end)) {
            throw new Error('Invalid zip code format');
        }

        if (start > end) {
            throw new Error('Start zip code must be less than or equal to end zip code');
        }

        // Safety limit to prevent massive accidental ranges
        const MAX_RANGE = 1000;
        if ((end - start) > MAX_RANGE) {
            throw new Error(`Range too large. Please limit to ${MAX_RANGE} zip codes at a time.`);
        }

        const zips = [];
        for (let i = start; i <= end; i++) {
            // Pad with leading zeros to ensure 5 digits
            zips.push(String(i).padStart(5, '0'));
        }

        return zips;
    }
}

module.exports = ZipCodeService;
