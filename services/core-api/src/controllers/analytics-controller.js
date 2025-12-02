// services/core-api/src/controllers/analytics-controller.js

import {
  getTopPropertiesByRevenue,
  getCityRevenueForYear,
  getTopProvidersForMonth,
} from "../services/analytics/revenue-analytics-service.js";

import {
  getPageClickStats,
  getListingClickStats,
  getReviewDistribution,
  getUserTraceForAnalytics,
  getCohortTraceByCity,
} from "../services/analytics/behavior-analytics-service.js";

function parseYear(value) {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }
  return year;
}

function parseMonthString(monthStr) {
  if (!monthStr || typeof monthStr !== "string") return null;
  const [y, m] = monthStr.split("-");
  const year = parseYear(y);
  const month = Number(m);
  if (!year || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

// -------- Revenue analytics --------

export async function getRevenueTopPropertiesController(req, res, next) {
  try {
    const yearParam = req.query.year;
    const limitParam = req.query.limit;
    const year =
      parseYear(yearParam) ?? new Date().getUTCFullYear();

    if (!year) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_year",
        message:
          "Query parameter 'year' must be a valid four-digit year between 2000 and 2100.",
      });
    }

    const items = await getTopPropertiesByRevenue({
      year,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return res.status(200).json({
      success: true,
      year,
      items,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRevenueByCityController(req, res, next) {
  try {
    const yearParam = req.query.year;
    const year =
      parseYear(yearParam) ?? new Date().getUTCFullYear();

    if (!year) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_year",
        message:
          "Query parameter 'year' must be a valid four-digit year between 2000 and 2100.",
      });
    }

    const cities = await getCityRevenueForYear({ year });

    return res.status(200).json({
      success: true,
      year,
      cities,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTopProvidersController(req, res, next) {
  try {
    const monthStr = req.query.month;
    const limitParam = req.query.limit;

    const parsed =
      parseMonthString(monthStr) ?? (() => {
        const now = new Date();
        return {
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
        };
      })();

    if (!parsed) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_month",
        message:
          "Query parameter 'month' must be in YYYY-MM format (e.g., 2025-06).",
      });
    }

    const { year, month } = parsed;

    const providers = await getTopProvidersForMonth({
      year,
      month,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return res.status(200).json({
      success: true,
      year,
      month,
      providers,
    });
  } catch (err) {
    next(err);
  }
}

// -------- Behavior / clickstream & reviews --------

export async function getPageClicksController(req, res, next) {
  try {
    const sinceDays = req.query.sinceDays
      ? Number(req.query.sinceDays)
      : undefined;
    const limit = req.query.limit
      ? Number(req.query.limit)
      : undefined;

    const stats = await getPageClickStats({ sinceDays, limit });

    return res.status(200).json({
      success: true,
      items: stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function getListingClicksController(req, res, next) {
  try {
    const sinceDays = req.query.sinceDays
      ? Number(req.query.sinceDays)
      : undefined;
    const limit = req.query.limit
      ? Number(req.query.limit)
      : undefined;

    const stats = await getListingClickStats({ sinceDays, limit });

    return res.status(200).json({
      success: true,
      items: stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReviewDistributionController(
  req,
  res,
  next
) {
  try {
    const { listingType, listingId } = req.query;

    if (
      !listingType ||
      !["FLIGHT", "HOTEL", "CAR"].includes(listingType)
    ) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_listing_type",
        message:
          "Query parameter 'listingType' must be one of FLIGHT, HOTEL, CAR.",
      });
    }

    if (!listingId) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_listing_id",
        message: "Query parameter 'listingId' is required.",
      });
    }

    const distribution = await getReviewDistribution({
      listingType,
      listingId,
    });

    return res.status(200).json({
      success: true,
      data: distribution,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserTraceAnalyticsController(
  req,
  res,
  next
) {
  try {
    const { userId } = req.params;
    const limitEvents = req.query.limitEvents
      ? Number(req.query.limitEvents)
      : undefined;

    if (!userId) {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_user_id_param",
        message: "Path parameter 'userId' is required.",
      });
    }

    const trace = await getUserTraceForAnalytics(userId, {
      limitEvents,
    });

    return res.status(200).json({
      success: true,
      data: trace,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCohortTraceController(req, res, next) {
  try {
    const { city } = req.query;
    const limitUsers = req.query.limitUsers
      ? Number(req.query.limitUsers)
      : undefined;
    const limitEvents = req.query.limitEvents
      ? Number(req.query.limitEvents)
      : undefined;

    if (!city || typeof city !== "string") {
      return res.status(400).json({
        success: false,
        errorCode: "invalid_city",
        message:
          "Query parameter 'city' is required to compute cohort traces.",
      });
    }

    const trace = await getCohortTraceByCity(city, {
      limitUsers,
      limitEvents,
    });

    return res.status(200).json({
      success: true,
      data: trace,
    });
  } catch (err) {
    next(err);
  }
}
