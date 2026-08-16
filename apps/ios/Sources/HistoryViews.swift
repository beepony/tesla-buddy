import SwiftUI

private struct VehicleLoader {
    let apiClient: APIClient

    func firstVehicle() async throws -> VehicleOverview? {
        try await apiClient.get("/v1/vehicles", as: [VehicleOverview].self).first
    }
}

private func chineseDateTime(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy年M月d日 HH:mm"
    return formatter.string(from: date)
}

struct DrivesView: View {
    let apiClient: APIClient
    @State private var drives: [Drive] = []
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Group {
                if drives.isEmpty {
                    ContentUnavailableView("暂无行程", systemImage: "road.lanes", description: Text(message ?? "完成一次驾驶后，TeslaMate 会自动记录行程。"))
                } else {
                    List(drives) { drive in
                        NavigationLink {
                            DriveDetailView(drive: drive)
                        } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 9) {
                                    Image(systemName: "circle.fill").font(.caption2).foregroundStyle(.green)
                                    Text(drive.startLocationName).font(.headline)
                                    Image(systemName: "arrow.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                                    Image(systemName: "mappin.circle.fill").font(.subheadline).foregroundStyle(CompanionTheme.accent)
                                    Text(drive.endLocationName).font(.headline)
                                    Spacer(minLength: 0)
                                }
                                Text(chineseDateTime(drive.startedAt))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                HStack(spacing: 0) {
                                    TripMetric(value: drive.energyUsedKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—", label: "本次耗电")
                                    Divider().padding(.horizontal, 12)
                                    TripMetric(value: drive.averageConsumptionWhPerKm.map { "\($0) Wh/km" } ?? "—", label: "平均能耗")
                                    Divider().padding(.horizontal, 12)
                                    TripMetric(value: "\(drive.distanceKm.formatted(.number.precision(.fractionLength(1)))) km", label: "行驶距离")
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
            .navigationTitle("行程")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } } }
        }
        .task { await load() }
    }

    @MainActor private func load() async {
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { message = "尚未发现车辆"; return }
            drives = try await apiClient.get("/v1/vehicles/\(vehicle.id)/drives", as: [Drive].self)
            message = nil
        } catch { message = "无法读取 Mac mini 数据。请确认 iPhone 上的 Tailscale 已连接，然后重试。" }
    }
}

private struct DriveDetailView: View {
    let drive: Drive
    @Environment(\.openURL) private var openURL
    @State private var mapTarget: MapTarget?

    var body: some View {
        List {
            Section {
                HStack(spacing: 0) {
                    TripMetric(value: drive.energyUsedKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—", label: "本次耗电")
                    Divider().padding(.horizontal, 12)
                    TripMetric(value: drive.averageConsumptionWhPerKm.map { "\($0) Wh/km" } ?? "—", label: "平均能耗")
                }
                .padding(.vertical, 8)
            }
            Section("路线") {
                locationButton(title: "出发地", name: drive.startLocationName, icon: "circle.fill", color: .green, location: drive.startLocation)
                locationButton(title: "目的地", name: drive.endLocationName, icon: "mappin.circle.fill", color: CompanionTheme.accent, location: drive.endLocation)
                LabeledContent("出发时间", value: chineseDateTime(drive.startedAt))
                LabeledContent("到达时间", value: chineseDateTime(drive.endedAt))
            }
            Section("本段驾驶") {
                LabeledContent("行驶距离", value: "\(drive.distanceKm.formatted(.number.precision(.fractionLength(1)))) km")
                LabeledContent("用时", value: "\(drive.durationMinutes) 分钟")
                if let energy = drive.energyUsedKwh { LabeledContent("本次耗电", value: "\(energy.formatted(.number.precision(.fractionLength(2)))) kWh") }
                if let consumption = drive.averageConsumptionWhPerKm { LabeledContent("平均能耗", value: "\(consumption) Wh/km") }
            }
            Section("车辆与环境") {
                if let start = drive.startSocPercent, let end = drive.endSocPercent { LabeledContent("电量", value: "\(start)% → \(end)%") }
                if let temperature = drive.outsideTempCelsius { LabeledContent("平均室外温度", value: "\(temperature.formatted(.number.precision(.fractionLength(1)))) ℃") }
                if let temperature = drive.insideTempCelsius { LabeledContent("平均车内温度", value: "\(temperature.formatted(.number.precision(.fractionLength(1)))) ℃") }
                if let speed = drive.maxSpeedKph { LabeledContent("最高速度", value: "\(speed.formatted(.number.precision(.fractionLength(0)))) km/h") }
                if let ascent = drive.ascentMeters { LabeledContent("累计爬升", value: "\(ascent.formatted(.number.precision(.fractionLength(0)))) m") }
            }
        }
        .navigationTitle("行程详情")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("打开地图", isPresented: Binding(get: { mapTarget != nil }, set: { if !$0 { mapTarget = nil } }), titleVisibility: .visible) {
            Button("Apple 地图") { if let mapTarget { openURL(mapTarget.appleMapsURL) } }
            Button("高德地图") { if let mapTarget { openURL(mapTarget.amapURL) } }
        }
    }

    @ViewBuilder private func locationButton(title: String, name: String, icon: String, color: Color, location: DriveLocation?) -> some View {
        if let location {
            Button { mapTarget = MapTarget(name: name, location: location) } label: {
                HStack {
                    Text(title).foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: icon).foregroundStyle(color)
                    Text(name).foregroundStyle(CompanionTheme.accent)
                    Image(systemName: "map").font(.caption).foregroundStyle(.secondary)
                }
            }
        } else {
            LabeledContent(title, value: name)
        }
    }
}

private struct TripMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.subheadline.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MapTarget: Identifiable {
    let id = UUID()
    let name: String
    let location: DriveLocation

    private var coordinate: String { "\(location.latitude),\(location.longitude)" }

    var appleMapsURL: URL {
        var components = URLComponents(string: "https://maps.apple.com/")!
        components.queryItems = [URLQueryItem(name: "ll", value: coordinate), URLQueryItem(name: "q", value: name)]
        return components.url!
    }

    var amapURL: URL {
        var components = URLComponents(string: "https://uri.amap.com/marker")!
        components.queryItems = [
            URLQueryItem(name: "position", value: "\(location.longitude),\(location.latitude)"),
            URLQueryItem(name: "name", value: name),
            URLQueryItem(name: "coordinate", value: "wgs84"),
            URLQueryItem(name: "callnative", value: "1")
        ]
        return components.url!
    }
}

struct ChargesView: View {
    let apiClient: APIClient
    @State private var charges: [Charge] = []
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Group {
                if charges.isEmpty {
                    ContentUnavailableView("暂无充电记录", systemImage: "bolt.car", description: Text(message ?? "完成一次充电后，记录会显示在这里。"))
                } else {
                    List(charges) { charge in
                        NavigationLink {
                            ChargeDetailView(charge: charge)
                        } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Label(charge.locationName, systemImage: charge.chargingType == "dc" ? "bolt.fill" : "powerplug.fill")
                                        .font(.headline)
                                    Spacer()
                                    Text(charge.chargingType == "dc" ? "直流快充" : "交流充电")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(CompanionTheme.accent)
                                }
                                Text(chineseDateTime(charge.startedAt))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                HStack(spacing: 0) {
                                    TripMetric(value: "\(charge.addedEnergyKwh.formatted(.number.precision(.fractionLength(2)))) kWh", label: "充入电量")
                                    Divider().padding(.horizontal, 12)
                                    TripMetric(value: charge.consumedEnergyKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—", label: "消耗电量")
                                    Divider().padding(.horizontal, 12)
                                    TripMetric(value: charge.chargingEfficiencyPercent.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—", label: "充电效率")
                                }
                                HStack(spacing: 0) {
                                    TripMetric(value: charge.maxChargingPowerKw.map { "\($0.formatted(.number.precision(.fractionLength(0)))) kW" } ?? "—", label: "最大功率")
                                    Divider().padding(.horizontal, 12)
                                    TripMetric(value: charge.durationMinutes.map(durationText) ?? "—", label: "充电时长")
                                    Spacer()
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("充电")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } } }
        }
        .task { await load() }
    }

    @MainActor private func load() async {
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { message = "尚未发现车辆"; return }
            charges = try await apiClient.get("/v1/vehicles/\(vehicle.id)/charges", as: [Charge].self)
            message = nil
        } catch { message = "无法读取 Mac mini 数据。请确认 iPhone 上的 Tailscale 已连接，然后重试。" }
    }
}

private struct ChargeDetailView: View {
    let charge: Charge
    @Environment(\.openURL) private var openURL
    @State private var mapTarget: MapTarget?

    var body: some View {
        List {
            Section {
                HStack(spacing: 0) {
                    TripMetric(value: "\(charge.addedEnergyKwh.formatted(.number.precision(.fractionLength(2)))) kWh", label: "充入电量")
                    Divider().padding(.horizontal, 12)
                    TripMetric(value: charge.consumedEnergyKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—", label: "消耗电量")
                    Divider().padding(.horizontal, 12)
                    TripMetric(value: charge.chargingEfficiencyPercent.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—", label: "充电效率")
                }
                .padding(.vertical, 8)
            }
            Section("充电地点") {
                if let location = charge.location {
                    Button { mapTarget = MapTarget(name: charge.locationName, location: location) } label: {
                        HStack {
                            Text("地点").foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "mappin.circle.fill").foregroundStyle(CompanionTheme.accent)
                            Text(charge.locationName).foregroundStyle(CompanionTheme.accent)
                            Image(systemName: "map").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    LabeledContent("地点", value: charge.locationName)
                }
            }
            Section("充电详情") {
                LabeledContent("开始时间", value: chineseDateTime(charge.startedAt))
                LabeledContent("结束时间", value: chineseDateTime(charge.endedAt))
                if let duration = charge.durationMinutes { LabeledContent("充电时长", value: durationText(duration)) }
                if let power = charge.maxChargingPowerKw { LabeledContent("最大功率", value: "\(power.formatted(.number.precision(.fractionLength(0)))) kW") }
                if let start = charge.startSocPercent, let end = charge.endSocPercent { LabeledContent("电量", value: "\(start)% → \(end)%") }
            }
        }
        .navigationTitle("充电详情")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("打开地图", isPresented: Binding(get: { mapTarget != nil }, set: { if !$0 { mapTarget = nil } }), titleVisibility: .visible) {
            Button("Apple 地图") { if let mapTarget { openURL(mapTarget.appleMapsURL) } }
            Button("高德地图") { if let mapTarget { openURL(mapTarget.amapURL) } }
        }
    }
}

private func durationText(_ minutes: Int) -> String {
    (Double(minutes) / 60).formatted(.number.precision(.fractionLength(1))) + " 小时"
}

struct ReportsView: View {
    let apiClient: APIClient
    @State private var report: ReportSummary?
    @State private var message: String?
    @State private var periodKind: ReportPeriodKind = .month
    @State private var anchorDate = Date()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGroupedBackground).ignoresSafeArea()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("报告中心")
                                .font(.title2.weight(.bold))
                            Text("按时间回顾你的真实用车数据")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        ReportFilterCard(periodKind: $periodKind, anchorDate: $anchorDate) {
                            Task { await load() }
                        }

                        ReportPeriodCard(report: report, title: periodTitle)

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("深入查看")
                                    .font(.headline)
                                Spacer()
                                Text("4 项")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                                ForEach(ReportTemplate.all) { template in
                                NavigationLink {
                                    ReportDetailView(template: template, report: report)
                                } label: {
                                    ReportCatalogTile(template: template)
                                }
                                .buttonStyle(.plain)
                                }
                            }
                        }

                        if let message {
                            Label(message, systemImage: "info.circle")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    .safeAreaPadding(.bottom, 104)
                }
            }
            .navigationTitle("报告")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } } }
        }
        .task { await load() }
    }

    private var periodTitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        switch periodKind {
        case .day: formatter.dateFormat = "M月d日"
        case .week: formatter.dateFormat = "M月d日"
        case .month: formatter.dateFormat = "yyyy年M月"
        }
        return periodKind.title + " · " + formatter.string(from: anchorDate)
    }

    @MainActor private func load() async {
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { message = "尚未发现车辆"; return }
            let interval = periodKind.interval(containing: anchorDate)
            let formatter = ISO8601DateFormatter()
            let path = "/v1/reports/summary?vehicleId=\(vehicle.id)&start=\(formatter.string(from: interval.start))&end=\(formatter.string(from: interval.end))"
            report = try await apiClient.get(path, as: ReportSummary.self)
            message = nil
        } catch { message = "报告数据暂时无法解析：\(error.localizedDescription)" }
    }
}

private enum ReportPeriodKind: String, CaseIterable, Identifiable {
    case day, week, month
    var id: String { rawValue }
    var title: String { switch self { case .day: "按日"; case .week: "按周"; case .month: "按月" } }
    func interval(containing date: Date) -> DateInterval {
        let calendar = Calendar.current
        switch self {
        case .day: return calendar.dateInterval(of: .day, for: date)!
        case .week: return calendar.dateInterval(of: .weekOfYear, for: date)!
        case .month: return calendar.dateInterval(of: .month, for: date)!
        }
    }
}

private struct ReportFilterCard: View {
    @Binding var periodKind: ReportPeriodKind
    @Binding var anchorDate: Date
    let reload: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Picker("统计周期", selection: $periodKind) {
                ForEach(ReportPeriodKind.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            HStack {
                Button { move(-1) } label: { Image(systemName: "chevron.left") }
                Spacer()
                DatePicker("选择日期", selection: $anchorDate, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                Spacer()
                Button { move(1) } label: { Image(systemName: "chevron.right") }
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.primary.opacity(0.05)))
        .onChange(of: periodKind) { reload() }
        .onChange(of: anchorDate) { reload() }
    }

    private func move(_ offset: Int) {
        let component: Calendar.Component = periodKind == .day ? .day : (periodKind == .week ? .weekOfYear : .month)
        anchorDate = Calendar.current.date(byAdding: component, value: offset, to: anchorDate) ?? anchorDate
    }
}

private struct ReportPeriodCard: View {
    let report: ReportSummary?
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label(title, systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(report == nil ? "等待同步" : "实时汇总")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(.white.opacity(0.15), in: Capsule())
            }

            if let report, report.metrics.distanceKm > 0 {
                HStack(spacing: 0) {
                    ReportHighlight(value: "\(report.metrics.distanceKm.formatted(.number.precision(.fractionLength(0)))) km", title: "驾驶距离")
                    Divider().overlay(.white.opacity(0.25)).padding(.horizontal, 12)
                    ReportHighlight(value: "\(report.metrics.chargedEnergyKwh.formatted(.number.precision(.fractionLength(1)))) kWh", title: "补能电量")
                    Divider().overlay(.white.opacity(0.25)).padding(.horizontal, 12)
                    ReportHighlight(value: "\(Int(report.metrics.drivingMinutes)) 分", title: "驾驶时间")
                }
            } else {
                Text("首份月度复盘会在记录到行程和充电后自动生成。")
                    .font(.title3.weight(.semibold))
                Text("你无需手动填报；TeslaMate 会在车辆上线、行驶或充电时持续累积数据。")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.76))
            }
        }
        .padding(20)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.36, blue: 0.42), Color(red: 0.08, green: 0.57, blue: 0.65)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
    }
}

private struct ReportHighlight: View {
    let value: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.subheadline.weight(.bold)).lineLimit(1).minimumScaleFactor(0.65)
            Text(title).font(.caption2).foregroundStyle(.white.opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ReportCatalogTile: View {
    let template: ReportTemplate

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: template.icon)
                .font(.title3)
                .foregroundStyle(CompanionTheme.accent)
                .frame(width: 42, height: 42)
                .background(CompanionTheme.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            Text(template.title).font(.subheadline.weight(.semibold)).lineLimit(1)
            Text(template.summary).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 156, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.primary.opacity(0.05)))
        .accessibilityElement(children: .combine)
    }
}

private struct ReportDetailView: View {
    let template: ReportTemplate
    let report: ReportSummary?

    var body: some View {
        List {
            switch template.id {
            case "efficiency":
                reportMetric("平均能耗", report?.metrics.averageConsumptionWhPerKm.map { "\($0) Wh/km" } ?? "暂无数据")
                reportMetric("累计耗电", report?.metrics.energyUsedKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "暂无数据")
                reportMetric("平均室外温度", report?.metrics.averageOutsideTempCelsius.map { "\($0.formatted(.number.precision(.fractionLength(1)))) ℃" } ?? "暂无数据")
            case "battery-health":
                reportMetric("估算可用容量", report?.metrics.estimatedBatteryCapacityKwh.map { "\($0.formatted(.number.precision(.fractionLength(1)))) kWh" } ?? "暂无数据")
                reportMetric("预计最大续航", report?.metrics.estimatedMaxRangeKm.map { "\($0.formatted(.number.precision(.fractionLength(0)))) km" } ?? "暂无数据")
                Section {
                    Text("容量根据 TeslaMate 最近一次有效充电记录的充入电量与电量变化估算，不等同于官方标称容量；随着更多完整充电记录累积，结果会更稳定。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            case "trip-map":
                if let routes = report?.recentRoutes, !routes.isEmpty {
                    Section("最近路线") {
                        ForEach(routes) { route in
                            LabeledContent("\(route.startName) → \(route.endName)", value: "\(route.distanceKm.formatted(.number.precision(.fractionLength(1)))) km")
                        }
                    }
                } else { unavailable }
            case "usage-rhythm":
                reportMetric("近 30 天行程", report?.metrics.tripCount.map { "\($0) 次" } ?? "暂无数据")
                reportMetric("驾驶时长", report.map { "\(Int($0.metrics.drivingMinutes)) 分钟" } ?? "暂无数据")
                reportMetric("驾驶距离", report.map { "\($0.metrics.distanceKm.formatted(.number.precision(.fractionLength(1)))) km" } ?? "暂无数据")
            case "charging-cost", "ownership-cost":
                reportMetric("已记录补能", report.map { "\($0.metrics.chargedEnergyKwh.formatted(.number.precision(.fractionLength(1)))) kWh" } ?? "暂无数据")
                Text("目前尚无充电记录。完成一次充电并由 TeslaMate 结束记录后，费用与电价分析会自动生成。")
                    .font(.footnote).foregroundStyle(.secondary)
            default:
                unavailable
            }
        }
        .navigationTitle(template.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var unavailable: some View {
        ContentUnavailableView {
            Label("数据仍在积累", systemImage: template.icon)
        } description: {
            Text(template.detail)
        }
    }

    @ViewBuilder private func reportMetric(_ title: String, _ value: String) -> some View {
        LabeledContent(title, value: value)
    }
}

private struct ReportTemplate: Identifiable {
    let id: String
    let title: String
    let summary: String
    let detail: String
    let icon: String

    static let all: [ReportTemplate] = [
        .init(id: "efficiency", title: "驾驶效率", summary: "能耗、耗电与温度表现", detail: "积累行程后，将展示 Wh/km、耗电量与温度关联。", icon: "gauge.with.dots.needle.67percent"),
        .init(id: "battery-health", title: "电池健康", summary: "长期观察电池容量与衰减", detail: "积累充电及满电附近的状态后，将估算可用容量和长期趋势。", icon: "heart.text.square.fill"),
        .init(id: "trip-map", title: "出行足迹", summary: "回顾路线与常用目的地", detail: "完成行程后，自动汇总起终点和里程分布。", icon: "map.fill"),
        .init(id: "usage-rhythm", title: "用车节奏", summary: "驾驶时长与出行频率", detail: "从已记录行程中了解日常出行节奏。", icon: "timeline.selection")
    ]
}
