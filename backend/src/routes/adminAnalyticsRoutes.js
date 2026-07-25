const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const {
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
  getAdminSecurity,
  getAdminSecurityIpUsers,
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
} = require("../controllers/adminAnalyticsController");

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/overview", getAdminOverview);
router.get("/users", listAdminUsers);
router.get("/users/:userId", getAdminUserDetail);
router.patch("/users/:userId", updateAdminUser);
router.patch("/users/:userId/profile", updateAdminUserProfile);
router.get("/users/:userId/activity", getAdminUserActivity);
router.post("/users/:userId/withdrawal-accounts", saveAdminWithdrawalAccount);
router.patch("/users/:userId/withdrawal-accounts/:accountId", saveAdminWithdrawalAccount);
router.delete("/users/:userId/withdrawal-accounts/:accountId", deleteAdminWithdrawalAccount);
router.post("/users/:userId/reset-password", resetAdminUserPassword);
router.post("/users/:userId/force-logout", forceLogoutAdminUser);
router.post("/users/:userId/balance", adjustAdminUserBalance);
router.post("/users/:userId/roulette-points", adjustAdminUserRoulettePoints);
router.get("/credit-points/users", listAdminCreditPointUsers);
router.get("/users/:userId/credit-points/history", getAdminCreditPointHistory);
router.post("/users/:userId/credit-points", adjustAdminUserCreditPoints);
router.get("/tasks", listAdminTasks);
router.post("/tasks", createAdminTask);
router.patch("/tasks/:questionId", updateAdminTask);
router.get("/levels", listAdminLevels);
router.patch("/levels/:level", updateAdminLevel);
router.get("/security", getAdminSecurity);
router.get("/security/ip-users", getAdminSecurityIpUsers);
router.get("/roulette/prizes", listAdminRoulettePrizes);
router.post("/roulette/prizes", createAdminRoulettePrize);
router.patch("/roulette/prizes/:prizeId", updateAdminRoulettePrize);
router.get("/roulette/spins", listAdminRouletteSpins);
router.get("/redeem-codes/daily-limit-config", getAdminRedeemDailyLimitConfig);
router.patch("/redeem-codes/daily-limit-config", patchAdminRedeemDailyLimitConfig);
router.get("/redeem-codes", listAdminRedeemCodes);
router.post("/redeem-codes", createAdminRedeemCode);
router.patch("/redeem-codes/:codeId", updateAdminRedeemCode);
router.get("/redeem-codes/:codeId/redemptions", listAdminRedeemRedemptions);

module.exports = router;
