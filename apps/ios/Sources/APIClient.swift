import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "服务器返回的数据无法识别。"
        case .server(let code): return "服务器暂时不可用（错误 \(code)）。"
        }
    }
}

struct APIClient {
    let baseURL: URL
    private let decoder: JSONDecoder

    init(baseURL: URL) {
        self.baseURL = baseURL
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]
            if let date = fractional.date(from: value) ?? standard.date(from: value) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "无法解析日期：\(value)")
        }
    }

    func get<Value: Decodable>(_ path: String, as type: Value.Type) async throws -> Value {
        let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        var components = URLComponents(url: baseURL.appending(path: String(parts[0])), resolvingAgainstBaseURL: false)
        if parts.count == 2 { components?.percentEncodedQuery = String(parts[1]) }
        guard let url = components?.url else { throw APIError.invalidResponse }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.server(http.statusCode) }
        return try decoder.decode(APIEnvelope<Value>.self, from: data).data
    }
}
