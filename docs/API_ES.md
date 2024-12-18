# Documentación del Sistema de Presencia WebSocket

## Descripción General
Este Sistema de Presencia basado en WebSocket proporciona gestión de presencia de usuarios en tiempo real con monitoreo automático de la salud de las conexiones y recolección de métricas.

## Conexión WebSocket

### URL de Conexión
```
ws://tu-dominio:3000?userId={userId}
```

### Parámetros de Conexión
- `userId` (requerido): Identificador único para el usuario que se conecta

### Estados de Conexión
- `CONNECTING`: Estado inicial cuando el WebSocket se está conectando
- `OPEN`: Conexión establecida exitosamente
- `CLOSING`: Conexión en proceso de cierre
- `CLOSED`: Conexión cerrada o fallida

## Tipos de Mensajes

### 1. Mensajes de Conexión

#### CONNECT
Enviado por el servidor cuando la conexión es exitosa.
```json
{
  "type": "CONNECT",
  "userId": "user123",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

#### DISCONNECT
Enviado por el cliente para iniciar una desconexión controlada.
```json
{
  "type": "DISCONNECT",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

### 2. Mensajes de Presencia

#### PRESENCE_UPDATE
Actualiza el estado de presencia del usuario.
```json
{
  "type": "PRESENCE_UPDATE",
  "payload": {
    "status": "online | away | busy",
    "metadata": {
      // Metadatos personalizados opcionales
    }
  },
  "timestamp": "2024-12-18T10:00:00Z"
}
```

### 3. Mensajes de Verificación de Salud

#### HEARTBEAT
Enviado por el cliente para mantener la conexión activa.
```json
{
  "type": "HEARTBEAT",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

#### HEARTBEAT_ACK
Respuesta del servidor al heartbeat.
```json
{
  "type": "HEARTBEAT_ACK",
  "timestamp": "2024-12-18T10:00:00Z"
}
```

## Endpoints HTTP

### Endpoint de Métricas
```
GET /metrics
```
Retorna métricas en formato Prometheus sobre conexiones WebSocket y rendimiento.

### Verificación de Salud
```
GET /health
```
Retorna el estado de salud del servidor.

Respuesta:
```json
{
  "status": "OK",
  "timestamp": "2024-12-18T10:00:00Z",
  "uptime": 3600
}
```

## Manejo de Errores

### Códigos de Error
- `1000`: Cierre normal
- `1002`: Error de protocolo (userId faltante)
- `1011`: Error interno del servidor

### Errores de Conexión
- `userId` inválido: La conexión será rechazada
- Heartbeat faltante: La conexión se terminará después del tiempo de espera
- Error del servidor: La conexión se cerrará con código 1011

## Métricas

### Métricas Disponibles
- `ws_connections_total`: Contador total de conexiones WebSocket
- `ws_connections_current`: Medidor de conexiones activas actuales
- `ws_messages_total`: Contador total de mensajes
- `ws_errors_total`: Contador de errores
- `ws_clients_current`: Medidor de clientes únicos actuales
- `ws_message_size_bytes`: Histograma de tamaño de mensajes
- `ws_latency_seconds`: Histograma de latencia de mensajes

## Ejemplo de Implementación (Flutter)

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
    // Manejar diferentes tipos de mensajes
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

## Mejores Prácticas

1. **Gestión de Conexiones**
   - Implementar siempre mecanismo de heartbeat
   - Manejar reconexiones de forma elegante
   - Limpiar recursos al desconectar

2. **Manejo de Errores**
   - Implementar retroceso exponencial para reconexiones
   - Registrar y monitorear errores de conexión
   - Proporcionar feedback al usuario sobre el estado de la conexión

3. **Actualizaciones de Presencia**
   - Actualizar presencia antes de que la app pase a segundo plano
   - Manejar cambios de red apropiadamente
   - Cachear último estado conocido

4. **Rendimiento**
   - Monitorear tamaños de mensajes
   - Implementar cola de mensajes si es necesario
   - Manejar transiciones de primer/segundo plano

## Consideraciones de Seguridad

1. Usar SSL/TLS en producción
2. Validar credenciales de usuario antes de aceptar conexiones
3. Implementar límites de tasa
4. Sanear todos los payloads de mensajes