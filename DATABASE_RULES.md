# Firebase Realtime Database Rules Guide

This document describes the security rules structure for the Firebase Realtime Database of the **NASA Watch Party** application, ensuring secure room creation, chat messages, playback synchronization, and WebRTC signaling.

## Rule Configuration (`database.rules.json`)

To apply these rules, paste the following JSON into your Firebase Console under **Realtime Database → Rules**:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "members": {
          "$uid": {
            ".write": true
          }
        },
        "messages": {
          ".write": true
        },
        "playback": {
          ".write": true
        },
        "streamUrl": {
          ".write": true
        },
        "embedUrl": {
          ".write": true
        },
        "watchMode": {
          ".write": true
        },
        "streamQueue": {
          ".write": true
        }
      }
    }
  }
}
```

## Security Breakdown

| Path | Read | Write | Rationale |
|---|---|---|---|
| `rooms/$roomCode` | **Public** | **Public** | Anyone can join a room using a 6-digit code. Guests and authenticated users can write to room objects. |
| `rooms/$roomCode/members/$uid` | **Public** | **Public** | Anyone can update their own status (avatar, displayName, mic/cam toggle, connection state). |
| `rooms/$roomCode/messages` | **Public** | **Public** | Chat messages are writeable by any room participant. |
| `rooms/$roomCode/playback` | **Public** | **Public** | Playback states (play/pause/seek) are updateable by the host or other members. |
| `rooms/$roomCode/streamUrl` | **Public** | **Public** | Video source URLs can be updated by room members. |
| `rooms/$roomCode/embedUrl` | **Public** | **Public** | Iframe embeds can be updated by room members. |
| `rooms/$roomCode/watchMode` | **Public** | **Public** | Toggling room play sync modes is accessible by room members. |
| `rooms/$roomCode/streamQueue` | **Public** | **Public** | DJ Stream queue registration is accessible by room members. |

## Deploying Rules via Firebase CLI

If you have the Firebase CLI configured, you can deploy the database rules directly using:

```bash
firebase deploy --only database
```
