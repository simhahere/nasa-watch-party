// src/lib/videoCallService.ts

import { database } from './firebase';
import { ref, set, onValue, off, push, remove } from 'firebase/database';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  iceCandidatePoolSize: 10,
};

export type VideoCallCallbacks = {
  onRemoteStream: (stream: MediaStream) => void;
  onError?: (error: any) => void;
};

export class VideoCallService {
  private roomCode: string;
  private userId: string;
  private pcMap: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private callbacks: VideoCallCallbacks;

  constructor(roomCode: string, userId: string, callbacks: VideoCallCallbacks) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  /** Initialize local camera/mic */
  async initLocalStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.localStream = stream;
    return stream;
  }

  /** Start a call as initiator (host) */
  async startCall(): Promise<void> {
    if (!this.localStream) throw new Error('Local stream not initialized');
    // Create a peer connection for each existing participant (excluding self)
    const participants = await this.fetchParticipants();
    participants.forEach((uid) => this.createPeer(uid, true));
  }

  /** Join an existing call as a participant */
  async joinCall(): Promise<void> {
    // Listen for offers from other participants
    const offersRef = ref(database, `rooms/${this.roomCode}/videoCall/offers`);
    onValue(offersRef, (snap) => {
      const offers = snap.val() || {};
      Object.entries(offers).forEach(([uid, offer]) => {
        if (uid === this.userId) return; // ignore own offer
        this.handleRemoteOffer(uid, offer as RTCSessionDescriptionInit);
      });
    });
  }

  /** Clean up connections */
  cleanup(): void {
    this.pcMap.forEach((pc) => pc.close());
    this.pcMap.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    // Remove signaling data
    remove(ref(database, `rooms/${this.roomCode}/videoCall`));
  }

  /** Internal: fetch currently connected participants */
  private async fetchParticipants(): Promise<string[]> {
    // Simple implementation: read members list and return their uids (excluding self)
    const membersRef = ref(database, `rooms/${this.roomCode}/members`);
    const snap = await new Promise<any>((resolve) => {
      onValue(membersRef, (s) => resolve(s), { onlyOnce: true });
    });
    const members = snap.val() || {};
    return Object.keys(members).filter((uid) => uid !== this.userId);
  }

  /** Internal: create peer connection */
  private createPeer(peerUid: string, isInitiator: boolean): void {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.pcMap.set(peerUid, pc);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }

    // ICE handling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const path = isInitiator
          ? `rooms/${this.roomCode}/videoCall/candidates/${this.userId}/${peerUid}`
          : `rooms/${this.roomCode}/videoCall/candidates/${peerUid}/${this.userId}`;
        push(ref(database, path), e.candidate.toJSON());
      }
    };

    // Remote stream handling
    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      this.callbacks.onRemoteStream(remoteStream);
    };

    // Signaling exchange
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const offerPath = `rooms/${this.roomCode}/videoCall/offers/${this.userId}/${peerUid}`;
          await set(ref(database, offerPath), { type: offer.type, sdp: offer.sdp });
        } catch (err) {
          this.callbacks.onError?.(err);
        }
      };
    } else {
      // Listener for answer & remote ICE will be set up in handleRemoteOffer
    }

    // Listen for remote ICE candidates
    const candPath = isInitiator
      ? `rooms/${this.roomCode}/videoCall/candidates/${peerUid}/${this.userId}`
      : `rooms/${this.roomCode}/videoCall/candidates/${this.userId}/${peerUid}`;
    const candRef = ref(database, candPath);
    const candUnsub = onValue(candRef, (snap) => {
      snap.forEach((child) => {
        const cand = child.val();
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      });
    });
    // Store unsub for cleanup if needed (not fully tracked here)
  }

  /** Handle incoming offer from another participant */
  private async handleRemoteOffer(peerUid: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.pcMap.set(peerUid, pc);

    // Add local tracks if we have them
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }

    // Remote stream handling
    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      this.callbacks.onRemoteStream(remoteStream);
    };

    // ICE handling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const path = `rooms/${this.roomCode}/videoCall/candidates/${this.userId}/${peerUid}`;
        push(ref(database, path), e.candidate.toJSON());
      }
    };

    // Set remote description and create answer
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const answerPath = `rooms/${this.roomCode}/videoCall/answers/${this.userId}/${peerUid}`;
    await set(ref(database, answerPath), { type: answer.type, sdp: answer.sdp });

    // Listen for initiator ICE candidates
    const candPath = `rooms/${this.roomCode}/videoCall/candidates/${peerUid}/${this.userId}`;
    const candRef = ref(database, candPath);
    onValue(candRef, (snap) => {
      snap.forEach((child) => {
        const cand = child.val();
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      });
    });
  }
}

export default VideoCallService;
