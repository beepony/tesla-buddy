import SwiftUI
import MapKit

struct VehicleLoader {
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

private func durationText(_ minutes: Int) -> String {
    if minutes >= 60 {
        let hours = minutes / 60
        let remainder = minutes % 60
        return remainder == 0 ? "\(hours)小时" : "\(hours)小时\(remainder)分"
    }
    return "\(minutes)分钟"
}

private func dayTitle(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "zh_CN")
    formatter.dateFormat = "M月d日 EEEE"
    return formatter.string(from: date)
}

struct DrivesView: View {
    let apiClient: APIClient
    @State private var drives: [Drive] = []
    @State private var message: String?
    @State private var visibleMonth = Date()
    @State private var presentation: DrivePresentation = .calendar
    @State private var didChooseInitialMonth = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                MonthNavigationHeader(visibleMonth: $visibleMonth)
                    .padding(.horizontal, 16)
                    .padding(.top, 10)

                Picker("展示方式", selection: $presentation) {
                    ForEach(DrivePresentation.allCases) { item in
                        Label(item.title, systemImage: item.icon).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                if presentation == .calendar {
                    ScrollView {
                        VStack(spacing: 16) {
                            DrivePeriodSummary(drives: monthDrives, title: monthTitle)
                                .padding(16)
                                .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.primary.opacity(0.05)))

                            MonthCalendarView(month: visibleMonth, eventCount: { drives(on: $0).count }) { date in
                                DailyDrivesView(date: date, drives: drives(on: date), apiClient: apiClient)
                            }

                            if let message {
                                Label(message, systemImage: "exclamationmark.triangle.fill")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                    }
                    .background(Color(uiColor: .systemGroupedBackground))
                } else {
                    VisitedPlacesMap(drives: monthDrives, apiClient: apiClient)
                }
            }
            .navigationTitle("行程")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("刷新", systemImage: "arrow.clockwise") { Task { await load() } } }
        }
        .task { await load() }
    }

    private var monthDrives: [Drive] {
        let interval = historyCalendar.dateInterval(of: .month, for: visibleMonth)!
        return drives.filter { interval.contains($0.startedAt) }
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年M月"
        return formatter.string(from: visibleMonth)
    }

    private func drives(on date: Date) -> [Drive] {
        monthDrives.filter { historyCalendar.isDate($0.startedAt, inSameDayAs: date) }
    }

    @MainActor private func load() async {
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { message = "尚未发现车辆"; return }
            drives = try await apiClient.get("/v1/vehicles/\(vehicle.id)/drives", as: [Drive].self)
            if !didChooseInitialMonth, let latest = drives.first {
                visibleMonth = latest.startedAt
                didChooseInitialMonth = true
            }
            message = nil
        } catch { message = "无法读取 Mac mini 数据。请确认两台设备在同一 Wi‑Fi；外出时请连接 Tailscale。" }
    }
}

private enum DrivePresentation: String, CaseIterable, Identifiable {
    case calendar, map
    var id: String { rawValue }
    var title: String { self == .calendar ? "日历" : "足迹" }
    var icon: String { self == .calendar ? "calendar" : "map.fill" }
}

private var historyCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = Locale(identifier: "zh_CN")
    calendar.firstWeekday = 2
    return calendar
}

private struct MonthNavigationHeader: View {
    @Binding var visibleMonth: Date

    private var title: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年 M月"
        return formatter.string(from: visibleMonth)
    }

    var body: some View {
        HStack {
            Button { moveMonth(-1) } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 36, height: 36)
            }
            Spacer()
            Text(title)
                .font(.headline.weight(.bold))
            Spacer()
            Button { moveMonth(1) } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 36, height: 36)
            }
        }
    }

    private func moveMonth(_ offset: Int) {
        visibleMonth = historyCalendar.date(byAdding: .month, value: offset, to: visibleMonth) ?? visibleMonth
    }
}

private struct MonthCalendarView<Destination: View>: View {
    let month: Date
    let eventCount: (Date) -> Int
    let tint: Color
    let destination: (Date) -> Destination
    private let weekdays = ["一", "二", "三", "四", "五", "六", "日"]

    init(
        month: Date,
        eventCount: @escaping (Date) -> Int,
        tint: Color = CompanionTheme.accent,
        @ViewBuilder destination: @escaping (Date) -> Destination
    ) {
        self.month = month
        self.eventCount = eventCount
        self.tint = tint
        self.destination = destination
    }

    private var days: [Date?] {
        guard let interval = historyCalendar.dateInterval(of: .month, for: month),
              let dayRange = historyCalendar.range(of: .day, in: .month, for: month) else { return [] }
        let weekday = historyCalendar.component(.weekday, from: interval.start)
        let leading = (weekday - historyCalendar.firstWeekday + 7) % 7
        var values = Array<Date?>(repeating: nil, count: leading)
        values.append(contentsOf: dayRange.compactMap { day in
            historyCalendar.date(byAdding: .day, value: day - 1, to: interval.start)
        })
        while values.count % 7 != 0 { values.append(nil) }
        return values
    }

    var body: some View {
        VStack(spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 6) {
                ForEach(weekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }

                ForEach(Array(days.enumerated()), id: \.offset) { _, date in
                    if let date {
                        NavigationLink {
                            destination(date)
                        } label: {
                            CalendarDayCell(date: date, eventCount: eventCount(date), tint: tint)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Color.clear.frame(height: 54)
                    }
                }
            }
        }
        .padding(14)
        .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.primary.opacity(0.05)))
    }
}

private struct CalendarDayCell: View {
    let date: Date
    let eventCount: Int
    var tint: Color = CompanionTheme.accent

    private var isToday: Bool { historyCalendar.isDateInToday(date) }

    var body: some View {
        VStack(spacing: 4) {
            Text("\(historyCalendar.component(.day, from: date))")
                .font(.subheadline.weight(isToday ? .bold : .medium))
                .foregroundStyle(isToday ? .white : .primary)
                .frame(width: 30, height: 30)
                .background(isToday ? Color.red : Color.clear, in: Circle())

            if eventCount > 0 {
                HStack(spacing: 3) {
                    Circle()
                        .fill(tint)
                        .frame(width: 5, height: 5)
                    Text("\(eventCount)")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(tint)
                }
            } else {
                Color.clear.frame(height: 9)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 54)
        .contentShape(Rectangle())
    }
}

private struct DailyDrivesView: View {
    let date: Date
    let drives: [Drive]
    let apiClient: APIClient

    private var title: String { dayTitle(date) }

    var body: some View {
        List {
            Section {
                DrivePeriodSummary(drives: drives, title: title)
            }

            if drives.isEmpty {
                Section {
                    ContentUnavailableView("当天暂无行程", systemImage: "car.side", description: Text("TeslaMate 在这一天没有记录到驾驶行程。"))
                }
            } else {
                Section("行程明细 · \(drives.count) 次") {
                    ForEach(drives) { drive in
                        NavigationLink {
                            DriveDetailView(drive: drive, apiClient: apiClient)
                        } label: {
                            DriveRow(drive: drive)
                        }
                    }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DrivePeriodSummary: View {
    let drives: [Drive]
    let title: String

    private var distance: Double { drives.reduce(0) { $0 + $1.distanceKm } }
    private var minutes: Int { drives.reduce(0) { $0 + $1.durationMinutes } }
    private var energy: Double { drives.reduce(0) { $0 + ($1.energyUsedKwh ?? 0) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label(title, systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(drives.count) 次行程")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 0) {
                SummaryMetric(value: "\(distance.formatted(.number.precision(.fractionLength(1)))) km", label: "行驶距离")
                Divider().padding(.horizontal, 10)
                SummaryMetric(value: durationText(minutes), label: "驾驶时间")
                Divider().padding(.horizontal, 10)
                SummaryMetric(value: "\(energy.formatted(.number.precision(.fractionLength(2)))) kWh", label: "累计耗电")
            }
        }
        .padding(.vertical, 6)
    }
}

private struct DriveRow: View {
    let drive: Drive

    var body: some View {
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
                SummaryMetric(value: drive.energyUsedKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—", label: "本次耗电")
                Divider().padding(.horizontal, 12)
                SummaryMetric(value: drive.averageConsumptionWhPerKm.map { "\($0) Wh/km" } ?? "—", label: "平均能耗")
                Divider().padding(.horizontal, 12)
                SummaryMetric(value: "\(drive.distanceKm.formatted(.number.precision(.fractionLength(1)))) km", label: "行驶距离")
            }
        }
        .padding(.vertical, 6)
    }
}

private struct VisitedPlace: Identifiable {
    let id: String
    let name: String
    let coordinate: CLLocationCoordinate2D
    let drives: [Drive]
}

private struct VisitedPlacesMap: View {
    let drives: [Drive]
    let apiClient: APIClient
    @State private var position: MapCameraPosition = .automatic
    @State private var selectedPlaceID: String?
    @State private var selectedPlace: VisitedPlace?

    private var places: [VisitedPlace] {
        let located = drives.compactMap { drive -> (String, DriveLocation, Drive)? in
            guard let location = drive.endLocation else { return nil }
            let latitude = Int((location.latitude * 10_000).rounded())
            let longitude = Int((location.longitude * 10_000).rounded())
            return ("\(drive.endLocationName)|\(latitude)|\(longitude)", location, drive)
        }
        let groups = Dictionary(grouping: located, by: \.0)
        return groups.map { key, values in
            let location = values[0].1
            return VisitedPlace(
                id: key,
                name: values[0].2.endLocationName,
                coordinate: CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude),
                drives: values.map(\.2).sorted { $0.startedAt > $1.startedAt }
            )
        }
    }

    var body: some View {
        if places.isEmpty {
            ContentUnavailableView("这一周期暂无足迹", systemImage: "map", description: Text("切换日期或时间范围查看去过的地点。"))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Map(position: $position, selection: $selectedPlaceID) {
                ForEach(places) { place in
                    Marker(place.name, coordinate: place.coordinate)
                        .tint(CompanionTheme.accent)
                        .tag(place.id)
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .overlay(alignment: .topLeading) {
                Label("已点亮 \(places.count) 个地点", systemImage: "sparkles")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 11)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
                    .padding(12)
            }
            .onChange(of: selectedPlaceID) {
                guard let selectedPlaceID else { return }
                selectedPlace = places.first { $0.id == selectedPlaceID }
            }
            .onChange(of: drives.map(\.id)) {
                position = .automatic
            }
            .sheet(item: $selectedPlace, onDismiss: { selectedPlaceID = nil }) { place in
                VisitedPlaceTripsView(place: place, apiClient: apiClient)
            }
        }
    }
}

private struct VisitedPlaceTripsView: View {
    let place: VisitedPlace
    let apiClient: APIClient
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(place.drives) { drive in
                NavigationLink {
                    DriveDetailView(drive: drive, apiClient: apiClient)
                } label: {
                    DriveRow(drive: drive)
                }
            }
            .navigationTitle(place.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("完成") { dismiss() } }
        }
    }
}

private struct DriveDetailView: View {
    let drive: Drive
    let apiClient: APIClient
    @Environment(\.openURL) private var openURL
    @State private var mapTarget: MapTarget?
    @State private var detailedDrive: Drive?
    @State private var isLoadingRoute = true
    @State private var routeMessage: String?

    private var displayedDrive: Drive { detailedDrive ?? drive }
    private var routeStartLocation: DriveLocation? { displayedDrive.route?.first ?? displayedDrive.startLocation }
    private var routeEndLocation: DriveLocation? { displayedDrive.route?.last ?? displayedDrive.endLocation }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                HStack {
                    Label("行程轨迹", systemImage: "map.fill")
                        .font(.headline.weight(.bold))
                    Spacer()
                    Text("\(drive.distanceKm.formatted(.number.precision(.fractionLength(1)))) km")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                if isLoadingRoute {
                    ProgressView("正在加载行程轨迹…")
                        .frame(maxWidth: .infinity, minHeight: 400)
                        .background(.background, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                } else {
                    DriveRouteMap(drive: displayedDrive)
                        .frame(height: 400)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.primary.opacity(0.06)))
                    if let routeMessage {
                        Label(routeMessage, systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                RouteTimelineCard(
                    drive: drive,
                    startLocation: routeStartLocation,
                    endLocation: routeEndLocation,
                    onSelectLocation: { name, location in mapTarget = MapTarget(name: name, location: location) }
                )

                DetailCard(title: "行程概览", icon: "steeringwheel") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        DetailMetricTile(icon: "road.lanes", title: "行驶距离", value: "\(drive.distanceKm.formatted(.number.precision(.fractionLength(1)))) km")
                        DetailMetricTile(icon: "clock.fill", title: "驾驶时间", value: durationText(drive.durationMinutes))
                        DetailMetricTile(icon: "bolt.fill", title: "本次耗电", value: drive.energyUsedKwh.map { "\($0.formatted(.number.precision(.fractionLength(2)))) kWh" } ?? "—")
                        DetailMetricTile(icon: "gauge.with.dots.needle.67percent", title: "平均能耗", value: drive.averageConsumptionWhPerKm.map { "\($0) Wh/km" } ?? "—")
                    }
                }

                DetailCard(title: "车辆表现", icon: "car.fill") {
                    DetailFactGrid {
                        if let start = drive.startSocPercent, let end = drive.endSocPercent {
                            DetailFact(icon: "battery.75percent", label: "电量变化", value: "\(start)% → \(end)%")
                        }
                        if let speed = drive.maxSpeedKph {
                            DetailFact(icon: "speedometer", label: "最高速度", value: "\(speed.formatted(.number.precision(.fractionLength(0)))) km/h")
                        }
                        if let ascent = drive.ascentMeters {
                            DetailFact(icon: "arrow.up.right", label: "累计爬升", value: "\(ascent.formatted(.number.precision(.fractionLength(0)))) m")
                        }
                        if let descent = drive.descentMeters {
                            DetailFact(icon: "arrow.down.right", label: "累计下降", value: "\(descent.formatted(.number.precision(.fractionLength(0)))) m")
                        }
                    }
                }

                if drive.outsideTempCelsius != nil || drive.insideTempCelsius != nil {
                    DetailCard(title: "环境", icon: "thermometer.medium") {
                        DetailFactGrid {
                            if let temperature = drive.outsideTempCelsius {
                                DetailFact(icon: "sun.max.fill", label: "平均室外温度", value: "\(temperature.formatted(.number.precision(.fractionLength(1)))) ℃")
                            }
                            if let temperature = drive.insideTempCelsius {
                                DetailFact(icon: "car.side.fill", label: "平均车内温度", value: "\(temperature.formatted(.number.precision(.fractionLength(1)))) ℃")
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 32)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("行程详情")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: drive.id) { await loadDetail() }
        .confirmationDialog("打开地图", isPresented: Binding(get: { mapTarget != nil }, set: { if !$0 { mapTarget = nil } }), titleVisibility: .visible) {
            Button("Apple 地图") { if let mapTarget { openURL(mapTarget.appleMapsURL) } }
            Button("高德地图") { if let mapTarget { openURL(mapTarget.amapURL) } }
        }
    }

    @MainActor private func loadDetail() async {
        isLoadingRoute = true
        defer { isLoadingRoute = false }
        do {
            let detail = try await apiClient.get("/v1/drives/\(drive.id)", as: Drive.self)
            detailedDrive = detail
            routeMessage = (detail.route?.count ?? 0) >= 2 ? nil : "TeslaMate 未记录完整轨迹，地图仅展示已有位置。"
        } catch {
            routeMessage = "无法读取行程轨迹，地图仅展示已有位置。"
        }
    }

}

private struct DetailCard<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label(title, systemImage: icon)
                .font(.headline.weight(.bold))
                .foregroundStyle(.primary)
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.primary.opacity(0.05)))
    }
}

private struct RouteTimelineCard: View {
    let drive: Drive
    let startLocation: DriveLocation?
    let endLocation: DriveLocation?
    let onSelectLocation: (String, DriveLocation) -> Void

    var body: some View {
        DetailCard(title: "路线", icon: "point.topleft.down.to.point.bottomright.curvepath") {
            VStack(spacing: 0) {
                RouteStopRow(title: "出发", name: drive.startLocationName, time: chineseDateTime(drive.startedAt), color: .green, location: startLocation, onSelect: onSelectLocation)
                HStack(spacing: 14) {
                    Rectangle().fill(.secondary.opacity(0.25)).frame(width: 2, height: 26).padding(.leading, 8)
                    Divider()
                }
                RouteStopRow(title: "到达", name: drive.endLocationName, time: chineseDateTime(drive.endedAt), color: CompanionTheme.accent, location: endLocation, onSelect: onSelectLocation)
            }
        }
    }
}

private struct RouteStopRow: View {
    let title: String
    let name: String
    let time: String
    let color: Color
    let location: DriveLocation?
    let onSelect: (String, DriveLocation) -> Void

    var body: some View {
        Button {
            if let location { onSelect(name, location) }
        } label: {
            HStack(spacing: 14) {
                Circle().fill(color).frame(width: 18, height: 18).overlay(Circle().stroke(.white, lineWidth: 4))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    Text(name).font(.headline).foregroundStyle(.primary)
                    Text(time).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if location != nil {
                    Image(systemName: "map").foregroundStyle(CompanionTheme.accent)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(location == nil)
    }
}

private struct DetailMetricTile: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Image(systemName: icon).foregroundStyle(CompanionTheme.accent)
            Text(value).font(.title3.weight(.bold)).lineLimit(1).minimumScaleFactor(0.72)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
        .background(CompanionTheme.accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct DetailFactGrid<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 16) {
            content
        }
    }
}

private struct DetailFact: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .frame(width: 20)
                .foregroundStyle(CompanionTheme.accent)
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.caption).foregroundStyle(.secondary)
                Text(value).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }
        }
    }
}

private struct DriveRouteMap: View {
    let drive: Drive
    @State private var position: MapCameraPosition = .automatic

    private var recordedRoute: [CLLocationCoordinate2D] {
        (drive.route ?? []).map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    private var startCoordinate: CLLocationCoordinate2D? {
        recordedRoute.first ?? drive.startLocation.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    private var endCoordinate: CLLocationCoordinate2D? {
        recordedRoute.last ?? drive.endLocation.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    private var routeIdentity: String {
        "\(recordedRoute.count)-\(startCoordinate?.latitude ?? 0)-\(endCoordinate?.longitude ?? 0)"
    }

    private var fittedPosition: MapCameraPosition {
        let coordinates = recordedRoute.isEmpty ? [startCoordinate, endCoordinate].compactMap { $0 } : recordedRoute
        guard let first = coordinates.first else { return .automatic }
        let latitudes = coordinates.map(\.latitude)
        let longitudes = coordinates.map(\.longitude)
        let minLatitude = latitudes.min() ?? first.latitude
        let maxLatitude = latitudes.max() ?? first.latitude
        let minLongitude = longitudes.min() ?? first.longitude
        let maxLongitude = longitudes.max() ?? first.longitude
        return .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (minLatitude + maxLatitude) / 2,
                longitude: (minLongitude + maxLongitude) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max((maxLatitude - minLatitude) * 1.55, 0.008),
                longitudeDelta: max((maxLongitude - minLongitude) * 1.55, 0.008)
            )
        ))
    }

    var body: some View {
        Group {
            if startCoordinate == nil && endCoordinate == nil {
                ContentUnavailableView("暂无轨迹", systemImage: "map", description: Text("TeslaMate 尚未记录这次行程的位置数据。"))
            } else {
                Map(position: $position) {
                    if recordedRoute.count >= 2 {
                        MapPolyline(coordinates: recordedRoute)
                            .stroke(CompanionTheme.accent, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                    }
                    if let startCoordinate {
                        Annotation(drive.startLocationName, coordinate: startCoordinate, anchor: .bottom) {
                            RouteEndpointBadge(label: "出发 · \(drive.startLocationName)", icon: "circle.fill", color: .green)
                        }
                    }
                    if let endCoordinate {
                        Annotation(drive.endLocationName, coordinate: endCoordinate, anchor: .bottom) {
                            RouteEndpointBadge(label: "到达 · \(drive.endLocationName)", icon: "mappin.circle.fill", color: CompanionTheme.accent)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .id(routeIdentity)
                .onAppear { position = fittedPosition }
                .onChange(of: routeIdentity) { position = fittedPosition }
            }
        }
    }
}

private struct RouteEndpointBadge: View {
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        Label(label, systemImage: icon)
            .font(.caption2.weight(.bold))
            .lineLimit(1)
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(color, in: Capsule())
            .shadow(radius: 3, y: 1)
    }
}

private struct SummaryMetric: View {
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
    @EnvironmentObject private var charging: ChargingActivityManager
    @State private var charges: [Charge] = []
    @State private var message: String?
    @State private var visibleMonth = Date()
    @State private var presentation: ChargePresentation = .calendar
    @State private var didChooseInitialMonth = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                MonthNavigationHeader(visibleMonth: $visibleMonth)
                    .padding(.horizontal, 16)
                    .padding(.top, 10)

                Picker("展示方式", selection: $presentation) {
                    ForEach(ChargePresentation.allCases) { item in
                        Label(item.title, systemImage: item.icon).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                ScrollView {
                    LazyVStack(spacing: 16) {
                        CurrentChargingCard()

                        if charges.isEmpty {
                            ContentUnavailableView("暂无充电记录", systemImage: "bolt.car", description: Text(message ?? "完成一次充电后，记录会显示在这里。"))
                                .frame(minHeight: 280)
                        } else {
                            HistoryCard {
                                ChargePeriodSummary(charges: monthCharges, title: monthTitle)
                            }

                            if presentation == .calendar {
                                MonthCalendarView(month: visibleMonth, eventCount: { charges(on: $0).count }) { date in
                                    DailyChargesView(date: date, charges: charges(on: date))
                                }
                            } else {
                                if monthCharges.isEmpty {
                                    ContentUnavailableView("本月暂无充电记录", systemImage: "bolt.slash", description: Text("切换月份可查看其他时间段的充电记录。"))
                                        .frame(minHeight: 200)
                                } else {
                                    ForEach(chargeDays) { day in
                                        ChargeDayCard(date: day.date, charges: day.charges)
                                    }
                                }
                            }
                        }

                        if let message, !charges.isEmpty {
                            Label(message, systemImage: "exclamationmark.triangle.fill")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 32)
                }
                .background(Color(uiColor: .systemGroupedBackground))
            }
            .navigationTitle("充电")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("刷新", systemImage: "arrow.clockwise") { Task {
                await charging.refresh(using: apiClient)
                await load()
            } } }
        }
        .task { await load() }
    }

    private var monthCharges: [Charge] {
        let interval = historyCalendar.dateInterval(of: .month, for: visibleMonth)!
        return charges.filter { interval.contains($0.startedAt) }
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年M月"
        return formatter.string(from: visibleMonth)
    }

    private var chargeDays: [ChargeDay] {
        let days: [Date] = monthCharges.map { historyCalendar.startOfDay(for: $0.startedAt) }
        return Set(days).sorted(by: >).map { day in
            ChargeDay(date: day, charges: monthCharges.filter { historyCalendar.isDate($0.startedAt, inSameDayAs: day) })
        }
    }

    private func charges(on date: Date) -> [Charge] {
        monthCharges.filter { historyCalendar.isDate($0.startedAt, inSameDayAs: date) }
    }

    @MainActor private func load() async {
        do {
            guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { message = "尚未发现车辆"; return }
            charges = try await apiClient.get("/v1/vehicles/\(vehicle.id)/charges", as: [Charge].self)
            if !didChooseInitialMonth, let latest = charges.first {
                visibleMonth = latest.startedAt
                didChooseInitialMonth = true
            }
            message = nil
        } catch { message = "无法读取 Mac mini 数据。请确认两台设备在同一 Wi‑Fi；外出时请连接 Tailscale。" }
    }
}

private enum ChargePresentation: String, CaseIterable, Identifiable {
    case calendar, list
    var id: String { rawValue }
    var title: String { self == .calendar ? "日历" : "列表" }
    var icon: String { self == .calendar ? "calendar" : "list.bullet" }
}

private struct ChargeDay: Identifiable {
    let date: Date
    let charges: [Charge]
    var id: Date { date }
}

private struct HistoryCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.primary.opacity(0.05)))
    }
}

private struct ChargePeriodSummary: View {
    let charges: [Charge]
    let title: String

    private var energy: Double { charges.reduce(0) { $0 + $1.addedEnergyKwh } }
    private var minutes: Int { charges.reduce(0) { $0 + ($1.durationMinutes ?? 0) } }
    private var hasDuration: Bool { charges.contains { $0.durationMinutes != nil } }

    private var cost: Cost? {
        let values = charges.compactMap(\.cost)
        guard let currency = values.first?.currency, values.allSatisfy({ $0.currency == currency }) else { return nil }
        return Cost(amount: values.reduce(0) { $0 + $1.amount }, currency: currency)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label(title, systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(charges.count) 次充电")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 0) {
                SummaryMetric(value: "\(energy.formatted(.number.precision(.fractionLength(2)))) kWh", label: "充入电量")
                Divider().padding(.horizontal, 10)
                SummaryMetric(value: hasDuration ? durationText(minutes) : "—", label: "充电时长")
                Divider().padding(.horizontal, 10)
                SummaryMetric(value: cost.map { $0.amount.formatted(.currency(code: $0.currency)) } ?? "—", label: "充电费用")
            }
        }
    }
}

private struct ChargeRow: View {
    let charge: Charge

    private var chargingTypeName: String { charge.chargingType == "dc" ? "直流快充" : "交流充电" }

    private var socText: String? {
        guard let start = charge.startSocPercent, let end = charge.endSocPercent else { return nil }
        return "\(start)% → \(end)%"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 9) {
                Image(systemName: charge.chargingType == "dc" ? "bolt.fill" : "powerplug.fill")
                    .font(.caption2)
                    .foregroundStyle(CompanionTheme.accent)
                Text(charge.locationName)
                    .font(.headline)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(chargingTypeName)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(CompanionTheme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(CompanionTheme.accent.opacity(0.1), in: Capsule())
            }
            HStack(spacing: 10) {
                Text(chineseDateTime(charge.startedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let socText {
                    Text(socText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if let cost = charge.cost {
                    Text(cost.amount.formatted(.currency(code: cost.currency)))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 0) {
                SummaryMetric(value: "\(charge.addedEnergyKwh.formatted(.number.precision(.fractionLength(2)))) kWh", label: "充入电量")
                Divider().padding(.horizontal, 12)
                SummaryMetric(value: charge.durationMinutes.map(durationText) ?? "—", label: "充电时长")
                Divider().padding(.horizontal, 12)
                SummaryMetric(value: charge.maxChargingPowerKw.map { "\($0.formatted(.number.precision(.fractionLength(0)))) kW" } ?? "—", label: "最大功率")
            }
        }
        .padding(.vertical, 6)
    }
}

private struct ChargeDayCard: View {
    let date: Date
    let charges: [Charge]

    private var energy: Double { charges.reduce(0) { $0 + $1.addedEnergyKwh } }

    var body: some View {
        HistoryCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label(dayTitle(date), systemImage: "calendar")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text("\(charges.count) 次 · \(energy.formatted(.number.precision(.fractionLength(2)))) kWh")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                ForEach(charges) { charge in
                    Divider()
                    NavigationLink {
                        ChargeDetailView(charge: charge)
                    } label: {
                        ChargeRow(charge: charge)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct DailyChargesView: View {
    let date: Date
    let charges: [Charge]

    private var title: String { dayTitle(date) }

    var body: some View {
        List {
            Section {
                ChargePeriodSummary(charges: charges, title: title)
            }

            if charges.isEmpty {
                Section {
                    ContentUnavailableView("当天暂无充电记录", systemImage: "bolt.car", description: Text("TeslaMate 在这一天没有记录到充电。"))
                }
            } else {
                Section("充电明细 · \(charges.count) 次") {
                    ForEach(charges) { charge in
                        NavigationLink {
                            ChargeDetailView(charge: charge)
                        } label: {
                            ChargeRow(charge: charge)
                        }
                    }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ChargeDetailView: View {
    let charge: Charge
    @Environment(\.openURL) private var openURL
    @State private var mapTarget: MapTarget?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                DetailCard(title: "充电概览", icon: "bolt.car.fill") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        DetailMetricTile(icon: "bolt.fill", title: "充入电量", value: "\(charge.addedEnergyKwh.formatted(.number.precision(.fractionLength(2)))) kWh")
                        DetailMetricTile(icon: "clock.fill", title: "充电时长", value: charge.durationMinutes.map(durationText) ?? "—")
                        DetailMetricTile(icon: "gauge.with.dots.needle.50percent", title: "最大功率", value: charge.maxChargingPowerKw.map { "\($0.formatted(.number.precision(.fractionLength(0)))) kW" } ?? "—")
                        DetailMetricTile(icon: "chart.line.uptrend.xyaxis", title: "充电效率", value: charge.chargingEfficiencyPercent.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                    }
                }

                DetailCard(title: "充电记录", icon: "mappin.and.ellipse") {
                    VStack(spacing: 16) {
                        Button {
                            if let location = charge.location {
                                mapTarget = MapTarget(name: charge.locationName, location: location)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(CompanionTheme.accent)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("充电地点").font(.caption).foregroundStyle(.secondary)
                                    Text(charge.locationName).font(.headline).foregroundStyle(.primary)
                                }
                                Spacer()
                                if charge.location != nil {
                                    Image(systemName: "map").foregroundStyle(CompanionTheme.accent)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(charge.location == nil)

                        Divider()

                        HStack(alignment: .top, spacing: 12) {
                            ChargeTimePoint(title: "开始", date: charge.startedAt, alignment: .leading)
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.tertiary)
                                .padding(.top, 22)
                            Spacer()
                            ChargeTimePoint(title: "结束", date: charge.endedAt, alignment: .trailing)
                        }
                    }
                }

                DetailCard(title: "电量与费用", icon: "battery.75percent") {
                    DetailFactGrid {
                        if let start = charge.startSocPercent, let end = charge.endSocPercent {
                            DetailFact(icon: "battery.75percent", label: "电量变化", value: "\(start)% → \(end)%")
                        }
                        if let consumed = charge.consumedEnergyKwh {
                            DetailFact(icon: "powerplug.fill", label: "电网取电", value: "\(consumed.formatted(.number.precision(.fractionLength(2)))) kWh")
                        }
                        DetailFact(icon: charge.chargingType == "dc" ? "bolt.fill" : "powerplug.fill", label: "充电方式", value: charge.chargingType == "dc" ? "直流快充" : "交流充电")
                        if let cost = charge.cost {
                            DetailFact(icon: "banknote.fill", label: "本次费用", value: cost.amount.formatted(.currency(code: cost.currency)))
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 32)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("充电详情")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("打开地图", isPresented: Binding(get: { mapTarget != nil }, set: { if !$0 { mapTarget = nil } }), titleVisibility: .visible) {
            Button("Apple 地图") { if let mapTarget { openURL(mapTarget.appleMapsURL) } }
            Button("高德地图") { if let mapTarget { openURL(mapTarget.amapURL) } }
        }
    }
}

private struct ChargeTimePoint: View {
    let title: String
    let date: Date
    let alignment: HorizontalAlignment

    private var time: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private var day: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "M月d日"
        return formatter.string(from: date)
    }

    var body: some View {
        VStack(alignment: alignment, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(time).font(.title3.weight(.bold)).monospacedDigit()
            Text(day).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct MyView: View {
    let apiClient: APIClient

    var body: some View {
        NavigationStack {
            List {
                Section("数据") {
                    NavigationLink {
                        ReportsView(apiClient: apiClient)
                    } label: {
                        Label("用车报告", systemImage: "chart.line.uptrend.xyaxis")
                    }
                }

                Section("偏好设置") {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("设置", systemImage: "gearshape.fill")
                    }
                }
            }
            .navigationTitle("我的")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var charging: ChargingActivityManager

    var body: some View {
        List {
            Section {
                Toggle(isOn: Binding(
                    get: { charging.enabled },
                    set: { value in Task { await charging.setEnabled(value) } }
                )) {
                    Label("灵动岛与锁屏", systemImage: "capsule.portrait")
                }
                .tint(CompanionTheme.accent)

                if let error = charging.activityError {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            } header: {
                Text("实时活动")
            } footer: {
                Text("开启后，充电时会在灵动岛与锁屏显示最近电量。App 打开期间每 15 秒刷新；数据超过 2 分钟会标记为待刷新。")
            }
        }
        .navigationTitle("设置")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ReportsView: View {
    let apiClient: APIClient
    @State private var report: ReportSummary?
    @State private var message: String?
    @State private var periodKind: ReportPeriodKind = .month
    @State private var anchorDate = Date()

    var body: some View {
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
