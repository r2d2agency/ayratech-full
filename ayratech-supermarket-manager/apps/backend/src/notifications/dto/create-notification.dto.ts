export class CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: string;
  relatedId?: string;
}
