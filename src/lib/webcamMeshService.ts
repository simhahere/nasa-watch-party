'use client';

import { database } from './firebase';
import { ref, set, onValue, off, remove, push } from 'firebase/database';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
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
  private lastMembers: Record<string, any> = {};

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
    
    if (this.lastMembers) {
      this.updateMembers(this.lastMembers);
    }

    // Replace tracks on existing connections seamlessly without renegotiation
    this.peers.forEach((pc, peerUid) => {
      const transceivers = pc.getTransceivers();
      const audioTransceiver = transceivers.find(t => t.receiver.track.kind === 'audio');
      const videoTransceiver = transceivers.find(t => t.receiver.track.kind === 'video');

      const audioTrack = stream?.getAudioTracks()[0] || null;
      const videoTrack = stream?.getVideoTracks()[0] || null;

      if (audioTransceiver?.sender) {
        console.log(`[WebcamMesh] Replacing audio track for ${peerUid}. Active:`, !!audioTrack);
        audioTransceiver.sender.replaceTrack(audioTrack).catch(err => 
          console.warn(`[WebcamMesh] replaceTrack audio failed for ${peerUid}:`, err)
        );
      }
      if (videoTransceiver?.sender) {
        console.log(`[WebcamMesh] Replacing video track for ${peerUid}. Active:`, !!videoTrack);
        videoTransceiver.sender.replaceTrack(videoTrack).catch(err => 
          console.warn(`[WebcamMesh] replaceTrack video failed for ${peerUid}:`, err)
        );
      }
    });
  }

  // Update room members list and presence
  updateMembers(members: Record<string, any>) {
    const currentMembers = members || {};
    
    Object.entries(currentMembers).forEach(([peerUid, member]) => {
      if (peerUid === this.userId) return;

      // Connect if peer is online
      const shouldConnect = member.online;
      const hasConnection = this.peers.has(peerUid);

      if (shouldConnect && !hasConnection) {
        this.connectPeer(peerUid);
      } else if (!shouldConnect && hasConnection) {
        this.disconnectPeer(peerUid);
      }
    });

    // Cleanup peers that are no longer online
    Array.from(this.peers.keys()).forEach((peerUid) => {
      const member = currentMembers[peerUid];
      if (!member || !member.online) {
        this.disconnectPeer(peerUid);
      }
    });

    this.lastMembers = { ...currentMembers };
  }

  private connectPeer(peerUid: string) {
    if (this.peers.has(peerUid)) return;

    const isInitiator = this.userId < peerUid;
    console.log(`[WebcamMesh] Connecting to peer ${peerUid}. Initiator: ${isInitiator}`);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerUid, pc);
    this.unsubscribers.set(peerUid, []);

    // Create persistent transceivers for audio and video
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    const remoteStream = new MediaStream();

    // When remote track arrives
    pc.ontrack = (e) => {
      console.log(`[WebcamMesh] Received track from peer ${peerUid}:`, e.track.kind);
      // Only add to remoteStream if it's not already there
      if (!remoteStream.getTracks().find(t => t.id === e.track.id)) {
        remoteStream.addTrack(e.track);
      }
      this.onStreamChange(peerUid, remoteStream);
    };

    // Add local tracks to the established transceivers if they exist
    if (this.localStream) {
      const senders = pc.getSenders();
      this.localStream.getTracks().forEach((track) => {
        const sender = senders.find(s => 
          s.track?.kind === track.kind || 
          (!s.track && pc.getTransceivers().find(t => t.sender === s)?.receiver.track.kind === track.kind)
        );
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        }
      });
    }

    const initiatorUid = isInitiator ? this.userId : peerUid;
    const receiverUid = isInitiator ? peerUid : this.userId;
    const signalPath = `rooms/${this.roomCode}/webcamSignals/${initiatorUid}/${receiverUid}`;

    const queuedCandidates: any[] = [];
    let isRemoteDescriptionSet = false;

    const processQueuedCandidates = () => {
      queuedCandidates.forEach(cand => {
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      });
      queuedCandidates.length = 0;
    };

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
          await set(ref(database, `${signalPath}/offer`), { sdp: offer.sdp, type: offer.type });
        } catch (err) {
          console.error('[WebcamMesh] Error creating offer:', err);
        }
      };

      const answerRef = ref(database, `${signalPath}/answer`);
      const answerUnsub = onValue(answerRef, async (snap) => {
        if (pc.signalingState === 'closed') return;
        if (!snap.exists() || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
          isRemoteDescriptionSet = true;
          processQueuedCandidates();
        } catch (err) {
          console.error('[WebcamMesh] Error setting remote description (answer):', err);
        }
      });
      this.unsubscribers.get(peerUid)?.push(() => off(answerRef, 'value', answerUnsub as any));

      const recCandRef = ref(database, `${signalPath}/receiverCandidates`);
      const recCandUnsub = onValue(recCandRef, (snap) => {
        if (pc.signalingState === 'closed') return;
        snap.forEach((child) => {
          const candidateData = child.val();
          if (isRemoteDescriptionSet) {
            pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
          } else {
            queuedCandidates.push(candidateData);
          }
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
        if (pc.signalingState === 'closed') return;
        if (!snap.exists() || pc.signalingState !== 'stable') return;
        try {
          const offer = snap.val();
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          isRemoteDescriptionSet = true;
          processQueuedCandidates();
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(ref(database, `${signalPath}/answer`), { sdp: answer.sdp, type: answer.type });
        } catch (err) {
          console.error('[WebcamMesh] Error handling offer:', err);
        }
      });
      this.unsubscribers.get(peerUid)?.push(() => off(offerRef, 'value', offerUnsub as any));

      const initCandRef = ref(database, `${signalPath}/initiatorCandidates`);
      const initCandUnsub = onValue(initCandRef, (snap) => {
        if (pc.signalingState === 'closed') return;
        snap.forEach((child) => {
          const candidateData = child.val();
          if (isRemoteDescriptionSet) {
            pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
          } else {
            queuedCandidates.push(candidateData);
          }
        });
      });
      this.unsubscribers.get(peerUid)?.push(() => off(initCandRef, 'value', initCandUnsub as any));
    }

    pc.onconnectionstatechange = () => {
      console.log(`[WebcamMesh] Connection state with ${peerUid}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`[WebcamMesh] Connection failed/disconnected with ${peerUid}, cleaning up/reconnecting...`);
        this.disconnectPeer(peerUid);
        setTimeout(() => {
          if (this.lastMembers[peerUid]?.online) {
            this.connectPeer(peerUid);
          }
        }, 2000);
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
      remove(ref(database, `rooms/${this.roomCode}/webcamSignals/${this.userId}/${peerUid}`));
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
