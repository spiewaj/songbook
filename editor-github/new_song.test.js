import test from 'node:test';
import assert from 'node:assert/strict';
import { slugifyTitle, getDirForGenre, sanitizeBranchName } from './naming.js';

test('slugifyTitle strips diacritics and sanitizes special chars', () => {
    assert.equal(slugifyTitle('Wehikuł Czasu'), 'Wehikul_Czasu');
    assert.equal(slugifyTitle('Żółta łódź podwodna'), 'Zolta_lodz_podwodna');
    assert.equal(slugifyTitle('Ciągle pada...'), 'Ciagle_pada');
    assert.equal(slugifyTitle('O, mój rozmarynie!'), 'O_moj_rozmarynie');
    assert.equal(slugifyTitle('  1000   bajek  '), '1000_bajek');
    assert.equal(slugifyTitle('Jak witać: "Dzień dobry"?'), 'Jak_witac_Dzien_dobry');
    assert.equal(slugifyTitle(''), 'nowa_piosenka');
    assert.equal(slugifyTitle(null), 'nowa_piosenka');
    assert.equal(slugifyTitle(undefined), 'nowa_piosenka');
});

test('getDirForGenre maps genres to appropriate directories', () => {
    assert.equal(getDirForGenre('Kolęda'), 'songs/pl/koledy');
    assert.equal(getDirForGenre('Piosenka harcerska'), 'songs/pl/harc');
    assert.equal(getDirForGenre('Piosenka harcerska - parodia'), 'songs/pl/harc');
    assert.equal(getDirForGenre('Szanta'), 'songs/pl/szanty');
    assert.equal(getDirForGenre('Poezja śpiewana'), 'songs/pl/poezja');
    assert.equal(getDirForGenre('Pop'), 'songs/pl/pop');
    assert.equal(getDirForGenre('Rock'), 'songs/pl/pop');
    assert.equal(getDirForGenre('Pieśń ludowa'), 'songs/pl/folk');
    assert.equal(getDirForGenre('Piosenka kabaretowa'), 'songs/pl/kabaret');
    assert.equal(getDirForGenre('Piosenka turystyczna górska'), 'songs/pl/turystyczne');
    assert.equal(getDirForGenre(''), 'songs/pl/turystyczne');
    assert.equal(getDirForGenre(null), 'songs/pl/turystyczne');
    assert.equal(getDirForGenre(undefined), 'songs/pl/turystyczne');
    assert.equal(getDirForGenre('Inna'), 'songs/pl/turystyczne');
});

test('sanitizeBranchName replaces invalid characters with underscore', () => {
    assert.equal(sanitizeBranchName('se-2026-11-07-Wehikul_Czasu'), 'se-2026-11-07-Wehikul_Czasu');
    assert.equal(sanitizeBranchName('se-2026-11-07-piosenka:nowa!'), 'se-2026-11-07-piosenka_nowa_');
    assert.equal(sanitizeBranchName('se 2026 11 07'), 'se_2026_11_07');
    assert.equal(sanitizeBranchName(''), 'se-branch');
    assert.equal(sanitizeBranchName(null), 'se-branch');
});
