/**
 * Tests for songbook namespaces, groups, and ID validation logic.
 */

const KNOWN_GROUPS = {
    'wdw21': { name: '21. WDW „Stare Żbiki”', icon: 'forest' },
    '21wdw': { name: '21. WDW „Stare Żbiki”', icon: 'forest' },
    '53wdh': { name: '53. WDH „Bajkowe Skrzaty”', icon: 'camping' },
    '53wdhiz': { name: '53. WDH „Bajkowe Skrzaty”', icon: 'camping' },
    'dino': { name: 'Dinozaury', icon: 'history_edu' },
    'spiewnik_lupienicki': { name: 'Śpiewnik Łupienicki', icon: 'music_note' },
};

function formatGroupName(key) {
    if (!key) return '';
    return key
        .split(/[_-]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function getSongbookGroupInfo(sb) {
    if (!sb || !sb.id) return null;
    let groupKey = null;

    if (sb.group) {
        groupKey = String(sb.group).toLowerCase().trim();
    } else if (sb.id.includes(':')) {
        groupKey = sb.id.split(':')[0].toLowerCase().trim();
    } else if (KNOWN_GROUPS[sb.id.toLowerCase()]) {
        groupKey = sb.id.toLowerCase().trim();
    }

    if (!groupKey) return null;

    // Normalize known alias keys so they group together
    if (groupKey === '21wdw') groupKey = 'wdw21';
    if (groupKey === '53wdhiz') groupKey = '53wdh';

    const known = KNOWN_GROUPS[groupKey] || {};
    return {
        key: groupKey,
        name: sb.groupTitle || known.name || formatGroupName(groupKey),
        icon: known.icon || 'folder'
    };
}

function getSongbookCountLabel(count) {
    if (count === 1) return '1 śpiewnik';
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
        return `${count} śpiewniki`;
    }
    return `${count} śpiewników`;
}

function generateIdFromTitle(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ą/g, 'a')
        .replace(/ć/g, 'c')
        .replace(/ę/g, 'e')
        .replace(/ł/g, 'l')
        .replace(/ń/g, 'n')
        .replace(/ó/g, 'o')
        .replace(/ś/g, 's')
        .replace(/ź/g, 'z')
        .replace(/ż/g, 'z')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function sanitizeSongbookId(rawId) {
    if (!rawId) return 'spiewnik';
    if (rawId.includes(':')) {
        const parts = rawId.split(':');
        const prefix = generateIdFromTitle(parts[0]) || 'grupa';
        const suffix = generateIdFromTitle(parts.slice(1).join('_')) || 'spiewnik';
        return `${prefix}:${suffix}`;
    }
    return generateIdFromTitle(rawId) || 'spiewnik';
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+(:[a-zA-Z0-9_-]+)?$/;

describe('Songbook Namespaces and Groups', () => {
    test('extracts known group for colon namespaced ID', () => {
        const info = getSongbookGroupInfo({ id: 'wdw21:2023', title: 'Śpiewnik 2023' });
        expect(info).not.toBeNull();
        expect(info.key).toBe('wdw21');
        expect(info.name).toBe('21. WDW „Stare Żbiki”');
        expect(info.icon).toBe('forest');
    });

    test('normalizes legacy 21wdw to wdw21 group', () => {
        const info = getSongbookGroupInfo({ id: '21wdw', title: '21 WDW' });
        expect(info).not.toBeNull();
        expect(info.key).toBe('wdw21');
        expect(info.name).toBe('21. WDW „Stare Żbiki”');
    });

    test('normalizes 53wdhiz and 53wdh:xxx to the same group', () => {
        const legacy = getSongbookGroupInfo({ id: '53wdhiz' });
        const modern = getSongbookGroupInfo({ id: '53wdh:2024' });
        expect(legacy.key).toBe('53wdh');
        expect(modern.key).toBe('53wdh');
        expect(legacy.name).toBe('53. WDH „Bajkowe Skrzaty”');
        expect(modern.name).toBe('53. WDH „Bajkowe Skrzaty”');
        expect(legacy.icon).toBe('camping');
    });

    test('handles custom arbitrary namespace', () => {
        const info = getSongbookGroupInfo({ id: 'zhr_lodz:watra' });
        expect(info).not.toBeNull();
        expect(info.key).toBe('zhr_lodz');
        expect(info.name).toBe('Zhr Lodz');
        expect(info.icon).toBe('folder');
    });

    test('respects explicit sb.group and sb.groupTitle', () => {
        const info = getSongbookGroupInfo({ id: 'custom_id', group: 'wdw21', groupTitle: 'Żbiki Super Grupa' });
        expect(info.key).toBe('wdw21');
        expect(info.name).toBe('Żbiki Super Grupa');
    });

    test('returns null for ungrouped songbook IDs', () => {
        expect(getSongbookGroupInfo({ id: 'moj_spiewnik' })).toBeNull();
        expect(getSongbookGroupInfo({ id: 'harcerskie_ognisko' })).toBeNull();
        expect(getSongbookGroupInfo(null)).toBeNull();
    });

    test('Polish grammar count labels', () => {
        expect(getSongbookCountLabel(1)).toBe('1 śpiewnik');
        expect(getSongbookCountLabel(2)).toBe('2 śpiewniki');
        expect(getSongbookCountLabel(3)).toBe('3 śpiewniki');
        expect(getSongbookCountLabel(4)).toBe('4 śpiewniki');
        expect(getSongbookCountLabel(5)).toBe('5 śpiewników');
        expect(getSongbookCountLabel(11)).toBe('11 śpiewników');
        expect(getSongbookCountLabel(21)).toBe('21 śpiewników');
        expect(getSongbookCountLabel(22)).toBe('22 śpiewniki');
        expect(getSongbookCountLabel(25)).toBe('25 śpiewników');
    });

    test('VALID_ID_REGEX accepts single IDs and namespaced IDs with colon', () => {
        expect(VALID_ID_REGEX.test('wdw21:2023')).toBe(true);
        expect(VALID_ID_REGEX.test('wdw_21:oboz-letni_2024')).toBe(true);
        expect(VALID_ID_REGEX.test('moj-spiewnik_123')).toBe(true);
        expect(VALID_ID_REGEX.test('Spiewnik1')).toBe(true);

        // Disallowed: multiple colons, slashes, spaces, trailing colons
        expect(VALID_ID_REGEX.test('wdw21:2023:extra')).toBe(false);
        expect(VALID_ID_REGEX.test('wdw21/2023')).toBe(false);
        expect(VALID_ID_REGEX.test('wdw 21')).toBe(false);
        expect(VALID_ID_REGEX.test('wdw21:')).toBe(false);
        expect(VALID_ID_REGEX.test(':2023')).toBe(false);
        expect(VALID_ID_REGEX.test('')).toBe(false);
    });

    test('sanitizeSongbookId handles Polish diacritics and colons properly', () => {
        expect(sanitizeSongbookId('wdw21:2023')).toBe('wdw21:2023');
        expect(sanitizeSongbookId('wdw21:Obóz 2024!')).toBe('wdw21:oboz_2024');
        expect(sanitizeSongbookId('Żółty Śpiewnik Harcerski')).toBe('zolty_spiewnik_harcerski');
        expect(sanitizeSongbookId('ZHR Łódź:Wędrówki')).toBe('zhr_lodz:wedrowki');
    });
});

