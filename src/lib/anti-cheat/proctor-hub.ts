/**
 * Real-time Proctor Hub (Server-Sent Events Pub/Sub)
 * Dispatches real-time events for live examination proctoring dashboards.
 */

export type ProctorEventPayload = {
  type:
    | "initial_state"
    | "student_joined"
    | "connection_status_change"
    | "attempt_status_change"
    | "incident_recorded"
    | "exam_submitted"
    | "time_extended";
  examinationId: string;
  timestamp: string;
  data: any;
};

export type SubscriberCallback = (event: ProctorEventPayload) => void;

class ProctorHub {
  private subscribers = new Map<string, Set<SubscriberCallback>>();

  /**
   * Subscribe a proctor SSE client to an examination's event stream.
   * Returns an unsubscribe function.
   */
  subscribe(examinationId: string, callback: SubscriberCallback): () => void {
    if (!this.subscribers.has(examinationId)) {
      this.subscribers.set(examinationId, new Set());
    }

    const room = this.subscribers.get(examinationId)!;
    room.add(callback);

    return () => {
      room.delete(callback);
      if (room.size === 0) {
        this.subscribers.delete(examinationId);
      }
    };
  }

  /**
   * Broadcast an event to all proctors watching the specified examination.
   */
  broadcast(
    examinationId: string,
    type: ProctorEventPayload["type"],
    data: any
  ): void {
    const room = this.subscribers.get(examinationId);
    if (!room || room.size === 0) return;

    const payload: ProctorEventPayload = {
      type,
      examinationId,
      timestamp: new Date().toISOString(),
      data,
    };

    room.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error("Error dispatching proctor SSE event:", err);
      }
    });
  }

  /**
   * Number of active proctor subscribers for an examination.
   */
  getSubscriberCount(examinationId: string): number {
    return this.subscribers.get(examinationId)?.size ?? 0;
  }
}

// Global singleton instance
const globalForProctor = globalThis as unknown as {
  proctorHub: ProctorHub | undefined;
};

export const proctorHub = globalForProctor.proctorHub ?? new ProctorHub();

if (process.env.NODE_ENV !== "production") {
  globalForProctor.proctorHub = proctorHub;
}

export default proctorHub;
