const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getVipStatus,
    buyVipPackage,
    cancelActiveVipPackage,
} = require("../controllers/vipController");

const router = express.Router();

router.get("/status", authMiddleware, getVipStatus);
router.post("/buy", authMiddleware, buyVipPackage);
router.post("/cancel", authMiddleware, cancelActiveVipPackage);

module.exports = router;