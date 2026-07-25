const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const { ensureRouletteSchema, normalizePrize, normalizeSpin } = require("../services/rouletteService");
const { seedRoyalVipPackages } = require("../services/royalAiTaskService");
const { ensureCreditPointsSchema, adjustCreditPoints, awardCreditPointMilestone, awardValidatedReferralCreditPoint } = require("../services/creditPointsService");
const { ensureRedeemCodeLimitSchema, getRedeemDailyLimitConfig, updateRedeemDailyLimitConfig } = require("../services/redeemCodeLimitService");
const { normalizePhone, normalizeCountryCode, validateWithdrawalAccountPayload } = require("../services/profileService");

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n.toFixed(6)) : 0;
}

function intValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getLimit(value, fallback = 50, max = 200) {
  const n = Number(value || fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function getOffset(page, limit) {
  const p = Math.max(1, Number(page || 1));
  return (p - 1) * limit;
}

function buildQuestion(row) {
  return {
    id: row.id,
    levelMin: intValue(row.level_min),
    category: row.category,
    asset: row.asset,
    chartType: row.chart_type,
    title: row.title,
    question: row.question,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    correctOption: row.correct_option,
    isActive: row.is_active,
    createdAt: row.created_at,
    responseCount: intValue(row.response_count),
    correctCount: intValue(row.correct_count),
    accuracyPercent: row.response_count ? Number(((Number(row.correct_count || 0) / Number(row.response_count || 1)) * 100).toFixed(2)) : 0,
  };
}

async function getAdminOverview(req, res) {
  const client = await pool.connect();
  try {
    await seedRoyalVipPackages(client);

    const [users, balances, deposits, withdrawals, taskActivity, questions, levels, upgrades] = await Promise.all([
      client.query(`
        WITH clock AS (
          SELECT
            CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' AS lima_now,
            date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') AS today_start
        )
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE is_admin = true)::int AS total_admins,
          COUNT(*) FILTER (WHERE is_banned = true)::int AS banned_users,
          COUNT(*) FILTER (WHERE is_suspicious = true)::int AS suspicious_users,
          COUNT(*) FILTER (
            WHERE created_at >= (SELECT lima_now FROM clock) - INTERVAL '24 hours'
          )::int AS new_users_24h,
          COUNT(*) FILTER (
            WHERE created_at >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          )::int AS new_users_7d,
          COUNT(*) FILTER (
            WHERE created_at >= (SELECT today_start FROM clock) - INTERVAL '1 day'
              AND created_at < (SELECT today_start FROM clock)
          )::int AS new_users_yesterday
        FROM users
      `),
      client.query(`
        SELECT
          COALESCE(SUM(balance_usdt),0) AS total_balance,
          COALESCE(SUM(recharge_balance_usdt),0) AS total_recharge_balance,
          COALESCE(SUM(withdrawable_usdt),0) AS total_withdrawable,
          COALESCE(SUM(earnings_balance_usdt),0) AS total_earnings
        FROM users
      `),
      client.query(`
        WITH clock AS (
          SELECT
            CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' AS lima_now,
            date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima') AS today_start
        ),
        recharge_events AS (
          SELECT d.amount_usdt, d.created_at
          FROM deposits d
          WHERE d.status = 'confirmed'
            AND COALESCE(d.sweep_status, '') NOT IN ('manual', 'hidden_manual')
            AND COALESCE(d.tx_hash, '') NOT LIKE 'manual_admin_recharge_%'
            AND COALESCE(d.token_contract, '') <> 'manual-admin-credit'

          UNION ALL

          SELECT al.amount_usdt, al.created_at
          FROM account_ledger al
          WHERE al.type = 'admin_balance_adjustment'
            AND al.balance_type = 'recharge'
            AND al.direction = 'credit'
            AND COALESCE(al.status, 'completed') = 'completed'
        )
        SELECT
          COUNT(*)::int AS total_deposits,
          COALESCE(SUM(amount_usdt),0) AS total_deposited,
          COUNT(*) FILTER (
            WHERE created_at >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          )::int AS deposits_7d,
          COALESCE(SUM(amount_usdt) FILTER (
            WHERE created_at >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          ),0) AS deposited_7d,
          COUNT(*) FILTER (
            WHERE created_at >= (SELECT today_start FROM clock) - INTERVAL '1 day'
              AND created_at < (SELECT today_start FROM clock)
          )::int AS deposits_yesterday,
          COALESCE(SUM(amount_usdt) FILTER (
            WHERE created_at >= (SELECT today_start FROM clock) - INTERVAL '1 day'
              AND created_at < (SELECT today_start FROM clock)
          ),0) AS deposited_yesterday,
          (
            SELECT COUNT(*)::int
            FROM deposits d
            WHERE d.status = 'confirmed'
              AND COALESCE(d.sweep_status, 'pending') <> 'swept'
              AND COALESCE(d.sweep_status, '') NOT IN ('manual', 'hidden_manual')
              AND COALESCE(d.tx_hash, '') NOT LIKE 'manual_admin_recharge_%'
              AND COALESCE(d.token_contract, '') <> 'manual-admin-credit'
          ) AS pending_collection
        FROM recharge_events
      `),
      client.query(`
        WITH clock AS (
          SELECT CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' AS lima_now
        )
        SELECT
          COUNT(*)::int AS total_withdrawals,
          COUNT(*) FILTER (WHERE status='pending')::int AS pending_withdrawals,
          COUNT(*) FILTER (WHERE status='paid')::int AS paid_withdrawals,
          COALESCE(SUM(amount_requested),0) AS total_requested,
          COALESCE(SUM(amount_to_receive) FILTER (WHERE status='paid'),0) AS total_paid,
          COALESCE(SUM(amount_to_receive) FILTER (
            WHERE status='paid'
              AND COALESCE(paid_at, created_at) >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          ),0) AS paid_7d,
          COUNT(*) FILTER (
            WHERE status='paid'
              AND COALESCE(paid_at, created_at) >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          )::int AS paid_withdrawals_7d,
          COALESCE(SUM(amount_to_receive) FILTER (WHERE status='pending'),0) AS pending_amount
        FROM withdrawals
      `),
      client.query(`
        SELECT
          COUNT(*)::int AS responses_7d,
          COUNT(*) FILTER (WHERE COALESCE(vip_level,0) = 0)::int AS trial_responses_7d,
          COUNT(*) FILTER (WHERE COALESCE(vip_level,0) >= 1)::int AS plan_responses_7d,
          COUNT(DISTINCT user_id) FILTER (WHERE COALESCE(vip_level,0) = 0)::int AS trial_active_users_7d,
          COUNT(DISTINCT user_id) FILTER (WHERE COALESCE(vip_level,0) >= 1)::int AS plan_active_users_7d,
          COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END),0)::int AS correct_responses_7d,
          COALESCE(SUM(reward_usdt),0) AS rewards_7d
        FROM ai_task_responses
        WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      `),
      client.query(`
        SELECT
          COUNT(*)::int AS total_questions,
          COUNT(*) FILTER (WHERE is_active = true)::int AS active_questions
        FROM ai_task_questions
      `),
      client.query(`
        SELECT
          p.level,
          p.name,
          p.price_usdt,
          p.daily_tasks,
          p.task_reward_usdt,
          CASE
            WHEN p.level = 0 THEN (
              SELECT COUNT(*)::int
              FROM users u
              WHERE NOT EXISTS (
                SELECT 1
                FROM vip_purchases vp
                WHERE vp.user_id = u.id
                  AND vp.status='active'
                  AND vp.expires_at > NOW()
                  AND vp.level >= 1
              )
            )
            ELSE COUNT(DISTINCT v.user_id)::int
          END AS active_users
        FROM vip_packages p
        LEFT JOIN vip_purchases v
          ON v.level = p.level
         AND v.status='active'
         AND v.expires_at > NOW()
        GROUP BY p.level, p.name, p.price_usdt, p.daily_tasks, p.task_reward_usdt
        ORDER BY p.level ASC
      `),
      client.query(`
        WITH clock AS (
          SELECT CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima' AS lima_now
        ),
        ordered_purchases AS (
          SELECT
            vp.id,
            vp.user_id,
            vp.level,
            vp.purchased_at,
            LAG(vp.level) OVER (
              PARTITION BY vp.user_id
              ORDER BY vp.purchased_at ASC, vp.id ASC
            ) AS previous_level
          FROM vip_purchases vp
          WHERE vp.level >= 1
            AND vp.status IN ('active','expired','completed','cancelled','replaced')
        ),
        upgrade_events AS (
          SELECT *
          FROM ordered_purchases
          WHERE previous_level IS NOT NULL
            AND level > previous_level
        )
        SELECT
          COUNT(*)::int AS total_upgrade_events,
          COUNT(DISTINCT user_id)::int AS total_upgrade_users,
          COUNT(*) FILTER (
            WHERE purchased_at >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          )::int AS upgrade_events_7d,
          COUNT(DISTINCT user_id) FILTER (
            WHERE purchased_at >= (SELECT lima_now FROM clock) - INTERVAL '7 days'
          )::int AS upgrade_users_7d
        FROM upgrade_events
      `),
    ]);

    const activityRow = taskActivity.rows[0] || {};
    const responseTotal = intValue(activityRow.responses_7d);
    const activityAccuracy = responseTotal
      ? Number(((intValue(activityRow.correct_responses_7d) / responseTotal) * 100).toFixed(2))
      : 0;

    return res.json({
      stats: {
        users: {
          ...users.rows[0],
          new_users_yesterday: intValue(users.rows[0]?.new_users_yesterday),
        },
        balances: {
          totalBalance: money(balances.rows[0]?.total_balance),
          totalRechargeBalance: money(balances.rows[0]?.total_recharge_balance),
          totalWithdrawable: money(balances.rows[0]?.total_withdrawable),
          totalEarnings: money(balances.rows[0]?.total_earnings),
        },
        deposits: {
          totalDeposits: intValue(deposits.rows[0]?.total_deposits),
          totalDeposited: money(deposits.rows[0]?.total_deposited),
          deposits7d: intValue(deposits.rows[0]?.deposits_7d),
          deposited7d: money(deposits.rows[0]?.deposited_7d),
          depositsYesterday: intValue(deposits.rows[0]?.deposits_yesterday),
          depositedYesterday: money(deposits.rows[0]?.deposited_yesterday),
          pendingCollection: intValue(deposits.rows[0]?.pending_collection),
        },
        withdrawals: {
          totalWithdrawals: intValue(withdrawals.rows[0]?.total_withdrawals),
          pendingWithdrawals: intValue(withdrawals.rows[0]?.pending_withdrawals),
          paidWithdrawals: intValue(withdrawals.rows[0]?.paid_withdrawals),
          paidWithdrawals7d: intValue(withdrawals.rows[0]?.paid_withdrawals_7d),
          totalRequested: money(withdrawals.rows[0]?.total_requested),
          totalPaid: money(withdrawals.rows[0]?.total_paid),
          paid7d: money(withdrawals.rows[0]?.paid_7d),
          pendingAmount: money(withdrawals.rows[0]?.pending_amount),
        },
        activity: {
          responses7d: responseTotal,
          trialResponses7d: intValue(activityRow.trial_responses_7d),
          planResponses7d: intValue(activityRow.plan_responses_7d),
          trialActiveUsers7d: intValue(activityRow.trial_active_users_7d),
          planActiveUsers7d: intValue(activityRow.plan_active_users_7d),
          rewards7d: money(activityRow.rewards_7d),
          accuracy7d: activityAccuracy,
        },
        tasks: {
          weekResponses: responseTotal,
          weekRewards: money(activityRow.rewards_7d),
          weekAccuracy: activityAccuracy,
          totalQuestions: intValue(questions.rows[0]?.total_questions),
          activeQuestions: intValue(questions.rows[0]?.active_questions),
        },
        upgrades: {
          totalUpgradeEvents: intValue(upgrades.rows[0]?.total_upgrade_events),
          totalUpgradeUsers: intValue(upgrades.rows[0]?.total_upgrade_users),
          upgradeEvents7d: intValue(upgrades.rows[0]?.upgrade_events_7d),
          upgradeUsers7d: intValue(upgrades.rows[0]?.upgrade_users_7d),
        },
      },
      levels: levels.rows.map((row) => ({
        level: row.level,
        name: row.name,
        priceUsdt: money(row.price_usdt),
        dailyTasks: intValue(row.daily_tasks),
        taskRewardUsdt: money(row.task_reward_usdt),
        activeUsers: intValue(row.active_users),
      })),
      generatedAt: new Date().toISOString(),
      timezone: 'GMT-5',
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);
    return res.status(500).json({ message: "Error al cargar panel admin.", detail: error.message });
  } finally {
    client.release();
  }
}

async function listAdminUsers(req, res) {
  try {
    const limit = getLimit(req.query.limit, 20, 100);
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = getOffset(page, limit);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all");
    const levelRaw = req.query.level;
    const level = levelRaw === undefined || levelRaw === "" ? null : Number(levelRaw);

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const likeParam = `$${params.length}`;
      params.push(search);
      const exactParam = `$${params.length}`;
      where.push(`(
        LOWER(u.email) LIKE ${likeParam}
        OR LOWER(COALESCE(u.referral_code,'')) LIKE ${likeParam}
        OR u.id::text = ${exactParam}
      )`);
    }
    if (status === "admin") where.push(`u.is_admin = true`);
    if (status === "banned") where.push(`u.is_banned = true`);
    if (status === "suspicious") where.push(`u.is_suspicious = true`);
    if (status === "normal") where.push(`u.is_admin = false AND u.is_banned = false AND u.is_suspicious = false`);
    if (level !== null && Number.isFinite(level)) {
      params.push(level);
      where.push(`COALESCE(active_vip.active_level,0) = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const dataParams = [...params, limit, offset];
    const baseSql = `
      FROM users u
      LEFT JOIN LATERAL (
        SELECT vp.level::int AS active_level, vp.purchased_at AS active_plan_purchased_at
        FROM vip_purchases vp
        WHERE vp.user_id = u.id AND vp.status='active' AND vp.expires_at > NOW()
        ORDER BY vp.level DESC, vp.purchased_at DESC
        LIMIT 1
      ) active_vip ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS direct_count
        FROM users invited
        WHERE invited.referred_by_id = u.id
      ) refs ON true
      ${whereSql}
    `;

    const [countResult, usersResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total ${baseSql}`, params),
      pool.query(
        `SELECT
          u.id,u.email,u.created_at,u.withdrawable_usdt,u.is_admin,u.is_banned,u.is_suspicious,
          u.withdraw_enabled,u.full_name,u.register_ip,u.last_login_ip,
          COALESCE(active_vip.active_level,0) AS active_level,
          active_vip.active_plan_purchased_at,
          COALESCE(refs.direct_count,0) AS direct_count
        ${baseSql}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
    ]);

    return res.json({
      users: usersResult.rows.map((row) => ({
        ...row,
        withdrawable_usdt: money(row.withdrawable_usdt),
      })),
      pagination: { page, limit, total: intValue(countResult.rows[0]?.total) },
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    return res.status(500).json({ message: "Error al listar usuarios.", detail: error.message });
  }
}

async function getAdminUserDetail(req, res) {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  try {
    const [user, referrals, withdrawalAccounts, depositWallets, sharedIpUsers, activityCounts] = await Promise.all([
      pool.query(`
        SELECT
          u.id,u.email,u.referral_code,u.referred_by_id,u.created_at,
          u.balance_usdt,u.recharge_balance_usdt,u.withdrawable_usdt,u.earnings_balance_usdt,
          u.is_admin,u.is_banned,u.banned_reason,u.is_suspicious,u.suspicious_reason,
          u.register_ip,u.last_login_ip,u.last_login_at,u.full_name,u.phone_country_iso,
          u.phone_country_name,u.phone_country_code,u.phone_number,
          COALESCE(u.credit_points,50) AS credit_points,
          COALESCE(u.roulette_points,0) AS roulette_points,
          COALESCE(u.withdraw_enabled,false) AS withdraw_enabled,
          u.withdraw_enabled_at,u.withdraw_enabled_note,
          COALESCE(active_vip.active_level,0) AS active_level,
          active_vip.plan_purchased_at,
          active_vip.plan_expires_at
        FROM users u
        LEFT JOIN LATERAL (
          SELECT vp.level::int AS active_level, vp.purchased_at AS plan_purchased_at, vp.expires_at AS plan_expires_at
          FROM vip_purchases vp
          WHERE vp.user_id=u.id AND vp.status='active' AND vp.expires_at>NOW()
          ORDER BY vp.level DESC, vp.purchased_at DESC
          LIMIT 1
        ) active_vip ON true
        WHERE u.id=$1
      `, [userId]),
      pool.query(`
        SELECT
          invited.id,invited.email,invited.created_at,invited.is_banned,invited.is_suspicious,
          COALESCE(plan.level,0) AS active_level,
          plan.purchased_at AS plan_purchased_at
        FROM users invited
        LEFT JOIN LATERAL (
          SELECT vp.level::int AS level, vp.purchased_at
          FROM vip_purchases vp
          WHERE vp.user_id=invited.id
          ORDER BY vp.purchased_at DESC, vp.id DESC
          LIMIT 1
        ) plan ON true
        WHERE invited.referred_by_id=$1
        ORDER BY invited.created_at DESC, invited.id DESC
        LIMIT 200
      `, [userId]),
      pool.query(`SELECT id,network,label,withdrawal_address,is_default,created_at,updated_at FROM user_withdrawal_accounts WHERE user_id=$1 ORDER BY is_default DESC, network ASC`, [userId]),
      pool.query(`
        SELECT id,network,address,public_key,created_at
        FROM wallets
        WHERE user_id=$1
        ORDER BY CASE WHEN network='BEP20-USDT' THEN 1 WHEN network='POLYGON-USDT' THEN 2 ELSE 9 END, network ASC, id ASC
      `, [userId]),
      pool.query(`
        WITH target AS (
          SELECT register_ip,last_login_ip FROM users WHERE id=$1
        )
        SELECT
          other.id,other.email,other.created_at,other.register_ip,other.last_login_ip,
          COALESCE(active_vip.active_level,0) AS active_level,
          CASE
            WHEN other.register_ip IS NOT NULL AND other.register_ip = target.register_ip THEN other.register_ip
            WHEN other.register_ip IS NOT NULL AND other.register_ip = target.last_login_ip THEN other.register_ip
            WHEN other.last_login_ip IS NOT NULL AND other.last_login_ip = target.register_ip THEN other.last_login_ip
            WHEN other.last_login_ip IS NOT NULL AND other.last_login_ip = target.last_login_ip THEN other.last_login_ip
            ELSE NULL
          END AS matching_ip
        FROM users other
        CROSS JOIN target
        LEFT JOIN LATERAL (
          SELECT vp.level::int AS active_level
          FROM vip_purchases vp
          WHERE vp.user_id=other.id AND vp.status='active' AND vp.expires_at>NOW()
          ORDER BY vp.level DESC, vp.purchased_at DESC LIMIT 1
        ) active_vip ON true
        WHERE other.id<>$1
          AND (
            (target.register_ip IS NOT NULL AND (other.register_ip=target.register_ip OR other.last_login_ip=target.register_ip))
            OR (target.last_login_ip IS NOT NULL AND (other.register_ip=target.last_login_ip OR other.last_login_ip=target.last_login_ip))
          )
        ORDER BY other.created_at DESC
        LIMIT 100
      `, [userId]),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM ai_task_responses WHERE user_id=$1) AS tasks,
          (SELECT COUNT(*)::int FROM deposits WHERE user_id=$1) AS deposits,
          (SELECT COUNT(*)::int FROM withdrawals WHERE user_id=$1) AS withdrawals,
          (SELECT COUNT(*)::int FROM account_ledger WHERE user_id=$1) AS ledger
      `, [userId]),
    ]);
    if (!user.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    const row = user.rows[0];
    return res.json({
      user: {
        ...row,
        balance_usdt: money(row.balance_usdt),
        recharge_balance_usdt: money(row.recharge_balance_usdt),
        withdrawable_usdt: money(row.withdrawable_usdt),
        earnings_balance_usdt: money(row.earnings_balance_usdt),
      },
      referrals: referrals.rows,
      withdrawalAccounts: withdrawalAccounts.rows,
      depositWallets: depositWallets.rows,
      sharedIpUsers: sharedIpUsers.rows,
      activityCounts: activityCounts.rows[0] || {},
    });
  } catch (error) {
    console.error("ADMIN USER DETAIL ERROR:", error);
    return res.status(500).json({ message: "Error al cargar detalle de usuario.", detail: error.message });
  }
}

async function getAdminUserActivity(req, res) {
  const userId = Number(req.params.userId);
  const type = String(req.query.type || "ledger").toLowerCase();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = getLimit(req.query.limit, 10, 50);
  const offset = getOffset(page, limit);
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });

  const queries = {
    tasks: {
      count: `SELECT COUNT(*)::int AS total FROM ai_task_responses WHERE user_id=$1`,
      data: `SELECT r.id,q.title,q.category,q.asset,r.selected_option,r.correct_option,r.is_correct,r.reward_usdt,r.completed_at AS created_at FROM ai_task_responses r JOIN ai_task_questions q ON q.id=r.question_id WHERE r.user_id=$1 ORDER BY r.completed_at DESC,r.id DESC LIMIT $2 OFFSET $3`,
    },
    deposits: {
      count: `SELECT COUNT(*)::int AS total FROM deposits WHERE user_id=$1`,
      data: `SELECT id,network,amount_usdt,status,sweep_status,tx_hash,created_at FROM deposits WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
    },
    withdrawals: {
      count: `SELECT COUNT(*)::int AS total FROM withdrawals WHERE user_id=$1`,
      data: `SELECT id,network,amount_requested,amount_to_receive,status,tx_hash,created_at,paid_at FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
    },
    ledger: {
      count: `SELECT COUNT(*)::int AS total FROM account_ledger WHERE user_id=$1`,
      data: `SELECT id,balance_type,direction,type,title,amount_usdt,description,status,created_at FROM account_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
    },
  };
  const selected = queries[type];
  if (!selected) return res.status(400).json({ message: "Tipo de actividad inválido." });
  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query(selected.count, [userId]),
      pool.query(selected.data, [userId, limit, offset]),
    ]);
    return res.json({
      type,
      rows: rowsResult.rows,
      pagination: { page, limit, total: intValue(countResult.rows[0]?.total) },
    });
  } catch (error) {
    console.error("ADMIN USER ACTIVITY ERROR:", error);
    return res.status(500).json({ message: "Error al cargar actividad del usuario.", detail: error.message });
  }
}

async function updateAdminUser(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const { isSuspicious, suspiciousReason, isBanned, bannedReason, isAdmin, withdrawEnabled, withdrawEnabledNote } = req.body || {};
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });

  const client = await pool.connect();
  try {
    await ensureCreditPointsSchema(client);
    await client.query("BEGIN");
    const currentResult = await client.query(
      `SELECT id,email,COALESCE(withdraw_enabled,false) AS withdraw_enabled,referred_by_id FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Usuario no encontrado." });
    }
    const currentUser = currentResult.rows[0];
    const wasWithdrawEnabled = Boolean(currentUser.withdraw_enabled);

    const result = await client.query(`
      UPDATE users SET
        is_suspicious = COALESCE($1, is_suspicious),
        suspicious_reason = CASE WHEN $1 IS NULL THEN suspicious_reason WHEN $1=true THEN NULLIF($2,'') ELSE NULL END,
        suspicious_at = CASE WHEN $1=true THEN NOW() WHEN $1=false THEN NULL ELSE suspicious_at END,
        is_banned = COALESCE($3, is_banned),
        banned_reason = CASE WHEN $3 IS NULL THEN banned_reason WHEN $3=true THEN NULLIF($4,'') ELSE NULL END,
        banned_at = CASE WHEN $3=true THEN NOW() WHEN $3=false THEN NULL ELSE banned_at END,
        banned_by = CASE WHEN $3=true THEN $6 WHEN $3=false THEN NULL ELSE banned_by END,
        is_admin = COALESCE($5, is_admin),
        withdraw_enabled = COALESCE($8, withdraw_enabled),
        withdraw_enabled_at = CASE WHEN $8=true THEN NOW() WHEN $8=false THEN NULL ELSE withdraw_enabled_at END,
        withdraw_enabled_by = CASE WHEN $8=true THEN $6 WHEN $8=false THEN NULL ELSE withdraw_enabled_by END,
        withdraw_enabled_note = CASE WHEN $8 IS NULL THEN withdraw_enabled_note ELSE NULLIF($9,'') END
      WHERE id=$7
      RETURNING id,email,is_admin,is_banned,banned_reason,is_suspicious,suspicious_reason,withdraw_enabled,withdraw_enabled_at,withdraw_enabled_note,COALESCE(credit_points,50) AS credit_points
    `, [isSuspicious, suspiciousReason || null, isBanned, bannedReason || null, isAdmin, adminId, userId, withdrawEnabled, withdrawEnabledNote || null]);

    if (withdrawEnabled === true) {
      await awardCreditPointMilestone(client, userId, 90, "withdraw_enabled", "Admin habilitó retiros del usuario.", { adminId, note: withdrawEnabledNote || "" }, adminId);
      if (!wasWithdrawEnabled && currentUser.referred_by_id) {
        await awardValidatedReferralCreditPoint(client, { sponsorId: currentUser.referred_by_id, invitedUserId: userId, adminId });
      }
    }

    await client.query(
      `INSERT INTO user_security_events(user_id,event_type,reason,created_by,metadata) VALUES ($1,'ADMIN_USER_UPDATE',$2,$3,$4::jsonb)`,
      [userId, "Actualización realizada desde panel admin.", adminId, JSON.stringify({ isSuspicious, isBanned, isAdmin, withdrawEnabled })]
    ).catch(() => {});
    await client.query("COMMIT");
    return res.json({ message: "Usuario actualizado.", user: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ADMIN UPDATE USER ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar usuario.", detail: error.message });
  } finally {
    client.release();
  }
}

async function updateAdminUserProfile(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const fullName = String(req.body?.fullName || "").trim().slice(0, 160);
  const phoneCountryIso = String(req.body?.phoneCountryIso || "").trim().toUpperCase().slice(0, 8);
  const phoneCountryName = String(req.body?.phoneCountryName || "").trim().slice(0, 80);
  const phoneCountryCode = normalizeCountryCode(req.body?.phoneCountryCode);
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (fullName && fullName.length < 3) return res.status(400).json({ message: "El nombre debe tener al menos 3 caracteres." });
  if ((phoneCountryCode || phoneNumber) && (!phoneCountryCode || phoneNumber.length < 6)) {
    return res.status(400).json({ message: "Ingresa un celular válido o deja ambos campos vacíos." });
  }
  try {
    const result = await pool.query(`
      UPDATE users SET full_name=NULLIF($1,''),phone_country_iso=NULLIF($2,''),phone_country_name=NULLIF($3,''),phone_country_code=NULLIF($4,''),phone_number=NULLIF($5,'')
      WHERE id=$6
      RETURNING id,email,full_name,phone_country_iso,phone_country_name,phone_country_code,phone_number
    `, [fullName, phoneCountryIso, phoneCountryName, phoneCountryCode, phoneNumber, userId]);
    if (!result.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    await pool.query(`INSERT INTO user_security_events(user_id,event_type,reason,created_by,metadata) VALUES ($1,'ADMIN_PROFILE_UPDATE','Datos personales editados por administrador.',$2,$3::jsonb)`, [userId, adminId, JSON.stringify({ fullName, phoneCountryIso, phoneCountryCode })]).catch(() => {});
    return res.json({ message: "Datos personales actualizados.", user: result.rows[0] });
  } catch (error) {
    console.error("ADMIN PROFILE UPDATE ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar datos personales.", detail: error.message });
  }
}

async function saveAdminWithdrawalAccount(req, res) {
  const userId = Number(req.params.userId);
  const accountId = Number(req.params.accountId || 0);
  const validation = validateWithdrawalAccountPayload(req.body || {});
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (!validation.ok) return res.status(400).json({ message: validation.message });
  const { network, withdrawalAddress, label, isDefault } = validation.account;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isDefault) await client.query(`UPDATE user_withdrawal_accounts SET is_default=false WHERE user_id=$1`, [userId]);
    let result;
    if (accountId) {
      result = await client.query(`
        UPDATE user_withdrawal_accounts SET network=$1,label=$2,withdrawal_address=$3,is_default=$4,updated_at=NOW()
        WHERE id=$5 AND user_id=$6
        RETURNING id,network,label,withdrawal_address,is_default,created_at,updated_at
      `, [network, label, withdrawalAddress, isDefault, accountId, userId]);
    } else {
      const count = await client.query(`SELECT COUNT(*)::int AS total FROM user_withdrawal_accounts WHERE user_id=$1`, [userId]);
      const shouldDefault = isDefault || Number(count.rows[0]?.total || 0) === 0;
      result = await client.query(`
        INSERT INTO user_withdrawal_accounts(user_id,network,label,withdrawal_address,is_default,updated_at)
        VALUES($1,$2,$3,$4,$5,NOW())
        ON CONFLICT(user_id,network) DO UPDATE SET label=EXCLUDED.label,withdrawal_address=EXCLUDED.withdrawal_address,is_default=EXCLUDED.is_default,updated_at=NOW()
        RETURNING id,network,label,withdrawal_address,is_default,created_at,updated_at
      `, [userId, network, label, withdrawalAddress, shouldDefault]);
    }
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Cuenta de retiro no encontrada." });
    }
    await client.query("COMMIT");
    return res.json({ message: accountId ? "Cuenta de retiro actualizada." : "Cuenta de retiro guardada.", account: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") return res.status(409).json({ message: "Ya existe una cuenta para esa red." });
    console.error("ADMIN WITHDRAW ACCOUNT SAVE ERROR:", error);
    return res.status(500).json({ message: "Error al guardar cuenta de retiro.", detail: error.message });
  } finally { client.release(); }
}

async function deleteAdminWithdrawalAccount(req, res) {
  const userId = Number(req.params.userId);
  const accountId = Number(req.params.accountId);
  if (!userId || !accountId) return res.status(400).json({ message: "Cuenta inválida." });
  try {
    const result = await pool.query(`DELETE FROM user_withdrawal_accounts WHERE id=$1 AND user_id=$2 RETURNING id`, [accountId, userId]);
    if (!result.rows.length) return res.status(404).json({ message: "Cuenta de retiro no encontrada." });
    return res.json({ message: "Cuenta de retiro eliminada." });
  } catch (error) {
    console.error("ADMIN WITHDRAW ACCOUNT DELETE ERROR:", error);
    return res.status(500).json({ message: "Error al eliminar cuenta de retiro.", detail: error.message });
  }
}

async function resetAdminUserPassword(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const newPassword = String(req.body?.newPassword || "");
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (!strong.test(newPassword)) return res.status(400).json({ message: "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula y número." });
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(`UPDATE users SET password_hash=$1,security_password_hash=$1,auth_version=COALESCE(auth_version,0)+1 WHERE id=$2 RETURNING id,email,auth_version`, [passwordHash, userId]);
    if (!result.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    await pool.query(`INSERT INTO user_security_events(user_id,event_type,reason,created_by) VALUES($1,'ADMIN_PASSWORD_RESET','Contraseña cambiada por administrador.',$2)`, [userId, adminId]).catch(() => {});
    return res.json({ message: "Contraseña actualizada y sesiones cerradas." });
  } catch (error) {
    console.error("ADMIN PASSWORD RESET ERROR:", error);
    return res.status(500).json({ message: "Error al cambiar contraseña.", detail: error.message });
  }
}

async function forceLogoutAdminUser(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  try {
    const result = await pool.query(`UPDATE users SET auth_version=COALESCE(auth_version,0)+1 WHERE id=$1 RETURNING id,email,auth_version`, [userId]);
    if (!result.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    await pool.query(`INSERT INTO user_security_events(user_id,event_type,reason,created_by) VALUES($1,'ADMIN_FORCE_LOGOUT','Sesiones cerradas por administrador.',$2)`, [userId, adminId]).catch(() => {});
    return res.json({ message: "Sesiones del usuario cerradas." });
  } catch (error) {
    console.error("ADMIN FORCE LOGOUT ERROR:", error);
    return res.status(500).json({ message: "Error al cerrar sesiones.", detail: error.message });
  }
}

async function adjustAdminUserBalance(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const { balanceType, direction, amountUsdt, reason } = req.body || {};

  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (!["recharge", "withdrawable"].includes(balanceType)) return res.status(400).json({ message: "Selecciona saldo de garantía o retirable." });
  if (!["credit", "debit"].includes(direction)) return res.status(400).json({ message: "Selecciona sumar o descontar." });
  const amount = Number(amountUsdt);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Ingresa un monto mayor a 0." });
  if (amount > 1000000) return res.status(400).json({ message: "Monto demasiado alto." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(`SELECT id,email,balance_usdt,recharge_balance_usdt,withdrawable_usdt,earnings_balance_usdt FROM users WHERE id=$1 FOR UPDATE`, [userId]);
    if (!userResult.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Usuario no encontrado." }); }
    const user = userResult.rows[0];
    const currentRecharge = Number(user.recharge_balance_usdt || 0);
    const currentBalance = Number(user.balance_usdt || 0);
    const currentWithdrawable = Number(user.withdrawable_usdt || 0);
    const currentEarnings = Number(user.earnings_balance_usdt || 0);
    if (direction === "debit" && balanceType === "recharge" && currentRecharge < amount) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Saldo de garantía insuficiente." }); }
    if (direction === "debit" && balanceType === "withdrawable" && currentWithdrawable < amount) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Saldo retirable insuficiente." }); }

    let updateSql;
    let title;
    if (balanceType === "recharge") {
      title = direction === "credit" ? "Garantía manual admin" : "Descuento manual de garantía";
      updateSql = direction === "credit"
        ? `UPDATE users SET balance_usdt=COALESCE(balance_usdt,0)+$1,recharge_balance_usdt=COALESCE(recharge_balance_usdt,0)+$1 WHERE id=$2 RETURNING *`
        : `UPDATE users SET balance_usdt=GREATEST(COALESCE(balance_usdt,0)-$1,0),recharge_balance_usdt=COALESCE(recharge_balance_usdt,0)-$1 WHERE id=$2 RETURNING *`;
    } else {
      title = direction === "credit" ? "Retirable manual admin" : "Descuento manual de retirable";
      updateSql = direction === "credit"
        ? `UPDATE users SET withdrawable_usdt=COALESCE(withdrawable_usdt,0)+$1,earnings_balance_usdt=COALESCE(earnings_balance_usdt,0)+$1 WHERE id=$2 RETURNING *`
        : `UPDATE users SET withdrawable_usdt=COALESCE(withdrawable_usdt,0)-$1,earnings_balance_usdt=GREATEST(COALESCE(earnings_balance_usdt,0)-$1,0) WHERE id=$2 RETURNING *`;
    }
    const updated = await client.query(updateSql, [amount, userId]);
    const ledger = await client.query(`INSERT INTO account_ledger(user_id,balance_type,direction,type,title,amount_usdt,description,reference_type,reference_id,metadata,status) VALUES($1,$2,$3,'admin_balance_adjustment',$4,$5,$6,'admin_user',$7,$8::jsonb,'completed') RETURNING id`, [userId,balanceType,direction,title,amount,reason || "Ajuste manual desde panel administrativo.",adminId,JSON.stringify({ adminId,balanceType,direction,previous:{balance_usdt:currentBalance,recharge_balance_usdt:currentRecharge,withdrawable_usdt:currentWithdrawable,earnings_balance_usdt:currentEarnings} })]);
    await client.query(`INSERT INTO user_security_events(user_id,event_type,reason,created_by,metadata) VALUES($1,'ADMIN_BALANCE_ADJUSTMENT',$2,$3,$4::jsonb)`, [userId,`${title}: ${amount} USDT.`,adminId,JSON.stringify({ balanceType,direction,amount,ledgerId:ledger.rows[0].id })]).catch(() => {});
    await client.query("COMMIT");
    return res.json({ message: "Saldo actualizado correctamente.", user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ADMIN BALANCE ADJUSTMENT ERROR:", error);
    return res.status(500).json({ message: "Error al ajustar saldo.", detail: error.message });
  } finally { client.release(); }
}

async function listAdminTasks(req, res) {
  try {
    const limit = getLimit(req.query.limit, 50, 200);
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = getOffset(page, limit);
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "all");
    const levelRaw = req.query.level;
    const level = levelRaw === undefined || levelRaw === "" ? null : Number(levelRaw);
    const active = String(req.query.active || "all");

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(q.title) LIKE $${params.length} OR LOWER(q.question) LIKE $${params.length} OR LOWER(q.asset) LIKE $${params.length})`);
    }
    if (category !== "all") { params.push(category); where.push(`q.category=$${params.length}`); }
    if (level !== null && Number.isFinite(level)) { params.push(level); where.push(`q.level_min=$${params.length}`); }
    if (active === "true") where.push(`q.is_active=true`);
    if (active === "false") where.push(`q.is_active=false`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const baseSql = `
      FROM ai_task_questions q
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS response_count, COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END),0)::int AS correct_count
        FROM ai_task_responses r WHERE r.question_id=q.id
      ) s ON true
      ${whereSql}
    `;
    const dataParams = [...params, limit, offset];
    const [count, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total ${baseSql}`, params),
      pool.query(
        `SELECT q.*, COALESCE(s.response_count,0) AS response_count, COALESCE(s.correct_count,0) AS correct_count ${baseSql} ORDER BY q.id DESC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
    ]);
    return res.json({ questions: rows.rows.map(buildQuestion), pagination: { page, limit, total: intValue(count.rows[0]?.total) } });
  } catch (error) {
    console.error("ADMIN TASKS ERROR:", error);
    return res.status(500).json({ message: "Error al listar tareas IA.", detail: error.message });
  }
}

async function createAdminTask(req, res) {
  const body = req.body || {};
  const required = ["title", "question", "optionA", "optionB", "optionC", "correctOption"];
  for (const key of required) if (!String(body[key] || "").trim()) return res.status(400).json({ message: `Falta el campo ${key}.` });
  const correct = String(body.correctOption).trim().toUpperCase();
  if (!["A", "B", "C"].includes(correct)) return res.status(400).json({ message: "La respuesta correcta debe ser A, B o C." });
  try {
    const result = await pool.query(
      `
      INSERT INTO ai_task_questions(level_min,category,asset,chart_type,title,question,option_a,option_b,option_c,correct_option,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
      RETURNING *
      `,
      [Number(body.levelMin ?? 1), body.category || "trend", body.asset || "MARKET", body.chartType || null, body.title, body.question, body.optionA, body.optionB, body.optionC, correct]
    );
    return res.status(201).json({ message: "Tarea creada.", question: buildQuestion({ ...result.rows[0], response_count: 0, correct_count: 0 }) });
  } catch (error) {
    console.error("ADMIN CREATE TASK ERROR:", error);
    return res.status(500).json({ message: "Error al crear tarea.", detail: error.message });
  }
}

async function updateAdminTask(req, res) {
  const questionId = Number(req.params.questionId);
  if (!questionId) return res.status(400).json({ message: "Tarea inválida." });
  const body = req.body || {};
  const correct = body.correctOption ? String(body.correctOption).trim().toUpperCase() : null;
  if (correct && !["A", "B", "C"].includes(correct)) return res.status(400).json({ message: "La respuesta correcta debe ser A, B o C." });
  try {
    const result = await pool.query(
      `
      UPDATE ai_task_questions
      SET
        level_min=COALESCE($1,level_min),
        category=COALESCE($2,category),
        asset=COALESCE($3,asset),
        chart_type=COALESCE($4,chart_type),
        title=COALESCE($5,title),
        question=COALESCE($6,question),
        option_a=COALESCE($7,option_a),
        option_b=COALESCE($8,option_b),
        option_c=COALESCE($9,option_c),
        correct_option=COALESCE($10,correct_option),
        is_active=COALESCE($11,is_active)
      WHERE id=$12
      RETURNING *
      `,
      [body.levelMin ?? null, body.category ?? null, body.asset ?? null, body.chartType ?? null, body.title ?? null, body.question ?? null, body.optionA ?? null, body.optionB ?? null, body.optionC ?? null, correct, body.isActive ?? null, questionId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Tarea no encontrada." });
    return res.json({ message: "Tarea actualizada.", question: buildQuestion({ ...result.rows[0], response_count: 0, correct_count: 0 }) });
  } catch (error) {
    console.error("ADMIN UPDATE TASK ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar tarea.", detail: error.message });
  }
}

async function listAdminLevels(req, res) {
  const client = await pool.connect();
  try {
    await seedRoyalVipPackages(client);
    const result = await client.query(`
      SELECT p.*,
        CASE WHEN p.level = 0 THEN (
          SELECT COUNT(*)::int FROM users u
          WHERE NOT EXISTS (
            SELECT 1 FROM vip_purchases vp
            WHERE vp.user_id = u.id AND vp.status='active' AND vp.expires_at > NOW() AND vp.level >= 1
          )
        ) ELSE COUNT(v.id)::int END AS active_users,
        COALESCE(SUM(v.price_usdt),0) AS active_volume
      FROM vip_packages p
      LEFT JOIN vip_purchases v ON v.level=p.level AND v.status='active' AND v.expires_at > NOW()
      GROUP BY p.id
      ORDER BY p.level ASC
    `);
    return res.json({ levels: result.rows.map((row) => ({ ...row, price_usdt: money(row.price_usdt), daily_income_usdt: money(row.daily_income_usdt), task_reward_usdt: money(row.task_reward_usdt), active_volume: money(row.active_volume) })) });
  } catch (error) {
    console.error("ADMIN LEVELS ERROR:", error);
    return res.status(500).json({ message: "Error al cargar niveles.", detail: error.message });
  } finally { client.release(); }
}

async function updateAdminLevel(req, res) {
  const level = Number(req.params.level);
  const body = req.body || {};
  if (!Number.isInteger(level) || level < 0) return res.status(400).json({ message: "Nivel inválido." });
  try {
    const result = await pool.query(
      `
      UPDATE vip_packages
      SET
        name=COALESCE($1,name),
        price_usdt=COALESCE($2,price_usdt),
        task_reward_usdt=COALESCE($3,task_reward_usdt),
        task_cooldown_seconds=COALESCE($4,task_cooldown_seconds),
        task_cooldown_minutes=CASE WHEN $4::int IS NULL THEN task_cooldown_minutes ELSE CEIL($4::numeric/60) END,
        daily_tasks=COALESCE($5,daily_tasks),
        valid_days=COALESCE($6,valid_days),
        is_purchasable=COALESCE($7,is_purchasable),
        daily_income_usdt=COALESCE($8,daily_income_usdt),
        updated_at=NOW()
      WHERE level=$9
      RETURNING *
      `,
      [body.name ?? null, body.priceUsdt ?? null, body.taskRewardUsdt ?? null, body.taskCooldownSeconds ?? null, body.dailyTasks ?? null, body.validDays ?? null, body.isPurchasable ?? null, body.dailyIncomeUsdt ?? null, level]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Nivel no encontrado." });
    return res.json({ message: "Nivel actualizado.", level: result.rows[0] });
  } catch (error) {
    console.error("ADMIN UPDATE LEVEL ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar nivel.", detail: error.message });
  }
}

async function getAdminSecurity(req, res) {
  try {
    const [events, ipGroups, suspicious, banned] = await Promise.all([
      pool.query(`
        SELECT e.*, u.email AS user_email, a.email AS admin_email
        FROM user_security_events e
        LEFT JOIN users u ON u.id=e.user_id
        LEFT JOIN users a ON a.id=e.created_by
        ORDER BY e.created_at DESC LIMIT 80
      `),
      pool.query(`
        SELECT register_ip AS ip_address, COUNT(*)::int AS accounts
        FROM users
        WHERE register_ip IS NOT NULL AND register_ip <> ''
        GROUP BY register_ip
        HAVING COUNT(*) > 1
        ORDER BY accounts DESC, register_ip ASC
        LIMIT 50
      `),
      pool.query(`SELECT id,email,suspicious_reason,suspicious_at,register_ip,last_login_ip FROM users WHERE is_suspicious=true ORDER BY suspicious_at DESC NULLS LAST LIMIT 80`),
      pool.query(`SELECT id,email,banned_reason,banned_at,register_ip,last_login_ip FROM users WHERE is_banned=true ORDER BY banned_at DESC NULLS LAST LIMIT 80`),
    ]);
    return res.json({ events: events.rows, ipGroups: ipGroups.rows, suspiciousUsers: suspicious.rows, bannedUsers: banned.rows });
  } catch (error) {
    console.error("ADMIN SECURITY ERROR:", error);
    return res.status(500).json({ message: "Error al cargar seguridad.", detail: error.message });
  }
}


async function getAdminSecurityIpUsers(req, res) {
  const ip = String(req.query.ip || '').trim();
  if (!ip) return res.status(400).json({ message: "IP inválida." });

  try {
    const result = await pool.query(
      `
      WITH active_levels AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          level,
          status,
          purchased_at,
          expires_at
        FROM vip_purchases
        WHERE status IN ('active','expired','completed')
        ORDER BY user_id, CASE WHEN status='active' THEN 0 ELSE 1 END, level DESC, purchased_at DESC NULLS LAST, id DESC
      )
      SELECT
        u.id,
        u.email,
        u.referral_code,
        u.created_at,
        u.register_ip,
        u.last_login_ip,
        u.last_login_at,
        COALESCE(al.level, 0)::int AS active_level,
        al.status AS plan_status,
        COALESCE(u.recharge_balance_usdt, 0) AS recharge_balance_usdt,
        COALESCE(u.withdrawable_usdt, 0) AS withdrawable_usdt,
        COALESCE(u.credit_points, 50) AS credit_points,
        COALESCE(u.withdraw_enabled, false) AS withdraw_enabled,
        COALESCE(u.is_suspicious, false) AS is_suspicious,
        u.suspicious_reason,
        COALESCE(u.is_banned, false) AS is_banned,
        u.banned_reason,
        CASE
          WHEN u.register_ip = $1 AND u.last_login_ip = $1 THEN 'registro y login'
          WHEN u.register_ip = $1 THEN 'registro'
          WHEN u.last_login_ip = $1 THEN 'login'
          ELSE 'relacionado'
        END AS ip_match
      FROM users u
      LEFT JOIN active_levels al ON al.user_id = u.id
      WHERE u.register_ip = $1 OR u.last_login_ip = $1
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT 120
      `,
      [ip]
    );

    return res.json({ ip, users: result.rows });
  } catch (error) {
    console.error("ADMIN SECURITY IP USERS ERROR:", error);
    return res.status(500).json({ message: "Error al cargar usuarios de la IP.", detail: error.message });
  }
}

function normalizeRedeemCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

async function getAdminRedeemDailyLimitConfig(req, res) {
  try {
    await ensureRedeemCodeLimitSchema();
    const config = await getRedeemDailyLimitConfig(pool);
    return res.json({ config });
  } catch (error) {
    console.error("GET ADMIN REDEEM DAILY LIMIT CONFIG ERROR:", error);
    return res.status(500).json({ message: "Error al cargar límites diarios de códigos.", detail: error.message });
  }
}

async function patchAdminRedeemDailyLimitConfig(req, res) {
  const adminId = req.user.userId;
  const isActive = req.body?.isActive ?? req.body?.is_active;
  const standardDailyLimit = Number(req.body?.standardDailyLimit ?? req.body?.standard_daily_limit);
  const premiumDailyLimit = Number(req.body?.premiumDailyLimit ?? req.body?.premium_daily_limit);
  const premiumFromLevel = Number(req.body?.premiumFromLevel ?? req.body?.premium_from_level);
  const noPlanGuaranteeCapActive = req.body?.noPlanGuaranteeCapActive ?? req.body?.no_plan_guarantee_cap_active;
  const noPlanGuaranteeCapUsdt = Number(req.body?.noPlanGuaranteeCapUsdt ?? req.body?.no_plan_guarantee_cap_usdt);
  const rawNoPlanWithdrawableCapActive = req.body?.noPlanWithdrawableCapActive ?? req.body?.no_plan_withdrawable_cap_active;
  const rawNoPlanWithdrawableCapUsdt = req.body?.noPlanWithdrawableCapUsdt ?? req.body?.no_plan_withdrawable_cap_usdt;
  const noPlanWithdrawableCapActive = rawNoPlanWithdrawableCapActive == null ? true : Boolean(rawNoPlanWithdrawableCapActive);
  const noPlanWithdrawableCapUsdt = Number(rawNoPlanWithdrawableCapUsdt ?? 5);

  if (!Number.isInteger(standardDailyLimit) || standardDailyLimit < 1 || standardDailyLimit > 20) {
    return res.status(400).json({ message: "El límite diario estándar debe estar entre 1 y 20." });
  }

  if (!Number.isInteger(premiumDailyLimit) || premiumDailyLimit < 1 || premiumDailyLimit > 20) {
    return res.status(400).json({ message: "El límite diario premium debe estar entre 1 y 20." });
  }

  if (premiumDailyLimit < standardDailyLimit) {
    return res.status(400).json({ message: "El límite premium no puede ser menor que el límite estándar." });
  }

  if (!Number.isInteger(premiumFromLevel) || premiumFromLevel < 1 || premiumFromLevel > 8) {
    return res.status(400).json({ message: "El nivel premium debe estar entre R1 y R8." });
  }

  if (!Number.isFinite(noPlanGuaranteeCapUsdt) || noPlanGuaranteeCapUsdt <= 0 || noPlanGuaranteeCapUsdt > 100000) {
    return res.status(400).json({ message: "El límite de garantía sin plan debe ser mayor a 0 y no superar 100000 USDT." });
  }

  if (!Number.isFinite(noPlanWithdrawableCapUsdt) || noPlanWithdrawableCapUsdt <= 0 || noPlanWithdrawableCapUsdt > 100000) {
    return res.status(400).json({ message: "El límite retirable sin plan debe ser mayor a 0 y no superar 100000 USDT." });
  }

  const client = await pool.connect();
  try {
    await ensureRedeemCodeLimitSchema();
    await client.query("BEGIN");
    const config = await updateRedeemDailyLimitConfig(client, {
      isActive: Boolean(isActive),
      standardDailyLimit,
      premiumDailyLimit,
      premiumFromLevel,
      noPlanGuaranteeCapActive: Boolean(noPlanGuaranteeCapActive),
      noPlanGuaranteeCapUsdt,
      noPlanWithdrawableCapActive,
      noPlanWithdrawableCapUsdt,
      updatedBy: adminId,
    });
    await client.query("COMMIT");
    return res.json({ message: "Límites diarios actualizados correctamente.", config });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("PATCH ADMIN REDEEM DAILY LIMIT CONFIG ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar límites diarios.", detail: error.message });
  } finally {
    client.release();
  }
}

async function listAdminRedeemCodes(req, res) {
  try {
    const limit = getLimit(req.query.limit, 50, 200);
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = getOffset(page, limit);
    const search = String(req.query.search || "").trim().toUpperCase();

    const params = [];
    const where = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`UPPER(c.code) LIKE $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [count, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM redeem_codes c ${whereSql}`, params),
      pool.query(
        `
        SELECT
          c.id,
          c.code,
          c.balance_type,
          c.amount_usdt,
          c.max_uses,
          c.used_count,
          c.is_active,
          c.expires_at,
          c.note,
          c.created_at,
          u.email AS created_by_email
        FROM redeem_codes c
        LEFT JOIN users u ON u.id = c.created_by
        ${whereSql}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        [...params, limit, offset]
      ),
    ]);

    return res.json({ rows: rows.rows, total: count.rows[0]?.total || 0, page, limit });
  } catch (error) {
    console.error("LIST ADMIN REDEEM CODES ERROR:", error);
    return res.status(500).json({ message: "Error al cargar códigos.", detail: error.message });
  }
}

async function createAdminRedeemCode(req, res) {
  const adminId = req.user.userId;
  const code = normalizeRedeemCode(req.body?.code);
  const balanceType = String(req.body?.balanceType || req.body?.balance_type || "").trim().toLowerCase();
  const amount = Number(req.body?.amountUsdt || req.body?.amount_usdt || 0);
  const maxUses = Math.max(1, Math.floor(Number(req.body?.maxUses || req.body?.max_uses || 1)));
  const note = String(req.body?.note || "").trim().slice(0, 240);
  const expiresAtRaw = String(req.body?.expiresAt || req.body?.expires_at || "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  if (!code || code.length < 4) {
    return res.status(400).json({ message: "El código debe tener mínimo 4 caracteres." });
  }
  if (!["recharge", "withdrawable"].includes(balanceType)) {
    return res.status(400).json({ message: "Selecciona saldo de garantía o saldo retirable." });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Ingresa un monto válido." });
  }
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000) {
    return res.status(400).json({ message: "Ingresa un límite de usos válido." });
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return res.status(400).json({ message: "Fecha de vencimiento inválida." });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO redeem_codes(code,balance_type,amount_usdt,max_uses,note,expires_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [code, balanceType, amount, maxUses, note || null, expiresAt ? expiresAt.toISOString() : null, adminId]
    );

    return res.status(201).json({ message: "Código creado correctamente.", code: result.rows[0] });
  } catch (error) {
    console.error("CREATE ADMIN REDEEM CODE ERROR:", error);
    if (String(error.code) === "23505") {
      return res.status(409).json({ message: "Ese código ya existe." });
    }
    return res.status(500).json({ message: "Error al crear código.", detail: error.message });
  }
}

async function updateAdminRedeemCode(req, res) {
  const codeId = Number(req.params.codeId);
  const { isActive } = req.body || {};
  if (!codeId) return res.status(400).json({ message: "Código inválido." });

  try {
    const result = await pool.query(
      `
      UPDATE redeem_codes
      SET is_active = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [Boolean(isActive), codeId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Código no encontrado." });
    }

    return res.json({ message: Boolean(isActive) ? "Código habilitado." : "Código deshabilitado.", code: result.rows[0] });
  } catch (error) {
    console.error("UPDATE ADMIN REDEEM CODE ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar código.", detail: error.message });
  }
}

async function listAdminRedeemRedemptions(req, res) {
  const codeId = Number(req.params.codeId);
  if (!codeId) return res.status(400).json({ message: "Código inválido." });

  try {
    const result = await pool.query(
      `
      SELECT r.id, r.amount_usdt, r.balance_type, r.created_at, u.email, u.referral_code
      FROM redeem_code_redemptions r
      JOIN users u ON u.id = r.user_id
      WHERE r.code_id = $1
      ORDER BY r.created_at DESC
      LIMIT 80
      `,
      [codeId]
    );
    return res.json({ rows: result.rows });
  } catch (error) {
    console.error("LIST ADMIN REDEEM REDEMPTIONS ERROR:", error);
    return res.status(500).json({ message: "Error al cargar usos del código.", detail: error.message });
  }
}

async function listAdminRoulettePrizes(req, res) {
  const client = await pool.connect();
  try {
    await ensureRouletteSchema(client);
    const result = await client.query(`SELECT * FROM roulette_prizes ORDER BY sort_order ASC, id ASC`);
    return res.json({ prizes: result.rows.map(normalizePrize) });
  } catch (error) {
    console.error("LIST ADMIN ROULETTE PRIZES ERROR:", error);
    return res.status(500).json({ message: "Error al cargar premios de ruleta.", detail: error.message });
  } finally {
    client.release();
  }
}

async function createAdminRoulettePrize(req, res) {
  const body = req.body || {};
  const label = String(body.label || "").trim();
  const prizeType = String(body.prizeType || body.prize_type || "withdrawable").trim();
  const amountUsdt = Number(body.amountUsdt || body.amount_usdt || 0);
  const creditPoints = Number(body.creditPoints || body.credit_points || 0);
  const probabilityWeight = Number(body.probabilityWeight || body.probability_weight || 0);
  const colorKey = String(body.colorKey || body.color_key || "gold").trim();
  const sortOrder = Number(body.sortOrder || body.sort_order || 0);
  const isActive = body.isActive !== false && body.is_active !== false;

  if (!label) return res.status(400).json({ message: "Ingresa nombre del premio." });
  if (!["withdrawable","recharge","credit_points","none"].includes(prizeType)) return res.status(400).json({ message: "Tipo de premio inválido." });
  if (!Number.isFinite(probabilityWeight) || probabilityWeight < 0) return res.status(400).json({ message: "Probabilidad inválida." });
  if (!Number.isFinite(amountUsdt) || amountUsdt < 0) return res.status(400).json({ message: "Monto inválido." });

  const client = await pool.connect();
  try {
    await ensureRouletteSchema(client);
    const result = await client.query(
      `
      INSERT INTO roulette_prizes(label,prize_type,amount_usdt,credit_points,probability_weight,color_key,sort_order,is_active,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *
      `,
      [label, prizeType, amountUsdt, Math.max(0, Math.floor(creditPoints || 0)), probabilityWeight, colorKey || "gold", Number.isFinite(sortOrder) ? sortOrder : 0, isActive]
    );
    return res.status(201).json({ message: "Premio creado.", prize: normalizePrize(result.rows[0]) });
  } catch (error) {
    console.error("CREATE ADMIN ROULETTE PRIZE ERROR:", error);
    return res.status(500).json({ message: "Error al crear premio.", detail: error.message });
  } finally {
    client.release();
  }
}

async function updateAdminRoulettePrize(req, res) {
  const id = Number(req.params.prizeId);
  const body = req.body || {};
  if (!id) return res.status(400).json({ message: "Premio inválido." });

  const client = await pool.connect();
  try {
    await ensureRouletteSchema(client);
    const current = await client.query(`SELECT * FROM roulette_prizes WHERE id=$1`, [id]);
    if (!current.rows.length) return res.status(404).json({ message: "Premio no encontrado." });
    const row = current.rows[0];

    const label = body.label !== undefined ? String(body.label || "").trim() : row.label;
    const prizeType = body.prizeType !== undefined || body.prize_type !== undefined ? String(body.prizeType || body.prize_type || row.prize_type).trim() : row.prize_type;
    const amountUsdt = body.amountUsdt !== undefined || body.amount_usdt !== undefined ? Number(body.amountUsdt ?? body.amount_usdt) : Number(row.amount_usdt || 0);
    const creditPoints = body.creditPoints !== undefined || body.credit_points !== undefined ? Number(body.creditPoints ?? body.credit_points) : Number(row.credit_points || 0);
    const probabilityWeight = body.probabilityWeight !== undefined || body.probability_weight !== undefined ? Number(body.probabilityWeight ?? body.probability_weight) : Number(row.probability_weight || 0);
    const colorKey = body.colorKey !== undefined || body.color_key !== undefined ? String(body.colorKey || body.color_key || "gold").trim() : row.color_key;
    const sortOrder = body.sortOrder !== undefined || body.sort_order !== undefined ? Number(body.sortOrder ?? body.sort_order) : Number(row.sort_order || 0);
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : body.is_active !== undefined ? Boolean(body.is_active) : row.is_active;

    if (!label) return res.status(400).json({ message: "Ingresa nombre del premio." });
    if (!["withdrawable","recharge","credit_points","none"].includes(prizeType)) return res.status(400).json({ message: "Tipo de premio inválido." });
    if (!Number.isFinite(probabilityWeight) || probabilityWeight < 0) return res.status(400).json({ message: "Probabilidad inválida." });
    if (!Number.isFinite(amountUsdt) || amountUsdt < 0) return res.status(400).json({ message: "Monto inválido." });

    const result = await client.query(
      `
      UPDATE roulette_prizes
      SET label=$2, prize_type=$3, amount_usdt=$4, credit_points=$5, probability_weight=$6, color_key=$7, sort_order=$8, is_active=$9, updated_at=NOW()
      WHERE id=$1
      RETURNING *
      `,
      [id, label, prizeType, amountUsdt, Math.max(0, Math.floor(creditPoints || 0)), probabilityWeight, colorKey || "gold", Number.isFinite(sortOrder) ? sortOrder : 0, isActive]
    );

    return res.json({ message: "Premio actualizado.", prize: normalizePrize(result.rows[0]) });
  } catch (error) {
    console.error("UPDATE ADMIN ROULETTE PRIZE ERROR:", error);
    return res.status(500).json({ message: "Error al actualizar premio.", detail: error.message });
  } finally {
    client.release();
  }
}

async function listAdminRouletteSpins(req, res) {
  const client = await pool.connect();
  try {
    await ensureRouletteSchema(client);
    const limit = getLimit(req.query.limit, 50, 200);
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = getOffset(page, limit);
    const [count, result] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS total FROM roulette_spins`),
      client.query(
        `
        SELECT s.*, u.email, u.referral_code
        FROM roulette_spins s
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
    ]);
    return res.json({ spins: result.rows.map(normalizeSpin), pagination: { page, limit, total: intValue(count.rows[0]?.total) } });
  } catch (error) {
    console.error("LIST ADMIN ROULETTE SPINS ERROR:", error);
    return res.status(500).json({ message: "Error al cargar historial de ruleta.", detail: error.message });
  } finally {
    client.release();
  }
}

async function adjustAdminUserRoulettePoints(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const { operation, points, reason } = req.body || {};
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (!["add","subtract","set"].includes(operation)) return res.status(400).json({ message: "Operación inválida." });

  const qty = Math.floor(Number(points || 0));
  if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ message: "Ingresa puntos válidos." });
  if (qty > 100000) return res.status(400).json({ message: "Cantidad demasiado alta." });

  const client = await pool.connect();
  try {
    await ensureRouletteSchema(client);
    await client.query("BEGIN");
    const current = await client.query(`SELECT id,email,COALESCE(roulette_points,0) AS roulette_points FROM users WHERE id=$1 FOR UPDATE`, [userId]);
    if (!current.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const previous = Number(current.rows[0].roulette_points || 0);
    let next = previous;
    if (operation === "add") next = previous + qty;
    if (operation === "subtract") next = Math.max(0, previous - qty);
    if (operation === "set") next = qty;

    const updated = await client.query(
      `UPDATE users SET roulette_points=$1 WHERE id=$2 RETURNING id,email,roulette_points`,
      [next, userId]
    );

    await client.query(
      `INSERT INTO user_security_events(user_id,event_type,reason,created_by,metadata)
       VALUES ($1,'ADMIN_ROULETTE_POINTS',$2,$3,$4::jsonb)`,
      [
        userId,
        reason || "Ajuste manual de puntos de ruleta.",
        adminId,
        JSON.stringify({ operation, points: qty, previous, next }),
      ]
    ).catch(() => {});

    await client.query("COMMIT");
    return res.json({ message: "Puntos de ruleta actualizados.", user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ADJUST ADMIN USER ROULETTE POINTS ERROR:", error);
    return res.status(500).json({ message: "Error al ajustar puntos.", detail: error.message });
  } finally {
    client.release();
  }
}


async function listAdminCreditPointUsers(req, res) {
  try {
    await ensureCreditPointsSchema(pool);
    const limit = getLimit(req.query.limit, 25, 100);
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = getOffset(page, limit);
    const search = String(req.query.search || "").trim();

    const params = [];
    const where = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(u.email) LIKE $${params.length} OR LOWER(u.referral_code) LIKE $${params.length} OR LOWER(COALESCE(u.full_name,'')) LIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const dataParams = [...params, limit, offset];
    const [countResult, usersResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, params),
      pool.query(
        `
        SELECT
          u.id,
          u.email,
          u.referral_code,
          u.full_name,
          u.created_at,
          COALESCE(u.credit_points,50)::int AS credit_points,
          COALESCE(u.withdraw_enabled,false) AS withdraw_enabled,
          COALESCE(u.recharge_balance_usdt,0) AS recharge_balance_usdt,
          COALESCE(u.withdrawable_usdt,0) AS withdrawable_usdt,
          CASE WHEN COALESCE(NULLIF(TRIM(u.full_name),''),'') <> ''
             AND COALESCE(NULLIF(TRIM(u.phone_number),''),'') <> ''
             AND COALESCE(NULLIF(TRIM(u.phone_country_code),''),'') <> '' THEN true ELSE false END AS contact_complete,
          EXISTS (SELECT 1 FROM user_withdrawal_accounts uwa WHERE uwa.user_id = u.id) AS has_withdrawal_account,
          EXISTS (SELECT 1 FROM deposits d WHERE d.user_id = u.id AND d.status='confirmed' AND COALESCE(d.amount_usdt,0) > 0) AS has_deposit,
          (SELECT COUNT(*)::int FROM users invited WHERE invited.referred_by_id = u.id AND COALESCE(invited.withdraw_enabled,false)=true) AS validated_invites
        FROM users u
        ${whereSql}
        ORDER BY u.credit_points DESC, u.created_at DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
        `,
        dataParams
      ),
    ]);

    return res.json({
      users: usersResult.rows,
      pagination: { page, limit, total: intValue(countResult.rows[0]?.total) },
    });
  } catch (error) {
    console.error("ADMIN CREDIT POINT USERS ERROR:", error);
    return res.status(500).json({ message: "Error al listar puntos de crédito.", detail: error.message });
  }
}

async function getAdminCreditPointHistory(req, res) {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ message: "Usuario inválido." });

  try {
    await ensureCreditPointsSchema(pool);
    const [userResult, eventsResult] = await Promise.all([
      pool.query(`SELECT id,email,referral_code,COALESCE(credit_points,50)::int AS credit_points FROM users WHERE id=$1`, [userId]),
      pool.query(
        `
        SELECT e.*, admin.email AS admin_email
        FROM credit_point_events e
        LEFT JOIN users admin ON admin.id = e.created_by
        WHERE e.user_id = $1
        ORDER BY e.created_at DESC
        LIMIT 100
        `,
        [userId]
      ),
    ]);
    if (!userResult.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    return res.json({ user: userResult.rows[0], events: eventsResult.rows });
  } catch (error) {
    console.error("ADMIN CREDIT POINT HISTORY ERROR:", error);
    return res.status(500).json({ message: "Error al cargar historial de puntos.", detail: error.message });
  }
}

async function adjustAdminUserCreditPoints(req, res) {
  const userId = Number(req.params.userId);
  const adminId = req.user.userId;
  const { operation, points, reason } = req.body || {};

  if (!userId) return res.status(400).json({ message: "Usuario inválido." });
  if (!["add", "subtract", "set"].includes(operation)) {
    return res.status(400).json({ message: "Operación inválida." });
  }

  const qty = Math.floor(Number(points || 0));
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ message: "Ingresa puntos válidos." });
  }
  if (qty > 100000) {
    return res.status(400).json({ message: "Cantidad demasiado alta." });
  }
  if (!String(reason || "").trim()) {
    return res.status(400).json({ message: "Ingresa el motivo del ajuste." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await adjustCreditPoints(client, {
      userId,
      operation,
      points: qty,
      reason,
      eventType: "admin_manual_adjustment",
      eventKey: null,
      createdBy: adminId,
      metadata: { adminId, operation, points: qty },
    });
    await client.query(
      `INSERT INTO user_security_events(user_id,event_type,reason,created_by,metadata)
       VALUES ($1,'ADMIN_CREDIT_POINTS',$2,$3,$4::jsonb)`,
      [
        userId,
        `Ajuste puntos de crédito: ${operation} ${qty}.`,
        adminId,
        JSON.stringify({ operation, points: qty, previous: result.previousPoints, next: result.nextPoints }),
      ]
    ).catch(() => {});
    await client.query("COMMIT");
    return res.json({ message: "Puntos de crédito actualizados.", ...result });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ADMIN CREDIT POINT ADJUST ERROR:", error);
    return res.status(500).json({ message: "Error al ajustar puntos de crédito.", detail: error.message });
  } finally {
    client.release();
  }
}


module.exports = {
  getAdminOverview,
  listAdminUsers,
  getAdminUserDetail,
  updateAdminUser,
  adjustAdminUserBalance,
  updateAdminUserProfile,
  saveAdminWithdrawalAccount,
  deleteAdminWithdrawalAccount,
  resetAdminUserPassword,
  forceLogoutAdminUser,
  getAdminUserActivity,
  listAdminTasks,
  createAdminTask,
  updateAdminTask,
  listAdminLevels,
  updateAdminLevel,
  listAdminRoulettePrizes,
  createAdminRoulettePrize,
  updateAdminRoulettePrize,
  listAdminRouletteSpins,
  adjustAdminUserRoulettePoints,
  listAdminCreditPointUsers,
  getAdminCreditPointHistory,
  adjustAdminUserCreditPoints,
  getAdminRedeemDailyLimitConfig,
  patchAdminRedeemDailyLimitConfig,
  listAdminRedeemCodes,
  createAdminRedeemCode,
  updateAdminRedeemCode,
  listAdminRedeemRedemptions,
  getAdminSecurity,
  getAdminSecurityIpUsers,
};
