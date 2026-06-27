const { isPrelaunchFinancialActionsBlocked } = require("../services/prelaunchService");

async function blockFinancialActionsDuringPrelaunch(req, res, next) {
  try {
    const blocked = await isPrelaunchFinancialActionsBlocked();
    if (!blocked) return next();
    return res.status(423).json({
      message: "Disponible en el lanzamiento oficial. Mientras tanto, acumula beneficios de fundador.",
      code: "PRELAUNCH_ACTIVE",
    });
  } catch (error) {
    console.error("PRELAUNCH BLOCK CHECK ERROR:", error);
    return next();
  }
}

module.exports = { blockFinancialActionsDuringPrelaunch };
