const express = require("express");
const asyncHandler = require("../../../core/errors/asyncHandler");
const deviceController = require("../controller/device.controller");
const { requireAuth } = require("../../auth/service/auth.guard");

const router = express.Router();

router.get("/my", requireAuth, asyncHandler(deviceController.listMyDevices));

router.get("/info", (req, res) => {
  const ua = req.get("User-Agent") || "";

  const context = {
    clientIp:
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,

    userAgent: ua,
    isMobile: /mobile/i.test(ua),
    isBot: /bot|crawler|spider|crawling/i.test(ua),

    os: /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /windows/i.test(ua)
          ? "Windows"
          : /mac/i.test(ua)
            ? "MacOS"
            : /linux/i.test(ua)
              ? "Linux"
              : "Unknown",

    browser: /chrome/i.test(ua)
      ? "Chrome"
      : /firefox/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua) && !/chrome/i.test(ua)
          ? "Safari"
          : /edge/i.test(ua)
            ? "Edge"
            : "Unknown",

    language: req.get("accept-language") || null,
    protocol: req.protocol,
    host: req.get("host"),
    isSecure: req.secure,
    requestTime: new Date().toISOString(),
  };

  res.status(200).json({
    success: true,
    data: context,
  });
});

module.exports = router;
