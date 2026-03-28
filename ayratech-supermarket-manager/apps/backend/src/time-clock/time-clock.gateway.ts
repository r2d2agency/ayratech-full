import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'time-clock',
})
export class TimeClockGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('TimeClockGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-employee-room')
  handleJoinRoom(client: Socket, payload: { employeeId: string }) {
    client.join(`employee_${payload.employeeId}`);
    this.logger.log(`Client ${client.id} joined room employee_${payload.employeeId}`);
  }

  sendAlertToHR(alert: any) {
    this.server.emit('hr-alert', alert);
  }

  sendAlertToEmployee(employeeId: string, alert: any) {
    // In a real app, you'd map employeeId to socketId(s)
    // For now, we broadcast to a specific room based on employeeId
    this.server.to(`employee_${employeeId}`).emit('employee-alert', alert);
  }
}
