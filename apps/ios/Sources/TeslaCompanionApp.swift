@preconcurrency import BackgroundTasks
import SwiftUI
import UserNotifications

@main
struct TeslaCompanionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let apiClient = CompanionAPI.makeClient()

    var body: some Scene {
        WindowGroup {
            ContentView(apiClient: apiClient)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationPresenter.shared
        // Registering before launch finishes is required for background tasks.
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: SoftwareUpdateNotification.backgroundTaskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            BackgroundUpdateRefresher.run(refreshTask)
        }
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        BackgroundUpdateRefresher.schedule()
    }
}
