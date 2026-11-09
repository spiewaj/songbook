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

    test('getUserNamespaceKeys finds all namespaces associated with user', () => {
        const user = { uid: 'user_123' };
        const mySongbooks = [
            { id: 'wdw21:2023', creatorId: 'user_123' },
            { id: 'personal_book', creatorId: 'user_123' }
        ];
        const allSongbooks = [
            { id: 'wdw21:2024', creatorId: 'someone_else' },
            { id: 'zhr_lodz:ognisko', ownerIds: ['user_123'] }
        ];

        function isUserOwner(sb, u) {
            return sb && u && (sb.creatorId === u.uid || (Array.isArray(sb.ownerIds) && sb.ownerIds.includes(u.uid)));
        }

        const keys = new Set();
        mySongbooks.forEach(sb => {
            const info = getSongbookGroupInfo(sb);
            if (info && info.key) keys.add(info.key);
        });
        allSongbooks.forEach(sb => {
            if (isUserOwner(sb, user)) {
                const info = getSongbookGroupInfo(sb);
                if (info && info.key) keys.add(info.key);
            }
        });

        expect(keys.has('wdw21')).toBe(true);
        expect(keys.has('zhr_lodz')).toBe(true);
        expect(keys.has('53wdh')).toBe(false);
    });

    test('partitions songbooks into starred, my & namespaces, and other', () => {
        const user = { uid: 'user_ptab' };
        function isUserOwner(sb, u) {
            return sb && u && (sb.creatorId === u.uid || (Array.isArray(sb.ownerIds) && sb.ownerIds.includes(u.uid)));
        }

        const mySongbooks = [
            { id: 'wdw21:2023', title: '21 WDW 2023', creatorId: 'user_ptab' },
            { id: 'moj_prywatny', title: 'Mój prywatny', creatorId: 'user_ptab' }
        ];

        const allSongbooks = [
            { id: 'wdw21:2023', title: '21 WDW 2023', creatorId: 'user_ptab' },
            { id: 'wdw21:2024', title: '21 WDW 2024', creatorId: 'other_author' }, // belongs to user's namespace!
            { id: '53wdh:2024', title: '53 WDH 2024', creatorId: 'skrzaty' },
            { id: 'dino', title: 'Dinozaury', creatorId: 'dino_fan' }
        ];

        const userNamespaceKeys = new Set(['wdw21']);
        const starredSet = new Set(['dino']);

        const knownMap = new Map();
        allSongbooks.forEach(sb => knownMap.set(sb.id, sb));
        mySongbooks.forEach(sb => knownMap.set(sb.id, sb));

        const starredList = Array.from(starredSet).map(id => knownMap.get(id)).filter(Boolean);

        const myMap = new Map();
        mySongbooks.forEach(sb => myMap.set(sb.id, sb));
        allSongbooks.forEach(sb => {
            const isMine = isUserOwner(sb, user) || userNamespaceKeys.has(getSongbookGroupInfo(sb)?.key);
            if (isMine && !myMap.has(sb.id)) {
                myMap.set(sb.id, sb);
            }
        });
        const mySectionList = Array.from(myMap.values());
        const otherSectionList = allSongbooks.filter(sb => !myMap.has(sb.id));

        // Verify Starred:
        expect(starredList.map(s => s.id)).toEqual(['dino']);

        // Verify My songbooks (includes owned wdw21:2023, personal moj_prywatny, AND namespace wdw21:2024):
        expect(mySectionList.map(s => s.id).sort()).toEqual(['moj_prywatny', 'wdw21:2023', 'wdw21:2024'].sort());

        // Verify Other songbooks (only non-namespace, non-owned):
        expect(otherSectionList.map(s => s.id).sort()).toEqual(['53wdh:2024', 'dino'].sort());
    });
});

