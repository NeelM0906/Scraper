/**
 * Utility to generate vCard strings for business leads.
 */

function generateVCard(lead) {
    const name = lead.name || 'Unknown Business';
    const phone = lead.phone || '';
    const address = lead.address || '';
    const website = lead.website || '';
    const rating = lead.rating || '';

    // Clean phone number for vCard format
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `ORG:${name}`,
        cleanPhone ? `TEL:${cleanPhone}` : '',
        address ? `ADR:;;${address};;;;` : '',
        website ? `URL:${website}` : '',
        rating ? `NOTE:Google Rating: ${rating} stars` : '',
        lead.intelligence ? `NOTE:Lead Score: ${lead.intelligence.score}/100 - Priority: ${lead.intelligence.priority}` : '',
        'END:VCARD'
    ].filter(line => line !== '').join('\r\n');

    return vcard;
}

module.exports = { generateVCard };
