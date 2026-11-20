import orm from '../entity/orm';
import { star } from '../entity/star';
import BizError from '../error/biz-error';
import { and, desc, eq, lt, sql, inArray } from 'drizzle-orm';
import email from '../entity/email';
import { isDel } from '../const/entity-const';
import attService from "./att-service";
import { t } from '../i18n/i18n'
const starService = {

	async add(c, params, userId) {
		const { emailId } = params;
		const db = orm(c);
		const existing = await db.select({ id: email.emailId }).from(email)
			.where(and(eq(email.emailId, emailId), eq(email.userId, userId))).get();
		if (!existing) throw new BizError(t('starNotExistEmail'));

		await c.env.db.prepare(`
			INSERT INTO star (user_id, email_id)
			SELECT user_id, email_id FROM email
			WHERE email_id = ? AND user_id = ?
			  AND NOT EXISTS (SELECT 1 FROM star WHERE star.email_id = email.email_id AND star.user_id = email.user_id)
		`).bind(emailId, userId).run();
	},

	async cancel(c, params, userId) {
		const { emailId } = params;
		await orm(c).delete(star).where(
			and(
				eq(star.userId, userId),
				eq(star.emailId, emailId)))
			.run();
	},

	async list(c, params, userId) {
		let { emailId, size } = params;
		emailId = Number(emailId);
		size = Number(size);

		if (!emailId) {
			emailId = 9999999999;
		}

		const list = await orm(c).select({
			isStar: sql`1`.as('isStar'),
			starId: star.starId
			, ...email
		}).from(star)
			.leftJoin(email, eq(email.emailId, star.emailId))
			.where(
				and(
					eq(star.userId, userId),
					eq(email.isDel, isDel.NORMAL),
					lt(star.emailId, emailId)))
			.orderBy(desc(star.emailId))
			.limit(size)
			.all();

		const emailIds = list.map(item => item.emailId);

		const attsList = await attService.selectByEmailIds(c, emailIds);

		list.forEach(emailRow => {
			const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
			emailRow.attList = atts;
		});

		return { list };
	},
	async removeByEmailIds(c, emailIds) {
		await orm(c).delete(star).where(inArray(star.emailId, emailIds)).run();
	}
};

export default starService;
