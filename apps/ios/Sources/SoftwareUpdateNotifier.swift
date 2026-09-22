// BGTask's iOS 17 interface predates Sendable annotations; this file only hands
// the task object back to the scheduler it came from.
@preconcurrency import BackgroundTasks
import SwiftUI
import UserNotifications

enum SoftwareUpdateNotification {
    /// Must match `BGTaskSchedulerPermittedIdentifiers` in Supporting/Info.plist.
    static let backgroundTaskIdentifier = "com.personal.teslacompanion.software-update-refresh"
}

/// Local notifications for vehicle software updates.
///
/// The home server cannot reach the phone, so updates are detected whenever the
/// app refreshes the overview: in the foreground, or when iOS wakes the app
/// through a background app refresh task.
@MainActor
final class SoftwareUpdateNotifier: ObservableObject {
    @Published private(set) var enabled = UserDefaults.standard.bool(forKey: enabledKey)
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var message: String?

    private static let enabledKey = "softwareUpdateNotificationsEnabled"
    private static let notifiedTargetsKey = "softwareUpdateNotifiedTargets"

    private var notifiedTargets: [String: String] {
        UserDefaults.standard.dictionary(forKey: Self.notifiedTargetsKey) as? [String: String] ?? [:]
    }

    func refreshAuthorizationStatus() async {
        authorizationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        // Permission can be revoked from iOS settings, so the toggle follows the
        // system state instead of staying on while notifications are silent.
        if enabled && authorizationStatus == .denied {
            enabled = false
            UserDefaults.standard.set(false, forKey: Self.enabledKey)
            message = "iOS 已关闭 Tesla Buddy 的通知，软件更新提醒不再发送。"
        }
    }

    func setEnabled(_ value: Bool) async {
        message = nil
        guard value else {
            enabled = false
            UserDefaults.standard.set(false, forKey: Self.enabledKey)
            return
        }

        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            authorizationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
            enabled = granted
            UserDefaults.standard.set(granted, forKey: Self.enabledKey)
            if !granted {
                message = "系统没有允许通知。请在 iOS 设置 > 通知 > Tesla Buddy 中开启允许通知。"
            }
        } catch {
            enabled = false
            UserDefaults.standard.set(false, forKey: Self.enabledKey)
            message = "无法请求通知权限：\(error.localizedDescription)"
        }
    }

    /// Sends at most one notification per vehicle and target version.
    func note(vehicle: VehicleOverview) async {
        guard enabled, vehicle.updateStatus == "available" else { return }
        let target = vehicle.availableSoftwareVersion ?? "unknown"
        guard notifiedTargets[vehicle.id] != target else { return }
        guard await ensureAuthorized() else { return }

        let content = UNMutableNotificationContent()
        content.title = "有新的车辆软件更新"
        if let target = vehicle.availableSoftwareVersion {
            content.body = "可用版本 \(target)，当前版本 \(vehicle.softwareVersion ?? "未知")。"
                + "请在 Tesla 官方 App 或车机「控制 > 软件」中安装或预约。"
        } else {
            content.body = "车辆报告有可用更新，请在 Tesla 官方 App 或车机「控制 > 软件」中查看。"
        }
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "software-update-\(vehicle.id)-\(target)",
            content: content,
            trigger: nil
        )
        do {
            try await UNUserNotificationCenter.current().add(request)
            var targets = notifiedTargets
            targets[vehicle.id] = target
            UserDefaults.standard.set(targets, forKey: Self.notifiedTargetsKey)
        } catch {
            message = "通知发送失败：\(error.localizedDescription)"
        }
    }

    private func ensureAuthorized() async -> Bool {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        authorizationStatus = status
        return status == .authorized || status == .provisional
    }
}

/// Shows update notifications as banners while the app itself is in front.
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    static let shared = NotificationPresenter()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}

/// Background app refresh keeps checking for updates while the app is not open.
enum BackgroundUpdateRefresher {
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: SoftwareUpdateNotification.backgroundTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 45 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func run(_ task: BGAppRefreshTask) {
        // Queue the next check first: a failure below must not stop the chain.
        schedule()

        let work = Task { @MainActor () -> Bool in
            let notifier = SoftwareUpdateNotifier()
            await notifier.refreshAuthorizationStatus()
            guard notifier.enabled else { return true }

            do {
                let apiClient = CompanionAPI.makeClient()
                guard let vehicle = try await VehicleLoader(apiClient: apiClient).firstVehicle() else { return true }
                let overview = try await apiClient.get(
                    "/v1/vehicles/\(vehicle.id)/overview",
                    as: VehicleOverview.self
                )
                await notifier.note(vehicle: overview)
                return true
            } catch {
                // iOS learns from repeated failures and backs off on its own.
                return false
            }
        }

        task.expirationHandler = { work.cancel() }
        Task {
            task.setTaskCompleted(success: await work.value)
        }
    }
}
