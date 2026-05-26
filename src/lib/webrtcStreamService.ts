'use client';

import { database } from './firebase';
import { ref, set, onValue, off, remove, push, get } from 'firebase/database';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export interface LiveStreamInfo {
  hostUid: string;
  active: boolean;
  startedAt: number;
}

export class WebRTCStreamService {
  private roomCode: string;
  private userId: string;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private unsubscribers: Array<() => void> = [];
  private isHost = false;

  constructor(roomCode: string, userId: string) {
    this.roomCode = roomCode;
    this.userId = userId;
  }

  // ─── HOST: Broadcast local video stream to all viewers ───────────────────

  async startBroadcast(stream: MediaStream): Promise<void> {
    this.isHost = true;
    this.localStream = stream;

    // Announce live stream
    await set(ref(database, `rooms/${this.roomCode}/liveStream`), {
      hostUid: this.userId,
      active: true,
      startedAt: Date.now(),
    });

    // Clean previous WebRTC signaling data
    await remove(ref(database, `rooms/${this.roomCode}/webrtc`));

    // Listen for viewers requesting to connect
    const requestsRef = ref(database, `rooms/${this.roomCode}/webrtc/requests`);
    const unsub = onValue(requestsRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const requests = snapshot.val() as Record<string, any>;
      for (const viewerUid of Object.keys(requests)) {
        if (viewerUid === this.userId) continue;
        if (this.peers.has(viewerUid)) continue;
        await this._createHostPeer(viewerUid);
      }
    });
    this.unsubscribers.push(() => off(requestsRef, 'value', unsub as any));
  }

  private async _createHostPeer(viewerUid: string): Promise<void> {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(viewerUid, pc);

    // Stream all tracks to viewer
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) =>
        pc.addTrack(track, this.localStream!)
      );
    }

    // Send ICE candidates to viewer
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await push(
          ref(database, `rooms/${this.roomCode}/webrtc/hostCandidates/${viewerUid}`),
          e.candidate.toJSON()
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.peers.delete(viewerUid);
      }
    };

    // Create & send offer
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    await set(ref(database, `rooms/${this.roomCode}/webrtc/offers/${viewerUid}`), {
      sdp: offer.sdp,
      type: offer.type,
    });

    // Listen for viewer's answer
    const answerRef = ref(database, `rooms/${this.roomCode}/webrtc/answers/${viewerUid}`);
    const answerUnsub = onValue(answerRef, async (snap) => {
      if (!snap.exists() || pc.remoteDescription) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      } catch {}
    });
    this.unsubscribers.push(() => off(answerRef, 'value', answerUnsub as any));

    // Receive viewer ICE candidates
    const viewerCandRef = ref(database, `rooms/${this.roomCode}/webrtc/viewerCandidates/${viewerUid}`);
    const candUnsub = onValue(viewerCandRef, (snap) => {
      snap.forEach((child) => {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(child.val())).catch(() => {});
        }
      });
    });
    this.unsubscribers.push(() => off(viewerCandRef, 'value', candUnsub as any));
  }

  // ─── VIEWER: Connect to host's live stream ────────────────────────────────

  async watchStream(hostUid: string): Promise<MediaStream> {
    return new Promise(async (resolve, reject) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      this.peers.set(hostUid, pc);

      const remoteStream = new MediaStream();

      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (remoteStream.getTracks().length > 0) resolve(remoteStream);
      };

      // Send our ICE candidates to host
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await push(
            ref(database, `rooms/${this.roomCode}/webrtc/viewerCandidates/${this.userId}`),
            e.candidate.toJSON()
          );
        }
      };

      // Request connection from host
      await set(
        ref(database, `rooms/${this.roomCode}/webrtc/requests/${this.userId}`),
        { viewerUid: this.userId, requestedAt: Date.now() }
      );

      // Wait for host offer
      const offerRef = ref(database, `rooms/${this.roomCode}/webrtc/offers/${this.userId}`);
      const offerUnsub = onValue(offerRef, async (snap) => {
        if (!snap.exists() || pc.remoteDescription) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(ref(database, `rooms/${this.roomCode}/webrtc/answers/${this.userId}`), {
            sdp: answer.sdp,
            type: answer.type,
          });
        } catch (err) {
          reject(err);
        }
      });
      this.unsubscribers.push(() => off(offerRef, 'value', offerUnsub as any));

      // Receive host ICE candidates
      const hostCandRef = ref(database, `rooms/${this.roomCode}/webrtc/hostCandidates/${this.userId}`);
      const candUnsub = onValue(hostCandRef, (snap) => {
        snap.forEach((child) => {
          if (pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(child.val())).catch(() => {});
          }
        });
      });
      this.unsubscribers.push(() => off(hostCandRef, 'value', candUnsub as any));

      setTimeout(() => reject(new Error('P2P connection timed out')), 30000);
    });
  }

  // ─── Listen to live stream status ─────────────────────────────────────────

  onLiveStream(callback: (info: LiveStreamInfo | null) => void): () => void {
    const liveRef = ref(database, `rooms/${this.roomCode}/liveStream`);
    onValue(liveRef, (snap) => callback(snap.val()));
    return () => off(liveRef, 'value');
  }

  // ─── Stop broadcasting ────────────────────────────────────────────────────

  async stopBroadcast(): Promise<void> {
    await set(ref(database, `rooms/${this.roomCode}/liveStream`), {
      hostUid: this.userId,
      active: false,
      startedAt: 0,
    });
    await remove(ref(database, `rooms/${this.roomCode}/webrtc`));
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  cleanup(): void {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
  }
}
