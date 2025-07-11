import { Message } from '@/lib/types';

interface MessageListProps {
  messages: (Omit<Message, 'id'> & { id?: string })[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}