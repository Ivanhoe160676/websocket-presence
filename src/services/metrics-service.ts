import client from 'prom-client';
import logger from './logger';

// Servicio de métricas que expone métricas detalladas de WebSocket
export class MetricsService {
  private registry: client.Registry; // Registro central de métricas
  public readonly contentType: string; // Tipo de contenido de las métricas

  // Contadores básicos para eventos de WebSocket
  private readonly wsConnectionsTotal: client.Counter<string>;
  private readonly wsMessagesTotal: client.Counter<string>;
  private readonly wsErrorsTotal: client.Counter<string>;

  // Medidores de estado actual del servidor WebSocket
  private readonly wsConnectionsGauge: client.Gauge<string>;
  private readonly wsClientsGauge: client.Gauge<string>;
  private readonly wsMemoryUsageGauge: client.Gauge<string>;
  private readonly wsUptime: client.Gauge<string>;

  // Métricas de rendimiento de WebSocket
  private readonly wsLatencyHistogram: client.Histogram<string>;
  private readonly wsMessageSizeHistogram: client.Histogram<string>;
  private readonly wsReconnectionsHistogram: client.Histogram<string>;

  // Métricas de presencia de usuarios en WebSocket
  private readonly wsPresenceGauge: client.Gauge<string>;
  private readonly wsPresenceUpdatesCounter: client.Counter<string>;

  // Métricas de uso de recursos del sistema
  private readonly wsSystemResourceGauge: client.Gauge<string>;

  constructor() {
    // Inicializa el registro de métricas y el tipo de contenido para Prometheus
    this.registry = new client.Registry();
    this.contentType = client.register.contentType;

    // Inicialización de contadores para WebSocket
    this.wsConnectionsTotal = new client.Counter({
      name: 'ws_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['status', 'client_type', 'protocol_version'],
      registers: [this.registry]
    });

    this.wsMessagesTotal = new client.Counter({
      name: 'ws_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type', 'direction', 'status'],
      registers: [this.registry]
    });

    this.wsErrorsTotal = new client.Counter({
      name: 'ws_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['type', 'severity', 'source'],
      registers: [this.registry]
    });

    // Medidores de WebSocket (estado actual)
    this.wsConnectionsGauge = new client.Gauge({
      name: 'ws_connections_current',
      help: 'Current number of active WebSocket connections',
      labelNames: ['status', 'client_type'],
      registers: [this.registry]
    });

    this.wsClientsGauge = new client.Gauge({
      name: 'ws_clients_current',
      help: 'Current number of unique clients',
      labelNames: ['status', 'client_type', 'authentication_status'],
      registers: [this.registry]
    });

    this.wsMemoryUsageGauge = new client.Gauge({
      name: 'ws_memory_usage_bytes',
      help: 'Current memory usage of the WebSocket server',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.wsUptime = new client.Gauge({
      name: 'ws_server_uptime_seconds',
      help: 'Server uptime in seconds',
      registers: [this.registry]
    });

    // Inicialización de histogramas para métricas de rendimiento
    this.wsMessageSizeHistogram = new client.Histogram({
      name: 'ws_message_size_bytes',
      help: 'Size of WebSocket messages in bytes',
      buckets: [64, 128, 256, 512, 1024, 2048, 4096, 8192],
      labelNames: ['type', 'direction'],
      registers: [this.registry]
    });

    this.wsLatencyHistogram = new client.Histogram({
      name: 'ws_latency_seconds',
      help: 'WebSocket message latency in seconds',
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      labelNames: ['operation_type'],
      registers: [this.registry]
    });

    this.wsReconnectionsHistogram = new client.Histogram({
      name: 'ws_reconnections_count',
      help: 'Number of reconnection attempts',
      buckets: [1, 2, 3, 5, 10, 15, 20],
      labelNames: ['client_id', 'reason'],
      registers: [this.registry]
    });

    // Métricas de presencia
    this.wsPresenceGauge = new client.Gauge({
      name: 'ws_presence_status',
      help: 'Current presence status of users',
      labelNames: ['status', 'client_type'],
      registers: [this.registry]
    });

    this.wsPresenceUpdatesCounter = new client.Counter({
      name: 'ws_presence_updates_total',
      help: 'Total number of presence status updates',
      labelNames: ['type', 'status'],
      registers: [this.registry]
    });

    // Métricas de recursos del sistema
    this.wsSystemResourceGauge = new client.Gauge({
      name: 'ws_system_resources',
      help: 'System resource usage',
      labelNames: ['resource_type'],
      registers: [this.registry]
    });

    // Inicializa la recolección de métricas del sistema
    logger.info('Enhanced metrics service initialized');
    this.startCollectingSystemMetrics();
  }

  // Método para observar métricas del sistema (e.g., CPU, memoria)
  public observeSystemMetrics(metric: string, value: number): void {
    this.wsSystemResourceGauge.set({ resource_type: metric }, value);
  }

  // Métodos para manejar conexiones de WebSocket
  public incrementConnections(status: string = 'success', clientType: string = 'unknown', protocolVersion: string = 'ws'): void {
    // Incrementa contadores de conexiones
    this.wsConnectionsTotal.inc({ status, client_type: clientType, protocol_version: protocolVersion });
    this.wsConnectionsGauge.inc({ status, client_type: clientType });
    logger.debug(`Metric incremented: connections (${status}, ${clientType}, ${protocolVersion})`);
  }

  public decrementConnections(clientType: string = 'unknown'): void {
    // Disminuye el contador de conexiones
    this.wsConnectionsGauge.dec({ client_type: clientType });
    logger.debug(`Connection decremented for client type: ${clientType}`);
  }

  // Métodos para manejar mensajes de WebSocket
  public incrementMessages(type: string, direction: 'inbound' | 'outbound', status: 'success' | 'error' = 'success'): void {
    // Incrementa contadores de mensajes
    this.wsMessagesTotal.inc({ type, direction, status });
    logger.debug(`Message metric incremented: ${type}, ${direction}, ${status}`);
  }

  // Métodos para manejar errores de WebSocket
  public incrementErrors(type: string, severity: 'low' | 'medium' | 'high', source: string): void {
    // Incrementa contadores de errores
    this.wsErrorsTotal.inc({ type, severity, source });
    logger.error(`Error metric incremented: ${type}, ${severity}, ${source}`);
  }

  // Métodos para manejar clientes
  public updateClients(status: string, clientType: string, authStatus: string, count: number): void {
    // Actualiza el número de clientes
    this.wsClientsGauge.set({ 
      status, 
      client_type: clientType, 
      authentication_status: authStatus 
    }, count);
    logger.debug(`Client count updated: ${status}, ${clientType}, ${authStatus}: ${count}`);
  }

  // Métodos de presencia
  public updatePresence(status: string, clientType: string, count: number): void {
    // Actualiza el estado de presencia
    this.wsPresenceGauge.set({ status, client_type: clientType }, count);
  }

  public incrementPresenceUpdates(type: string, status: string): void {
    // Incrementa el contador de actualizaciones de presencia
    this.wsPresenceUpdatesCounter.inc({ type, status });
  }

  // Métodos de rendimiento
  public observeLatency(operation: string, seconds: number): void {
    // Observa la latencia de WebSocket
    this.wsLatencyHistogram.observe({ operation_type: operation }, seconds);
  }

  public observeMessageSize(type: string, direction: 'inbound' | 'outbound', bytes: number): void {
    // Observa el tamaño de los mensajes de WebSocket
    this.wsMessageSizeHistogram.observe({ type, direction }, bytes);
  }

  public observeReconnection(clientId: string, reason: string): void {
    // Observa intentos de reconexión
    this.wsReconnectionsHistogram.observe({ client_id: clientId, reason }, 1);
  }

  // Métodos de sistema
  private startCollectingSystemMetrics(): void {
    // Recolecta métricas del sistema (memoria, CPU, etc.) cada 5 segundos
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.wsMemoryUsageGauge.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
      this.wsMemoryUsageGauge.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
      this.wsMemoryUsageGauge.set({ type: 'rss' }, memoryUsage.rss);

      this.wsUptime.set(process.uptime());

      // Recolecta el uso de CPU
      this.wsSystemResourceGauge.set({ resource_type: 'cpu_usage' }, process.cpuUsage().user / 1000000);
    }, 5000); // Actualiza cada 5 segundos
  }

  // Método para registrar el inicio del servidor
  public recordStartup(): void {
    this.wsUptime.set(0);
    logger.info('Server startup recorded');
  }

  // Obtener las métricas de Prometheus
  public async getMetrics(): Promise<string> {
    try {
      const metrics = await this.registry.metrics();
      logger.debug('Metrics collected successfully');
      return metrics;
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      throw new Error('Failed to collect metrics');
    }
  }

  // Limpiar las métricas
  public async clearMetrics(): Promise<void> {
    try {
      await this.registry.clear();
      logger.info('Metrics cleared successfully');
    } catch (error) {
      logger.error('Error clearing metrics:', error);
      throw new Error('Failed to clear metrics');
    }
  }
}

// Instancia del servicio de métricas
export const metricsService = new MetricsService();
