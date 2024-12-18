# WebSocket Presence API Documentation

## Overview
This WebSocket-based Presence System provides real-time user presence management with automatic connection health monitoring and metrics collection.

## WebSocket Connection

### Connection URL
```
ws://your-domain:3000?userId={userId}
```

### Connection Parameters
- `userId` (required): Unique identifier for the connecting user

### Connection States
- `CONNECTING`: Initial state when WebSocket is connecting
- `OPEN`: Connection established successfully
- `CLOSING`: Connection is in the process of closing
- `CLOSED`: Connection has been closed or failed

## Message Types

### 1. Connection Messages

#### CONNECT
Sent by server upon successful connection.
```json
{
  "type": "CONNECT",
  "userId": "user123",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

#### DISCONNECT
Sent by client to initiate graceful disconnection.
```json
{
  "type": "DISCONNECT",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

### 2. Presence Messages

#### PRESENCE_UPDATE
Update user's presence status.
```json
{
  "type": "PRESENCE_UPDATE",
  "payload": {
    "status": "online | away | busy",
    "metadata": {
      // Optional custom metadata
    }
  },
  "timestamp": "2024-12-18T10:00:00Z"
}
```

### 3. Health Check Messages

#### HEARTBEAT
Sent by client to maintain connection.
```json
{
  "type": "HEARTBEAT",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

#### HEARTBEAT_ACK
Server response to heartbeat.
```json
{
  "type": "HEARTBEAT_ACK",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

## HTTP Endpoints

### Metrics Endpoint
```
GET /metrics
```
Returns Prometheus-formatted metrics about WebSocket connections and performance.

### Health Check
```
GET /health
```
Returns server health status.

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-12-18T10:00:00Z",
  "uptime": 3600
}
```

## Error Handling

### Error Codes
- `1000`: Normal closure
- `1002`: Protocol error (missing userId)
- `1011`: Internal server error

### Connection Errors
- Invalid `userId`: Connection will be rejected
- Missing heartbeat: Connection will be terminated after timeout
- Server error: Connection will be closed with code 1011

## Metrics

### Available Metrics
- `ws_connections_total`: Total WebSocket connections counter
- `ws_connections_current`: Current active connections gauge
- `ws_messages_total`: Total messages counter
- `ws_errors_total`: Error counter
- `ws_clients_current`: Current unique clients gauge
- `ws_message_size_bytes`: Message size histogram
- `ws_latency_seconds`: Message latency histogram

## Implementation Example (Flutter)

```dart
class PresenceWebSocket {
  final String baseUrl;
  final String userId;
  WebSocketChannel? _channel;
  Timer? _heartbeatTimer;
  
  PresenceWebSocket({
    required this.baseUrl,
    required this.userId,
  });

  Future<void> connect() async {
    final uri = Uri.parse('$baseUrl?userId=$userId');
    _channel = WebSocketChannel.connect(uri);
    
    _channel?.stream.listen(
      _handleMessage,
      onError: _handleError,
      onDone: _handleDone,
    );
    
    _startHeartbeat();
  }

  void _handleMessage(dynamic message) {
    final data = jsonDecode(message);
    // Handle different message types
  }
  
  void updatePresence(String status) {
    if (_channel == null) return;
    
    _channel?.sink.add(jsonEncode({
      'type': 'PRESENCE_UPDATE',
      'payload': {
        'status': status,
      },
      'timestamp': DateTime.now().toIso8601String(),
    }));
  }
  
  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(
      Duration(seconds: 15),
      (_) => _sendHeartbeat(),
    );
  }
  
  void dispose() {
    _heartbeatTimer?.cancel();
    _channel?.sink.close();
  }
}
```

## Best Practices

1. **Connection Management**
   - Always implement heartbeat mechanism
   - Handle reconnection gracefully
   - Clean up resources on disconnect

2. **Error Handling**
   - Implement exponential backoff for reconnections
   - Log and monitor connection errors
   - Provide user feedback on connection status

3. **Presence Updates**
   - Update presence before app goes to background
   - Handle network changes appropriately
   - Cache last known status

4. **Performance**
   - Monitor message sizes
   - Implement message queuing if needed
   - Handle background/foreground transitions

## Security Considerations

1. Use SSL/TLS in production
2. Validate user credentials before accepting connections
3. Implement rate limiting
4. Sanitize all message payloads