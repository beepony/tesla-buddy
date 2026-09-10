// ActivityKit's iOS 17 interface predates Sendable annotations. All activity
// lifecycle calls are serialized by this main-actor manager.
@preconcurrency import ActivityKit
import SwiftUI

struct CurrentChargingStatus: Decodable {
    let sessionId: String
    let vehicleId: String
    let startedAt: Date
    let endedAt: Date?
    let updatedAt: Date
    let freshUntil: Date
    let state: String
    let batteryPercent: Int?
    let powerKw: Double?
    let addedEnergyKwh: Double?

    var content: ChargingActivityAttributes.ContentState {
        .init(startedAt: startedAt, updatedAt: updatedAt, freshUntil: freshUntil,
              endedAt: endedAt, batteryPercent: batteryPercent, powerKw: powerKw,
              addedEnergyKwh: addedEnergyKwh, state: state)
    }
}

@MainActor
final class ChargingActivityManager: ObservableObject {
    @Published private(set) var status: CurrentChargingStatus?
    @Published private(set) var error: String?
    @Published private(set) var activityError: String?
    @Published private(set) var loading = false
    @Published private(set) var enabled = UserDefaults.standard.bool(forKey: "chargingLiveActivityEnabled")
    private var vehicleName = "Tesla"
    private var refreshing = false

    func refresh(using apiClient: APIClient) async {
        guard !refreshing else { return }
        refreshing = true
        loading = true
        defer { refreshing = false; loading = false }
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else {
                error = "尚未发现车辆"; return
            }
            vehicleName = vehicle.modelName ?? vehicle.displayName
            status = try await apiClient.get("/v1/vehicles/\(vehicle.id)/charging-status", as: CurrentChargingStatus?.self)
            error = nil
            await syncActivity()
        } catch {
            self.error = "充电数据暂未连接，显示的可能是上次读数。"
            // Do not end a real charge on a network error; the content's
            // staleDate makes the island explicitly show its age instead.
        }
    }

    func setEnabled(_ value: Bool) async {
        enabled = value
        UserDefaults.standard.set(value, forKey: "chargingLiveActivityEnabled")
        activityError = nil
        if value {
            UserDefaults.standard.removeObject(forKey: "lastChargingActivitySession")
            await syncActivity()
        } else {
            for activity in Activity<ChargingActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    private func syncActivity() async {
        let activities = Activity<ChargingActivityAttributes>.activities
        guard let status else {
            for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
            return
        }
        let content = ActivityContent(state: status.content, staleDate: status.freshUntil)
        for activity in activities where activity.attributes.sessionId != status.sessionId {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        let existing = activities.first { $0.attributes.sessionId == status.sessionId }
        if status.state == "ended" {
            if let existing {
                await existing.end(ActivityContent(state: status.content, staleDate: nil),
                                   dismissalPolicy: .after(Date().addingTimeInterval(60)))
            }
            return
        }
        guard enabled else { return }
        if let existing {
            await existing.update(content)
        } else if status.state == "charging", status.freshUntil > Date(),
                  UserDefaults.standard.string(forKey: "lastChargingActivitySession") != status.sessionId {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                activityError = "请在系统设置中允许 Tesla Buddy 的实时活动。"
                return
            }
            do {
                _ = try Activity.request(attributes: ChargingActivityAttributes(vehicleName: vehicleName, sessionId: status.sessionId),
                                         content: content, pushType: nil)
                UserDefaults.standard.set(status.sessionId, forKey: "lastChargingActivitySession")
                activityError = nil
            } catch {
                activityError = "无法开启实时活动：\(error.localizedDescription)"
            }
        }
    }
}

struct CurrentChargingCard: View {
    @EnvironmentObject private var charging: ChargingActivityManager

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("当前充电", systemImage: "bolt.circle.fill").font(.headline)
                    Spacer()
                    Text(title(at: timeline.date)).font(.caption.weight(.semibold))
                        .foregroundStyle(CompanionTheme.accent)
                }
                if let status = charging.status, status.endedAt == nil {
                    let stale = status.freshUntil <= timeline.date
                    HStack(alignment: .firstTextBaseline) {
                        Text(status.content.percentText).font(.system(size: 38, weight: .bold, design: .rounded))
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            Text(elapsed(status, at: stale ? status.updatedAt : timeline.date)).font(.title3.bold()).monospacedDigit()
                            Text(stale ? "截至上次采样" : "本次连接时长").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if let percent = status.batteryPercent {
                        ProgressView(value: Double(percent), total: 100).tint(CompanionTheme.accent)
                    }
                    HStack {
                        Text("功率 \(status.content.powerText)")
                        Spacer()
                        Text(status.addedEnergyKwh.map { "已充 \($0.formatted(.number.precision(.fractionLength(1)))) kWh" } ?? "充入电量 —")
                    }.font(.subheadline)
                    Text("采样于 \(sampleDate(status.updatedAt))").font(.caption2).foregroundStyle(.secondary)
                } else {
                    Text(charging.loading ? "正在读取车辆充电状态…" : "当前没有进行中的充电，开始充电后打开 App 即可查看。")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                if let error = charging.error {
                    Divider()
                    Text(error).font(.caption).foregroundStyle(.orange)
                }
            }
            .padding(18)
            .background(.background, in: RoundedRectangle(cornerRadius: 22))
        }
    }

    private func title(at now: Date) -> String {
        if charging.error != nil { return "连接待恢复" }
        guard let status = charging.status, status.endedAt == nil else { return "未在充电" }
        return status.freshUntil <= now ? "数据待刷新" : status.content.statusText
    }
    private func elapsed(_ status: CurrentChargingStatus, at date: Date) -> String {
        let minutes = max(0, Int(date.timeIntervalSince(status.startedAt) / 60))
        return "\(minutes / 60)小时\(minutes % 60)分"
    }
    private func sampleDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年M月d日 HH:mm:ss"
        return formatter.string(from: date)
    }
}
