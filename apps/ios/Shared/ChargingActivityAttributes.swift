import ActivityKit
import Foundation

struct ChargingActivityAttributes: ActivityAttributes, Sendable {
    struct ContentState: Codable, Hashable, Sendable {
        let startedAt: Date
        let updatedAt: Date
        let freshUntil: Date
        let endedAt: Date?
        let batteryPercent: Int?
        let powerKw: Double?
        let addedEnergyKwh: Double?
        let state: String

        var percentText: String { batteryPercent.map { "\($0)%" } ?? "—" }
        var powerText: String { powerKw.map { "\($0.formatted(.number.precision(.fractionLength(1)))) kW" } ?? "—" }
        var statusText: String {
            switch state {
            case "charging": "正在充电"
            case "paused": "暂无充电功率"
            case "ended": "充电已结束"
            case "stale": "数据待刷新"
            default: "等待充电数据"
            }
        }
    }
    let vehicleName: String
    let sessionId: String
}
