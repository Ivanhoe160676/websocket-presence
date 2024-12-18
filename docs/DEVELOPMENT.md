# Guía de Desarrollo

## Estructura del Proyecto

```
websocket-presence/
├── src/
│   ├── config/          # Configuraciones
│   ├── core/            # Lógica principal
│   │   ├── presence/    # Servicio de presencia
│   │   └── websocket/   # Servidor WebSocket
│   ├── public/          # Archivos estáticos
│   ├── services/        # Servicios compartidos
│   ├── tests/           # Tests
│   ├── types/           # Tipos TypeScript
│   └── utils/           # Utilidades
├── docs/                # Documentación
└── monitoring/          # Configuración de monitoreo
```

## Flujo de Desarrollo

1. **Preparar Entorno**
```bash
npm install
npm run dev
```

2. **Hacer Cambios**
- Seguir guías de estilo
- Mantener tipos TypeScript
- Agregar tests cuando sea necesario

3. **Verificar Cambios**
```bash
npm run lint
npm run test
npm run build
```

## Convenciones de Código

### TypeScript
- Usar tipos explícitos
- Evitar `any`
- Documentar interfaces públicas

### Mensajes de Commit
```
feat: nueva característica
fix: corrección de error
docs: cambios en documentación
style: cambios de formato
refactor: refactorización de código
test: agregar o modificar tests
chore: cambios en build o herramientas
```

## Tests

### Ejecutar Tests
```bash
# Todos los tests
npm run test

# Tests específicos
npm run test:unit
npm run test:integration

# Cobertura
npm run test:coverage
```

### Escribir Tests
```typescript
describe('WebSocketServer', () => {
  it('should handle new connections', () => {
    // Configuración
    // Prueba
    // Verificación
  });
});
```

## Métricas y Monitoreo

### Métricas Disponibles
- Conexiones
- Mensajes
- Errores
- Latencia

### Dashboards
- Grafana incluido en `monitoring/`
- Prometheus configurado

## CI/CD

### GitHub Actions
- Tests automáticos
- Análisis de código
- Build y release

### Despliegue
```bash
# Staging
npm run deploy:staging

# Producción
npm run deploy:prod
```

## Debugging

### Logs
```bash
# Desarrollo
npm run dev

# Producción
npm run start
```

### Métricas en Desarrollo
```bash
curl http://localhost:3000/metrics
```

## Contribuciones

1. Crear rama feature/fix
2. Desarrollar cambios
3. Ejecutar tests
4. Crear Pull Request
5. Esperar revisión

## Recursos

- [Documentación API](./API.md)
- [Documentación API (ES)](./API_ES.md)
- [Guía de Instalación](./INSTALL.md)