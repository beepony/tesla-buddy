import ActivityKit
import SwiftUI
import WidgetKit

@main
struct ChargingWidgetBundle: WidgetBundle {
    var body: some Widget { ChargingLiveActivity() }
}

private struct ChargingClock: View {
    let state: ChargingActivityAttributes.ContentState
    let stale: Bool
    var body: some View {
        if let end = state.endedAt {
            Text(duration(end)).monospacedDigit()
        } else if stale {
            Text(duration(state.updatedAt)).monospacedDigit()
        } else {
            // Cap the timer when the sample becomes stale. A stopped logger
            // must not produce an indefinitely increasing "live" duration.
            Text(timerInterval: state.startedAt...max(state.startedAt, state.freshUntil), countsDown: false)
                .monospacedDigit()
        }
    }
    private func duration(_ end: Date) -> String {
        let minutes = max(0, Int(end.timeIntervalSince(state.startedAt) / 60))
        return "\(minutes / 60)小时\(minutes % 60)分"
    }
}

struct ChargingLiveActivity: Widget {
    private let accent = Color(red: 0.42, green: 0.64, blue: 1)
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ChargingActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("Tesla Buddy", systemImage: "bolt.fill").foregroundStyle(accent)
                    Spacer()
                    Text(context.isStale ? "数据待刷新" : context.state.statusText)
                        .foregroundStyle(.secondary)
                }.font(.caption.weight(.semibold))
                HStack(alignment: .firstTextBaseline) {
                    Text(context.state.percentText).font(.system(size: 38, weight: .bold, design: .rounded))
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        ChargingClock(state: context.state, stale: context.isStale).font(.title3.weight(.semibold))
                        Text(context.isStale ? "截至上次采样" : "本次连接时长").font(.caption).foregroundStyle(.secondary)
                    }
                }
                ProgressView(value: Double(context.state.batteryPercent ?? 0), total: 100).tint(accent)
                HStack {
                    Text(context.attributes.vehicleName).lineLimit(1)
                    Spacer()
                    Text(context.state.powerText)
                    if let energy = context.state.addedEnergyKwh {
                        Text("· 已充 \(energy.formatted(.number.precision(.fractionLength(1)))) kWh")
                    }
                }.font(.caption).foregroundStyle(.secondary)
                Text("打开 App 更新电量 · 后台显示最近读数")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            .padding(18)
            .activityBackgroundTint(Color(red: 0.06, green: 0.09, blue: 0.16))
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.isStale ? "待刷新" : context.state.statusText, systemImage: "bolt.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.percentText).font(.title2.bold()).foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 9) {
                        ProgressView(value: Double(context.state.batteryPercent ?? 0), total: 100).tint(accent)
                        HStack {
                            Text(context.isStale ? "截至上次采样" : "连接时长")
                            ChargingClock(state: context.state, stale: context.isStale).frame(maxWidth: 110)
                            Spacer()
                            Text(context.state.powerText)
                        }.font(.caption)
                        Text("打开 App 更新电量").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: context.isStale ? "arrow.clockwise" : "bolt.fill").foregroundStyle(accent)
            } compactTrailing: {
                Text(context.state.percentText).font(.caption.weight(.bold)).foregroundStyle(accent)
            } minimal: {
                Image(systemName: context.isStale ? "arrow.clockwise" : "bolt.fill").foregroundStyle(accent)
            }
            .keylineTint(accent)
        }
    }
}
