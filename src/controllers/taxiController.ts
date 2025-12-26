import { Request, Response } from "express";
import { AgentProfile, TaxiClass } from "../models/AgentProfile";
import { TaxiRide } from "../models/TaxiRide";
import { sendToUser } from "../utils/websocket";

const allowedSeatCapacities = [4, 7, 9, 13, 20, 30, 40];
const defaultCurrency = "UZS";

const fareTable: Record<TaxiClass, { base: number; perKm: number }> = {
  standard: { base: 5000, perKm: 2000 },
  comfort: { base: 7000, perKm: 2500 },
  business: { base: 10000, perKm: 3500 },
  limousine: { base: 20000, perKm: 6000 }
};

function parseNumber(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function extractCoords(body: any, prefix: string) {
  const nested = body?.[prefix] || body?.[`${prefix}Location`];
  const lat = parseNumber(nested?.lat ?? body?.[`${prefix}Lat`]);
  const lng = parseNumber(nested?.lng ?? body?.[`${prefix}Lng`]);
  if (lat === undefined || lng === undefined) return undefined;
  return { lat, lng };
}

function estimateFare(distanceKm: number, taxiClass?: TaxiClass) {
  const cls = taxiClass || "standard";
  const pricing = fareTable[cls] || fareTable.standard;
  return Math.max(pricing.base + distanceKm * pricing.perKm, pricing.base);
}

async function notifyNearbyAgents(
  lng: number,
  lat: number,
  radiusKm: number,
  type: string,
  payload: Record<string, unknown>
) {
  const agents = await AgentProfile.find({
    serviceCategory: "taxi",
    taxiStatus: "AVAILABLE",
    taxiLocation: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000
      }
    }
  }).select("user");

  for (const agent of agents) {
    sendToUser(agent.user.toString(), type, payload);
  }
}

function getDailyWindow(dateStr?: string) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const start = new Date(base);
  start.setHours(0, 1, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

export const upsertTaxiProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { vehicleModel, seatCapacity, taxiClass, features, taxiStatus, payoutAccount } = req.body;

    const profile = await AgentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });

    if (seatCapacity !== undefined && !allowedSeatCapacities.includes(Number(seatCapacity))) {
      return res.status(400).json({ message: "Seat capacity not allowed" });
    }

    profile.serviceCategory = "taxi";
    profile.taxi = {
      vehicleModel: vehicleModel ?? profile.taxi?.vehicleModel,
      seatCapacity: seatCapacity ?? profile.taxi?.seatCapacity,
      class: taxiClass ?? profile.taxi?.class,
      features: features ?? profile.taxi?.features ?? []
    };
    if (taxiStatus) profile.taxiStatus = taxiStatus;
    if (payoutAccount) profile.payoutAccount = payoutAccount;

    await profile.save();
    return res.json({ profile });
  } catch (err) {
    console.error("upsertTaxiProfile error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateTaxiLocation = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const coords = extractCoords(req.body, "location");
    if (!coords) return res.status(400).json({ message: "locationLat/locationLng required" });

    const { taxiStatus } = req.body;
    const profile = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!profile) return res.status(404).json({ message: "Taxi profile not found" });

    profile.taxiLocation = { type: "Point", coordinates: [coords.lng, coords.lat] };
    profile.taxiLastSeenAt = new Date();
    if (taxiStatus) profile.taxiStatus = taxiStatus;
    await profile.save();

    return res.json({ profile });
  } catch (err) {
    console.error("updateTaxiLocation error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listNearbyTaxis = async (req: Request, res: Response) => {
  try {
    const lat = parseNumber(req.query.lat);
    const lng = parseNumber(req.query.lng);
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng required" });
    }
    const radiusKm = parseNumber(req.query.radiusKm) ?? 10;
    const limit = Math.min(parseNumber(req.query.limit) ?? 20, 100);
    const seatCount = parseNumber(req.query.seatCount);
    const taxiClass = req.query.taxiClass as TaxiClass | undefined;

    const match: any = {
      serviceCategory: "taxi",
      taxiStatus: "AVAILABLE",
      taxiLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000
        }
      }
    };

    if (seatCount) {
      match["taxi.seatCapacity"] = { $gte: seatCount };
    }
    if (taxiClass) {
      match["taxi.class"] = taxiClass;
    }

    const agents = await AgentProfile.find(match)
      .limit(limit)
      .populate("user", "name username avatarUrl");

    return res.json({ agents, limit, radiusKm });
  } catch (err) {
    console.error("listNearbyTaxis error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const estimateTaxiFare = async (req: Request, res: Response) => {
  try {
    const distanceKm = parseNumber(req.body.distanceKm ?? req.query.distanceKm);
    if (!distanceKm || distanceKm <= 0) {
      return res.status(400).json({ message: "distanceKm required" });
    }
    const taxiClass = (req.body.taxiClass ?? req.query.taxiClass) as TaxiClass | undefined;
    const estimatedFare = estimateFare(distanceKm, taxiClass);
    return res.json({ estimatedFare, currency: defaultCurrency, distanceKm, taxiClass: taxiClass ?? "standard" });
  } catch (err) {
    console.error("estimateTaxiFare error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createTaxiRideRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const pickup = extractCoords(req.body, "pickup");
    if (!pickup) return res.status(400).json({ message: "pickupLat/pickupLng required" });
    const dropoff = extractCoords(req.body, "dropoff");

    const distanceKm = parseNumber(req.body.distanceKm);
    const taxiClass = req.body.taxiClass as TaxiClass | undefined;
    const seatCount = parseNumber(req.body.seatCount);
    const offeredFare = parseNumber(req.body.offeredFare);
    const searchRadiusKm = parseNumber(req.body.searchRadiusKm);
    const estimatedFare = distanceKm ? estimateFare(distanceKm, taxiClass) : undefined;

    const ride = await TaxiRide.create({
      rider: req.user._id,
      pickupLocation: { type: "Point", coordinates: [pickup.lng, pickup.lat] },
      dropoffLocation: dropoff ? { type: "Point", coordinates: [dropoff.lng, dropoff.lat] } : undefined,
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      distanceKm,
      estimatedFare,
      offeredFare,
      currency: req.body.currency || defaultCurrency,
      seatCount,
      taxiClass,
      searchRadiusKm: searchRadiusKm ?? 50
    });

    await notifyNearbyAgents(pickup.lng, pickup.lat, ride.searchRadiusKm ?? 50, "ride_requested", {
      rideId: ride._id,
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      seatCount: ride.seatCount,
      taxiClass: ride.taxiClass,
      offeredFare: ride.offeredFare,
      estimatedFare: ride.estimatedFare,
      currency: ride.currency
    });

    return res.status(201).json({ ride });
  } catch (err) {
    console.error("createTaxiRideRequest error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listNearbyRideRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });

    let lat = parseNumber(req.query.lat);
    let lng = parseNumber(req.query.lng);
    if ((lat === undefined || lng === undefined) && agent.taxiLocation?.coordinates?.length === 2) {
      lng = agent.taxiLocation.coordinates[0];
      lat = agent.taxiLocation.coordinates[1];
    }
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng required" });
    }

    const radiusKm = parseNumber(req.query.radiusKm) ?? 50;
    const limit = Math.min(parseNumber(req.query.limit) ?? 20, 100);

    const match: any = {
      status: "SEARCHING",
      pickupLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000
        }
      }
    };

    const andFilters: any[] = [];
    if (agent.taxi?.seatCapacity) {
      andFilters.push({
        $or: [{ seatCount: { $exists: false } }, { seatCount: { $lte: agent.taxi.seatCapacity } }]
      });
    }
    if (agent.taxi?.class) {
      andFilters.push({
        $or: [{ taxiClass: { $exists: false } }, { taxiClass: agent.taxi.class }]
      });
    }
    if (andFilters.length) {
      match.$and = andFilters;
    }

    const rides = await TaxiRide.find(match).limit(limit).populate("rider", "name username avatarUrl");
    return res.json({ rides, limit, radiusKm });
  } catch (err) {
    console.error("listNearbyRideRequests error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const acceptTaxiRide = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });

    const ride = await TaxiRide.findOneAndUpdate(
      { _id: req.params.id, status: "SEARCHING", $or: [{ agent: { $exists: false } }, { agent: null }] },
      { $set: { agent: agent._id, status: "ASSIGNED", acceptedAt: new Date() } },
      { new: true }
    );
    if (!ride) return res.status(409).json({ message: "Ride already assigned" });

    sendToUser(ride.rider.toString(), "ride_assigned", { rideId: ride._id, agentId: ride.agent });
    sendToUser(agent.user.toString(), "ride_assigned", { rideId: ride._id, agentId: ride.agent });
    await notifyNearbyAgents(
      ride.pickupLocation.coordinates[0],
      ride.pickupLocation.coordinates[1],
      ride.searchRadiusKm ?? 50,
      "ride_taken",
      { rideId: ride._id }
    );
    return res.json({ ride });
  } catch (err) {
    console.error("acceptTaxiRide error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const confirmTaxiRide = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const ride = await TaxiRide.findOne({ _id: req.params.id, rider: req.user._id });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "ASSIGNED") {
      return res.status(400).json({ message: "Ride not ready to confirm" });
    }

    ride.status = "CONFIRMED";
    ride.confirmedAt = new Date();
    await ride.save();

    if (ride.agent) {
      await AgentProfile.findByIdAndUpdate(ride.agent, { taxiStatus: "BUSY" });
      const agentProfile = await AgentProfile.findById(ride.agent).select("user");
      if (agentProfile) {
        sendToUser(agentProfile.user.toString(), "ride_confirmed", { rideId: ride._id });
      }
    }

    sendToUser(ride.rider.toString(), "ride_confirmed", { rideId: ride._id });
    return res.json({ ride });
  } catch (err) {
    console.error("confirmTaxiRide error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const completeTaxiRide = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });

    const ride = await TaxiRide.findOne({ _id: req.params.id, agent: agent._id });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (!["CONFIRMED", "IN_PROGRESS"].includes(ride.status)) {
      return res.status(400).json({ message: "Ride not in progress" });
    }

    const finalFare = parseNumber(req.body.finalFare) ?? ride.offeredFare ?? ride.estimatedFare ?? 0;
    const feeRate = ride.platformFeeRate ?? 0.001;
    const platformFeeAmount = Math.max(finalFare * feeRate, 0);
    const payoutAmount = Math.max(finalFare - platformFeeAmount, 0);

    ride.status = "COMPLETED";
    ride.completedAt = new Date();
    ride.finalFare = finalFare;
    ride.platformFeeAmount = platformFeeAmount;
    ride.payoutAmount = payoutAmount;
    await ride.save();

    await AgentProfile.findByIdAndUpdate(agent._id, { taxiStatus: "AVAILABLE" });

    sendToUser(ride.rider.toString(), "ride_completed", {
      rideId: ride._id,
      finalFare,
      platformFeeAmount,
      payoutAmount
    });
    sendToUser(agent.user.toString(), "ride_completed", {
      rideId: ride._id,
      finalFare,
      platformFeeAmount,
      payoutAmount
    });

    return res.json({ ride });
  } catch (err) {
    console.error("completeTaxiRide error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myTaxiRideRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const rides = await TaxiRide.find({ rider: req.user._id }).sort({ createdAt: -1 });
    return res.json({ rides });
  } catch (err) {
    console.error("myTaxiRideRequests error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const agentTaxiRides = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });
    const rides = await TaxiRide.find({ agent: agent._id }).sort({ createdAt: -1 });
    return res.json({ rides });
  } catch (err) {
    console.error("agentTaxiRides error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const taxiDailyEarnings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });

    const { start, end } = getDailyWindow(req.query.date as string | undefined);
    const rides = await TaxiRide.find({
      agent: agent._id,
      status: "COMPLETED",
      completedAt: { $gte: start, $lt: end }
    });

    const gross = rides.reduce((sum, ride) => sum + (ride.finalFare ?? 0), 0);
    const fee = rides.reduce((sum, ride) => sum + (ride.platformFeeAmount ?? 0), 0);
    const payout = rides.reduce((sum, ride) => sum + (ride.payoutAmount ?? 0), 0);

    return res.json({
      date: req.query.date ?? "today",
      window: { start, end },
      gross,
      platformFee: fee,
      payout,
      currency: defaultCurrency
    });
  } catch (err) {
    console.error("taxiDailyEarnings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const taxiLiveBalance = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const agent = await AgentProfile.findOne({ user: req.user._id, serviceCategory: "taxi" });
    if (!agent) return res.status(404).json({ message: "Taxi profile not found" });

    const { start, end } = getDailyWindow();
    const rides = await TaxiRide.find({
      agent: agent._id,
      status: "COMPLETED",
      completedAt: { $gte: start, $lt: end }
    });

    const payout = rides.reduce((sum, ride) => sum + (ride.payoutAmount ?? 0), 0);
    return res.json({ balance: payout, currency: defaultCurrency, window: { start, end } });
  } catch (err) {
    console.error("taxiLiveBalance error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
