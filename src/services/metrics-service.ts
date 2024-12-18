// src/services/metrics-service.ts
import client from 'prom-client';
import logger from './logger';

export class MetricsService {
  private registry: client.Registry;
  public readonly contentType: string;  
  
  // Contadores básicos
  private readonly wsConnectionsTotal: client.Counter<string>;
  private readonly wsMessagesTotal: client.Counter<string>;
  private readonly wsErrorsTotal: client.Counter<string>;
  
  // Medidores de estado actual
  private readonly wsConnectionsGauge: client.Gauge<string>;
  private readonly wsClientsGauge: client.Gauge<string>;
  
  // Métricas de rendimiento
  private readonly wsLatencyHistogram: client.Histogram<string>;
  private readonly wsMessageSizeHistogram: client.Histogram<string>;

  constructor() {
    this.registry = new client.Registry();
    this.contentType = client.register.contentType;

    // Contadores
    this.wsConnectionsTotal = new client.Counter({
      name: 'ws_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['status'],
      registers: [this.registry]
    });

    this.wsMessagesTotal = new client.Counter({
      name: 'ws_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.wsErrorsTotal = new client.Counter({
      name: 'ws_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['type'],
      registers: [this.registry]
    });

    // Medidores
    this.wsConnectionsGauge = new client.Gauge({
      name: 'ws_connections_current',
      help: 'Current number of active WebSocket connections',
      registers: [this.registry]
    });

    this.wsClientsGauge = new client.Gauge({
      name: 'ws_clients_current',
      help: 'Current number of unique clients',
      labelNames: ['status'],
      registers: [this.registry]
    });

    // Histograma de latencia

    this.wsMessageSizeHistogram = new client.Histogram({
      name: 'ws_message_size_bytes',
      help: 'Size of WebSocket messages in bytes',
      buckets: [64, 128, 256, 512, 1024, 2048, 4096],
      registers: [this.registry]
    });
    

    this.wsLatencyHistogram = new client.Histogram({
      name: 'ws_latency_seconds',
      help: 'WebSocket message latency in seconds',
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    logger.info('Metrics service initialized');
  }

  // Métodos para conexiones
  public incrementConnections(status: string = 'success'): void {
    this.wsConnectionsTotal.inc({ status });
    this.wsConnectionsGauge.inc();
    logger.debug(`Metric incremented: connections (${status})`);
  }

  public decrementConnections(): void {
    this.wsConnectionsGauge.dec();
  }

  // Métodos para mensajes
  public incrementMessages(type: string): void {
    this.wsMessagesTotal.inc({ type });
    logger.debug(`Metric incremented: messages (${type})`);
  }

  // Métodos para errores
  public incrementErrors(type: string): void {
    this.wsErrorsTotal.inc({ type });
  }

  // Métodos para clientes
  public updateClients(status: string, count: number): void {
    this.wsClientsGauge.set({ status }, count);
  }

  // Métodos para latencia
  public observeLatency(seconds: number): void {
    this.wsLatencyHistogram.observe(seconds);
  }

  public observeMessageSize(bytes: number): void {
    this.wsMessageSizeHistogram.observe(bytes);
  }

  // Obtener métricas
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metricsService = new MetricsService();