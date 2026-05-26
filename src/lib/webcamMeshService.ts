'use client';

import { database } from './firebase';
import { ref, set, onValue, off, remove, push } from 'firebase/database';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Free TURN via Open Relay (no auth needed, limited bandwidth)
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebcamMeshService {
  private roomCode: string;
  private userId: string;
  private localStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private unsubscribers: Map<string, Array<() => void>> = new Map();
  private onStreamChange: (peerUid: string, stream: MediaStream | null) => void;

  constructor(
    roomCode: string,
    userId: string,
    onStreamChange: (peerUid: string, stream: MediaStream | null) => void
  ) {
    this.roomCode = roomCode;
    this.userId = userId;
    this.onStreamChange = onStreamChange;
  }

  // Update our local webcam/audio stream
  updateLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // Try to replace tracks on existing connections first
    this.peers.forEach((pc, peerUid) => {
      const senders = pc.getSenders();
      if (stream && senders.length > 0) {
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(err =>
              console.warn('[WebcamMesh] replaceTrack failed:', err)
            );
          } else {
            pc.addTrack(track, stream);
          }
        });
      } else {
        // No senders yet or stream removed, reconnect
        this.reconnectPeer(peerUid);
      }
    });
  }

  // Update room members list and presence
  updateMembers(members: Record<string, any>) {
    Object.entries(members).forEach(([peerUid, member]) => {
      if (peerUid === this.userId) return;

      const shouldConnect = member.online;
      const hasConnection = this.peers.has(peerUid);

      if (shouldConnect && !hasConnection) {
        this.connectPeer(peerUid);
      } else if (!shouldConnect && hasConnection) {
        this.disconnectPeer(peerUid);
      }
    });

    // Cleanup peers that are no longer in the members list
    Array.from(this.peers.keys()).forEach((peerUid) => {
      if (!members[peerUid]) {
        this.disconnectPeer(peerUid);
      }
    });
  }

  private reconnectPeer(peerUid: string) {
    this.disconnectPeer(peerUid);
    this.connectPeer(peerUid);
  }

  private connectPeer(peerUid: string) {
    if (this.peers.has(peerUid)) return;

    const isInitiator = this.userId < peerUid;
    console.log(`[WebcamMesh] Connecting to peer ${peerUid}. Initiator: ${isInitiator}`);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerUid, pc);
    this.unsubscribers.set(peerUid, []);

    const remoteStream = new MediaStream();

    // When remote track arrives
    pc.ontrack = (e) => {
      console.log(`[WebcamMesh] Received track from peer ${peerUid}:`, e.track.kind);
      e.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      this.onStreamChange(peerUid, remoteStream);
    };

    // Add local tracks if they exist
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const initiatorUid = isInitiator ? this.userId : peerUid;
    const receiverUid = isInitiator ? peerUid : this.userId;
    const signalPath = `rooms/${this.roomCode}/webcamSignals/${initiatorUid}/${receiverUid}`;

    if (isInitiator) {
      // INITIATOR FLOW
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          push(ref(database, `${signalPath}/initiatorCandidates`), e.candidate.toJSON());
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await set(ref(database, `${signalPath}/offer`), offer.toJSON());
        } catch (err) {
          console.error('[WebcamMesh] Error creating offer:', err);
        }
      };

      const answerRef = ref(database, `${signalPath}/answer`);
      const answerUnsub = onValue(answerRef, async (snap) => {
        if (!snap.exists() || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
        } catch (err) {
          console.error('[WebcamMesh] Error setting remote description (answer):', err);
        }
      });
      this.unsubscribers.get(peerUid)?.push(() => off(answerRef, 'value', answerUnsub as any));

      const recCandRef = ref(database, `${signalPath}/receiverCandidates`);
      const recCandUnsub = onValue(recCandRef, (snap) => {
        snap.forEach((child) => {
          const candidateData = child.val();
          pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
        });
      });
      this.unsubscribers.get(peerUid)?.push(() => off(recCandRef, 'value', recCandUnsub as any));

    } else {
      // RECEIVER FLOW
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          push(ref(database, `${signalPath}/receiverCandidates`), e.candidate.toJSON());
        }
      };

      const offerRef = ref(database, `${signalPath}/offer`);
      const offerUnsub = onValue(offerRef, async (snap) => {
        if (!snap.exists() || pc.signalingState !== 'stable') return;
        try {
          const offer = snap.val();
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(ref(database, `${signalPath}/answer`), answer.toJSON());
        } catch (err) {
          console.error('[WebcamMesh] Error handling offer:', err);
        }
      });
      this.unsubscribers.get(peerUid)?.push(() => off(offerRef, 'value', offerUnsub as any));

      const initCandRef = ref(database, `${signalPath}/initiatorCandidates`);
      const initCandUnsub = onValue(initCandRef, (snap) => {
        snap.forEach((child) => {
          const candidateData = child.val();
          pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
        });
      });
      this.unsubscribers.get(peerUid)?.push(() => off(initCandRef, 'value', initCandUnsub as any));
    }

    pc.onconnectionstatechange = () => {
      console.log(`[WebcamMesh] Connection state with ${peerUid}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`[WebcamMesh] Connection ${pc.connectionState} with ${peerUid}, reconnecting...`);
        setTimeout(() => {
          if (this.peers.has(peerUid)) {  // still should be connected
            this.reconnectPeer(peerUid);
          }
        }, 3000);
      }
    };
  }

  private disconnectPeer(peerUid: string) {
    console.log(`[WebcamMesh] Disconnecting peer ${peerUid}`);
    
    const pc = this.peers.get(peerUid);
    if (pc) {
      pc.close();
      this.peers.delete(peerUid);
    }

    const unsubs = this.unsubscribers.get(peerUid);
    if (unsubs) {
      unsubs.forEach((fn) => fn());
      this.unsubscribers.delete(peerUid);
    }

    const isInitiator = this.userId < peerUid;
    if (isInitiator) {
      const initiatorUid = this.userId;
      const receiverUid = peerUid;
      remove(ref(database, `rooms/${this.roomCode}/webcamSignals/${initiatorUid}/${receiverUid}`));
    }

    this.onStreamChange(peerUid, null);
  }

  cleanup() {
    console.log('[WebcamMesh] Cleaning up all connections');
    Array.from(this.peers.keys()).forEach((peerUid) => {
      this.disconnectPeer(peerUid);
    });
  }
}
