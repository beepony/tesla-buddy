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
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 8) {
                    Label("Tesla Buddy", systemImage: "bolt.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(accent)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(context.isStale ? "数据待刷新" : context.state.statusText)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(context.state.percentText)
                        .font(.system(size: 36, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        ChargingClock(state: context.state, stale: context.isStale)
                            .font(.headline.weight(.bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text(context.isStale ? "截至上次采样" : "本次连接时长")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                ProgressView(value: Double(context.state.batteryPercent ?? 0), total: 100)
                    .tint(accent)
                HStack(spacing: 8) {
                    Text(context.attributes.vehicleName)
                        .lineLimit(1)
                        .layoutPriority(1)
                    Spacer(minLength: 4)
                    Text(context.state.powerText)
                    if let energy = context.state.addedEnergyKwh {
                        Text("· 已充 \(energy.formatted(.number.precision(.fractionLength(1)))) kWh")
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            }
            .padding(14)
            .activityBackgroundTint(Color(red: 0.06, green: 0.09, blue: 0.16))
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.isStale ? "待刷新" : context.state.statusText, systemImage: "bolt.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(accent)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.percentText)
                        .font(.system(size: 22, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(accent)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 7) {
                        ProgressView(value: Double(context.state.batteryPercent ?? 0), total: 100).tint(accent)
                        HStack(spacing: 6) {
                            Text(context.isStale ? "截至上次采样" : "连接时长")
                            ChargingClock(state: context.state, stale: context.isStale)
                                .fontWeight(.semibold)
                                .lineLimit(1)
                            Spacer(minLength: 8)
                            Text(context.state.powerText).fontWeight(.semibold)
                        }
                        .font(.caption)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    }
                }
            } compactLeading: {
                Image(systemName: context.isStale ? "arrow.clockwise" : "bolt.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(accent)
            } compactTrailing: {
                Text(context.state.percentText)
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(accent)
                    .lineLimit(1)
            } minimal: {
                Image(systemName: context.isStale ? "arrow.clockwise" : "bolt.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(accent)
            }
            .keylineTint(accent)
        }
    }
}
