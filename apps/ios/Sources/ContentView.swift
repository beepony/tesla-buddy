import SwiftUI

enum CompanionTheme {
    static let accent = Color(red: 0.18, green: 0.31, blue: 0.92)
    static let heroStart = Color(red: 0.10, green: 0.16, blue: 0.44)
    static let heroEnd = Color(red: 0.26, green: 0.33, blue: 0.91)
}

struct ContentView: View {
    let apiClient: APIClient

    var body: some View {
        TabView {
            OverviewView(apiClient: apiClient)
                .tabItem { Label("概览", systemImage: "car.fill") }
            DrivesView(apiClient: apiClient)
                .tabItem { Label("行程", systemImage: "road.lanes") }
            ChargesView(apiClient: apiClient)
                .tabItem { Label("充电", systemImage: "bolt.car.fill") }
            ReportsView(apiClient: apiClient)
                .tabItem { Label("报告", systemImage: "chart.line.uptrend.xyaxis") }
        }
        .tint(CompanionTheme.accent)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
    }
}

struct OverviewView: View {
    let apiClient: APIClient
    @State private var vehicle: VehicleOverview?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGroupedBackground).ignoresSafeArea()

                if let vehicle {
                    dashboard(for: vehicle)
                } else {
                    ConnectionStateView(isLoading: isLoading, message: errorMessage) {
                        Task { await loadOverview() }
                    }
                }
            }
            .navigationTitle("Tesla Buddy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await loadOverview() } } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("刷新车辆状态")
                }
            }
        }
        .task { await loadOverview() }
    }

    private func dashboard(for vehicle: VehicleOverview) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("车辆概览").font(.title3.weight(.bold))
                Spacer()
                Text(vehicle.lastUpdatedAt?.formatted(.relative(presentation: .named)) ?? "等待首条快照")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VehicleDashboardCard(vehicle: vehicle)

            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("关键数据", detail: "实时状态")
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 10
                ) {
                    MetricTile(icon: "battery.100percent", title: "电池容量", value: vehicle.estimatedBatteryCapacityKwh.map { "\($0.formatted(.number.precision(.fractionLength(1)))) kWh" } ?? "—", detail: "充电数据估算")
                    MetricTile(icon: "road.lanes", title: "最大续航", value: vehicle.estimatedMaxRangeKm.map { "\($0.formatted(.number.precision(.fractionLength(0)))) km" } ?? "—", detail: "按当前电量外推")
                    MetricTile(icon: "gauge.with.dots.needle.67percent", title: "累计里程", value: vehicle.odometerKm.map { "\($0.formatted(.number.precision(.fractionLength(0)))) km" } ?? "—", detail: "总行驶距离")
                    MetricTile(icon: "cpu", title: "系统版本", value: vehicle.softwareVersion ?? "暂无记录", detail: "车辆软件")
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    @MainActor
    private func loadOverview() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let vehicles = try await apiClient.get("/v1/vehicles", as: [VehicleOverview].self)
            guard let selectedVehicle = vehicles.first else {
                vehicle = nil
                errorMessage = "TeslaMate 尚未返回车辆。请确认 Tesla 账户授权已完成。"
                return
            }
            vehicle = try await apiClient.get("/v1/vehicles/\(selectedVehicle.id)/overview", as: VehicleOverview.self)
            errorMessage = nil
        } catch {
            errorMessage = localConnectionMessage(for: error)
        }
    }

    private func localConnectionMessage(for error: Error) -> String {
        guard let urlError = error as? URLError else { return error.localizedDescription }
        switch urlError.code {
        case .notConnectedToInternet, .cannotFindHost, .cannotConnectToHost, .networkConnectionLost:
            return "无法连接家中的 Mac mini。请确认两台设备在同一 Wi‑Fi；外出时请连接 Tailscale。"
        default:
            return error.localizedDescription
        }
    }
}

private struct ConnectionStateView: View {
    let isLoading: Bool
    let message: String?
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: isLoading ? "arrow.triangle.2.circlepath" : "antenna.radiowaves.left.and.right")
                .font(.system(size: 38, weight: .medium))
                .foregroundStyle(CompanionTheme.accent)
                .frame(width: 80, height: 80)
                .background(CompanionTheme.accent.opacity(0.11), in: Circle())

            VStack(spacing: 7) {
                Text(isLoading ? "正在连接你的车辆数据" : "暂时无法读取车辆")
                    .font(.title3.weight(.bold))
                Text(message ?? "正在通过私有加密通道连接 Mac mini…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if !isLoading {
                Button(action: retry) {
                    Label("重新连接", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(CompanionTheme.accent)
            }

            Label("同一 Wi‑Fi 自动直连，外出时使用 Tailscale", systemImage: "lock.shield")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(28)
        .frame(maxWidth: 360)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }
}

private struct VehicleDashboardCard: View {
    let vehicle: VehicleOverview

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "car.side.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(vehicle.displayName)
                        .font(.headline.weight(.bold))
                    Text(vehicle.modelName ?? "Tesla 车辆")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.74))
                }

                Spacer(minLength: 8)
                VehicleStatePill(state: vehicle.state)
            }

            HStack(alignment: .bottom, spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("预估续航")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.white.opacity(0.74))
                    Text(vehicle.estimatedRangeKm.map { "\($0.formatted(.number.precision(.fractionLength(0)))) km" } ?? "—")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                        .contentTransition(.numericText())
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(vehicle.batteryLevelPercent.map { "\($0)%" } ?? "—")
                        .font(.title2.weight(.bold))
                        .contentTransition(.numericText())
                    Text("当前电量")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.76))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text("车辆状态 · \(stateTitle)")
                .font(.caption.weight(.medium))
                .foregroundStyle(.white.opacity(0.78))
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(.white)
        .background(
            LinearGradient(
                colors: [CompanionTheme.heroStart, CompanionTheme.heroEnd],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
        .shadow(color: CompanionTheme.heroEnd.opacity(0.24), radius: 18, y: 8)
        .accessibilityElement(children: .combine)
    }

    private var stateTitle: String {
        switch vehicle.state.lowercased() {
        case "online", "driving": return "在线"
        case "charging": return "充电中"
        case "asleep": return "休眠"
        default: return "离线"
        }
    }
}

private struct HeroStatistic: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
            Text(value)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct VehicleStatePill: View {
    let state: String

    private var presentation: (title: String, icon: String) {
        switch state.lowercased() {
        case "online", "driving": return ("在线", "checkmark.circle.fill")
        case "charging": return ("充电", "bolt.fill")
        case "asleep": return ("休眠", "moon.fill")
        default: return ("离线", "icloud.slash.fill")
        }
    }

    var body: some View {
        Label(presentation.title, systemImage: presentation.icon)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(.white.opacity(0.16), in: Capsule())
    }
}

private struct SectionTitle: View {
    let title: String
    let detail: String

    init(_ title: String, detail: String) {
        self.title = title
        self.detail = detail
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.headline)
            Spacer()
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct MetricTile: View {
    let icon: String
    let title: String
    let value: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CompanionTheme.accent)
                .frame(width: 24, height: 24)
            Text(value)
                .font(.title3.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.caption.weight(.semibold))
                Text(detail).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        .padding(12)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.primary.opacity(0.05)))
    }
}

private struct OfflineNotice: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "moon.stars.fill")
                .foregroundStyle(CompanionTheme.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text("等待车辆唤醒")
                    .font(.subheadline.weight(.semibold))
                Text("车辆下次上线、充电或行驶后，TeslaMate 会自动同步完整数据。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(CompanionTheme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
