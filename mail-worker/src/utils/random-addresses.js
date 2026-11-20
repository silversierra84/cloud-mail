import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';

const letters = 'abcdefghijklmnopqrstuvwxyz';
const digits = '0123456789';

function randomCharacters(alphabet, length) {
	return Array.from(crypto.getRandomValues(new Uint32Array(length)),
		value => alphabet[Math.floor(value / 2 ** 32 * alphabet.length)]).join('');
}

export function randomAddressCandidates({ quantity, randomMode, partLength, digitLength }) {
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000 ||
		!['mixed', 'lettersDigits', 'digits'].includes(randomMode) ||
		(randomMode === 'lettersDigits' && (!Number.isInteger(partLength) || partLength < 1 || partLength > 32)) ||
		(randomMode === 'digits' && (!Number.isInteger(digitLength) || digitLength < 1 || digitLength > 64))) {
		throw new BizError(t('invalidRandomAddressOptions'));
	}

	const capacity = randomMode === 'lettersDigits' ? 260 ** partLength
		: randomMode === 'digits' ? 10 ** digitLength : Infinity;
	if (quantity > capacity) throw new BizError(t('randomAddressCapacity'));

	if (capacity <= 10000) {
		return shuffledPrefixes(capacity, randomMode, digitLength);
	}
	return sampledPrefixes(randomMode, partLength, digitLength, Math.max(quantity * 5, 100));
}

function* shuffledPrefixes(capacity, mode, digitLength) {
	const remaining = Array.from({ length: capacity }, (_, index) => index);
	while (remaining.length) {
		const index = Math.floor(Math.random() * remaining.length);
		const value = remaining[index];
		remaining[index] = remaining.at(-1);
		remaining.pop();
		yield mode === 'digits'
			? String(value).padStart(digitLength, '0')
			: letters[Math.floor(value / 10)] + digits[value % 10];
	}
}

function* sampledPrefixes(mode, partLength, digitLength, attempts) {
	const seen = new Set();
	for (let attempt = 0; attempt < attempts; attempt++) {
		let prefix;
		if (mode === 'lettersDigits') {
			prefix = randomCharacters(letters, partLength) + randomCharacters(digits, partLength);
		} else if (mode === 'digits') {
			prefix = randomCharacters(digits, digitLength);
		} else {
			prefix = randomCharacters(letters + digits, Math.floor(Math.random() * 7) + 5);
		}
		if (seen.has(prefix)) continue;
		seen.add(prefix);
		yield prefix;
	}
}
