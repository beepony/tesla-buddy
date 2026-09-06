import Foundation

struct APIEnvelope<Value: Decodable>: Decodable {
    let data: Value
}

struct VehicleOverview: Decodable, Identifiable {
    let id: String
    let displayName: String
    let modelName: String?
    let state: String
    let batteryLevelPercent: Int?
    let estimatedRangeKm: Double?
    let estimatedMaxRangeKm: Double?
    let estimatedBatteryCapacityKwh: Double?
    let odometerKm: Double?
    let softwareVersion: String?
    let updateStatus: String?
    let availableSoftwareVersion: String?
    let softwareUpdateReceivedAt: Date?
    let lastUpdatedAt: Date?

    var hasSoftwareUpdate: Bool { updateStatus == "available" }

    var softwareUpdateTitle: String {
        switch updateStatus {
        case "available": return "有更新"
        case "no_update": return "暂无更新"
        default: return "更新状态未知"
        }
    }
}

struct Drive: Decodable, Identifiable {
    let id: String
    let startedAt: Date
    let endedAt: Date
    let distanceKm: Double
    let durationMinutes: Int
    let energyUsedKwh: Double?
    let averageConsumptionWhPerKm: Int?
    let startSocPercent: Int?
    let endSocPercent: Int?
    let outsideTempCelsius: Double?
    let insideTempCelsius: Double?
    let maxSpeedKph: Double?
    let ascentMeters: Double?
    let descentMeters: Double?
    let startAddress: String
    let endAddress: String
    let startLocationName: String
    let endLocationName: String
    let startLocation: DriveLocation?
    let endLocation: DriveLocation?
}

struct DriveLocation: Decodable {
    let latitude: Double
    let longitude: Double
}

struct ParkingSession: Decodable, Identifiable {
    let id: String
    let startedAt: Date
    let endedAt: Date?
    let durationMinutes: Double
    let isActive: Bool
    let locationKey: String
    let locationName: String
    let location: DriveLocation?
}

struct Charge: Decodable, Identifiable {
    let id: String
    let startedAt: Date
    let endedAt: Date
    let addedEnergyKwh: Double
    let chargingType: String
    let locationName: String
    let durationMinutes: Int?
    let maxChargingPowerKw: Double?
    let startSocPercent: Int?
    let endSocPercent: Int?
    let location: DriveLocation?
    let consumedEnergyKwh: Double?
    let chargingEfficiencyPercent: Double?
    let cost: Cost?
}

struct Cost: Decodable {
    let amount: Double
    let currency: String
}

struct ReportSummary: Decodable {
    let period: ReportPeriod
    let metrics: ReportMetrics
    let recentRoutes: [ReportRoute]?
    let insight: String
}

struct ReportPeriod: Decodable {
    let start: Date?
    let end: Date?
}

struct ReportMetrics: Decodable {
    let distanceKm: Double
    let drivingMinutes: Double
    let chargedEnergyKwh: Double
    let chargingCost: Cost?
    let costPer100Km: Double?
    let tripCount: Int?
    let energyUsedKwh: Double?
    let averageConsumptionWhPerKm: Int?
    let averageOutsideTempCelsius: Double?
    let estimatedBatteryCapacityKwh: Double?
    let estimatedMaxRangeKm: Double?
}

struct ReportRoute: Decodable, Identifiable {
    var id: String { "\(startName)-\(endName)-\(distanceKm)" }
    let startName: String
    let endName: String
    let distanceKm: Double
}
