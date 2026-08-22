import SwiftUI

struct ParkingView: View {
    let apiClient: APIClient
    @State private var sessions: [ParkingSession] = []
    @State private var isLoading = false
    @State private var message: String?
    @AppStorage("teslaBuddy.homeLocationKey") private var homeLocationKey = ""

    var body: some View {
        NavigationStack {
            List {
                if homeLocationKey.isEmpty {
                    Section {
                        Label("点击右上角的房屋按钮设置家庭位置，设置后将自动隐藏在家停车。", systemImage: "info.circle.fill")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("当前停车") {
                    if let currentSession {
                        if isHome(currentSession) {
                            Label("车辆停在家中，本次不计入停车时长", systemImage: "house.fill")
                                .foregroundStyle(.secondary)
                        } else {
                            CurrentParkingCard(session: currentSession)
                        }
                    } else if isLoading {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else {
                        ContentUnavailableView("当前没有停车记录", systemImage: "car.side")
                    }
                }

                Section("最近停车") {
                    if completedSessions.isEmpty {
                        Text("暂无非家庭停车记录")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(completedSessions) { session in
                            ParkingSessionRow(session: session)
                        }
                    }
                }

                if let message {
                    Section {
                        Label(message, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("停车")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    homeLocationMenu
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } }
                }
            }
        }
        .task { await load() }
    }

    private var currentSession: ParkingSession? {
        sessions.first(where: \.isActive)
    }

    private var completedSessions: [ParkingSession] {
        sessions.filter { !$0.isActive && !isHome($0) }
    }

    private var uniqueLocations: [ParkingSession] {
        var seen = Set<String>()
        return sessions.filter { seen.insert($0.locationKey).inserted }
    }

    private func isHome(_ session: ParkingSession) -> Bool {
        !homeLocationKey.isEmpty && session.locationKey == homeLocationKey
    }

    private var homeLocationMenu: some View {
        Menu {
            if uniqueLocations.isEmpty {
                Text("暂无可选地点")
            } else {
                Section("选择家庭位置") {
                    ForEach(uniqueLocations) { session in
                        Button {
                            homeLocationKey = session.locationKey
                        } label: {
                            if isHome(session) {
                                Label(session.locationName, systemImage: "checkmark")
                            } else {
                                Text(session.locationName)
                            }
                        }
                    }
                }
            }
            if !homeLocationKey.isEmpty {
                Button("清除家庭位置", role: .destructive) { homeLocationKey = "" }
            }
        } label: {
            Image(systemName: homeLocationKey.isEmpty ? "house" : "house.fill")
        }
        .accessibilityLabel("设置家庭位置")
    }

    @MainActor private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else {
                message = "尚未发现车辆"
                return
            }
            sessions = try await apiClient.get("/v1/vehicles/\(vehicle.id)/parking-sessions", as: [ParkingSession].self)
            message = nil
        } catch {
            message = "无法读取停车数据。请确认两台设备在同一 Wi-Fi；外出时请连接 Tailscale。"
        }
    }
}

private struct CurrentParkingCard: View {
    let session: ParkingSession

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("已停车")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(parkingDuration(from: session.startedAt, to: context.date))
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundStyle(CompanionTheme.accent)
                    }
                    Spacer()
                    Image(systemName: "timer")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(CompanionTheme.accent)
                        .padding(10)
                        .background(CompanionTheme.accent.opacity(0.1), in: Circle())
                }

                Divider()
                LabeledContent("停车地点", value: session.locationName)
                LabeledContent("开始时间", value: chineseDateTime(session.startedAt))
            }
            .padding(.vertical, 6)
        }
    }
}

private struct ParkingSessionRow: View {
    let session: ParkingSession

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(session.locationName, systemImage: "mappin.circle.fill")
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(parkingDuration(minutes: session.durationMinutes))
                    .font(.headline.weight(.bold))
                    .foregroundStyle(CompanionTheme.accent)
            }
            Text("\(chineseDateTime(session.startedAt)) 至 \(session.endedAt.map(chineseDateTime) ?? "现在")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

private func parkingDuration(from start: Date, to end: Date) -> String {
    parkingDuration(minutes: max(0, end.timeIntervalSince(start) / 60))
}

private func parkingDuration(minutes: Double) -> String {
    let totalMinutes = max(0, Int(minutes.rounded(.down)))
    let days = totalMinutes / 1_440
    let hours = totalMinutes % 1_440 / 60
    let minutes = totalMinutes % 60
    if days > 0 { return "\(days)天 \(hours)小时" }
    if hours > 0 { return "\(hours)小时 \(minutes)分钟" }
    return "\(minutes)分钟"
}

private func chineseDateTime(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy年M月d日 HH:mm"
    return formatter.string(from: date)
}
