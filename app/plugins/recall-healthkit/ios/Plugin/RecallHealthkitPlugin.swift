import Foundation
import Capacitor
import HealthKit

private let healthStore = HKHealthStore()

@objc(RecallHealthkitPlugin)
public class RecallHealthkitPlugin: CAPPlugin {
    private static let readTypes: Set<HKObjectType> = {
        var types = Set<HKObjectType>()
        let quantityIds: [HKQuantityTypeIdentifier] = [
            .heartRate,
            .respiratoryRate,
            .bloodPressureSystolic,
            .bloodPressureDiastolic,
            .bodyTemperature,
            .walkingSpeed,
        ]
        for id in quantityIds {
            if let type = HKQuantityType.quantityType(forIdentifier: id) {
                types.insert(type)
            }
        }
        return types
    }()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device.")
            return
        }

        healthStore.requestAuthorization(toShare: [], read: Self.readTypes) { success, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            if !success {
                call.reject("HealthKit authorization was not granted.")
                return
            }
            call.resolve()
        }
    }

    @objc func readLatestVitals(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device.")
            return
        }

        let group = DispatchGroup()
        var payload: [String: Any] = [:]
        var deviceName: String?

        group.enter()
        queryLatestQuantity(.heartRate, unit: HKUnit.count().unitDivided(by: .minute())) { value, sample in
            if let value { payload["heartRate"] = Int(value.rounded()) }
            deviceName = deviceName ?? self.sourceLabel(for: sample)
            group.leave()
        }

        group.enter()
        queryLatestQuantity(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute())) { value, _ in
            if let value { payload["respiratoryRate"] = Int(value.rounded()) }
            group.leave()
        }

        group.enter()
        queryLatestQuantity(.bloodPressureSystolic, unit: HKUnit.millimeterOfMercury()) { value, _ in
            if let value { payload["bloodPressureSystolic"] = Int(value.rounded()) }
            group.leave()
        }

        group.enter()
        queryLatestQuantity(.bloodPressureDiastolic, unit: HKUnit.millimeterOfMercury()) { value, _ in
            if let value { payload["bloodPressureDiastolic"] = Int(value.rounded()) }
            group.leave()
        }

        group.enter()
        queryLatestQuantity(.bodyTemperature, unit: .degreeFahrenheit()) { value, _ in
            if let value { payload["bodyTempF"] = (value * 10).rounded() / 10 }
            group.leave()
        }

        group.enter()
        queryLatestQuantity(.walkingSpeed, unit: HKUnit.mile().unitDivided(by: .hour())) { value, _ in
            if let value { payload["walkingSpeedMph"] = (value * 10).rounded() / 10 }
            group.leave()
        }

        group.notify(queue: .main) {
            payload["syncedAt"] = ISO8601DateFormatter().string(from: Date())
            payload["source"] = "healthkit"
            if let deviceName {
                payload["deviceName"] = deviceName
            }
            call.resolve(payload)
        }
    }

    private func sourceLabel(for sample: HKQuantitySample?) -> String? {
        guard let sample else { return nil }
        if let name = sample.device?.name, !name.isEmpty {
            return name
        }
        return sample.sourceRevision.source.name
    }

    private func queryLatestQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        completion: @escaping (Double?, HKQuantitySample?) -> Void
    ) {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
            completion(nil, nil)
            return
        }

        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: type,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else {
                completion(nil, nil)
                return
            }
            completion(sample.quantity.doubleValue(for: unit), sample)
        }

        healthStore.execute(query)
    }
}
