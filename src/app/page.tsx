'use client';

import { useState, FormEvent } from 'react';

export default function Home() {
  const [messages, setMessages] = useState<{ role: string; content: string; id: string }[]>([]);
  const [input, setInput] = useState('');

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input) return;

    const userMessage = { role: 'user', content: input, id: Date.now().toString() };
    const newMessages = [...messages, userMessage, { role: 'assistant', content: '', id: (Date.now() + 1).toString() }];
    setMessages(newMessages);
    setInput('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [userMessage] }), // Only send the user message
    });

    if (!response.body) {
      console.error('Response body is null');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n');

        // The last part might be incomplete, so we keep it in the buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.trim() === '') continue;
          try {
            const obj = JSON.parse(part);
            if (obj.type === 'token') {
              setMessages(prev => prev.map((msg, index) => 
                index === prev.length - 1 
                  ? { ...msg, content: msg.content + obj.value } 
                  : msg
              ));
            } else if (obj.type === 'tool-start') {
              setMessages(prev => prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: msg.content + `\n> Calling tool: **${obj.tool}** with input: \`\`\`${JSON.stringify(obj.input)}\`\`\`` }
                  : msg
              ));
            } else if (obj.type === 'tool-end') {
              setMessages(prev => prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: msg.content + `\n> Tool returned: \`\`\`${obj.output}\`\`\`\n` }
                  : msg
              ));
            } else if (obj.type === 'final') {
              setMessages(prev => prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: obj.result }
                  : msg
              ));
            } else if (obj.type === 'error') {
              setMessages(prev => prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: msg.content + `\n> Error: ${obj.error}` }
                  : msg
              ));
            }
          } catch (e) {
            console.error('Failed to parse JSON chunk', part, e);
          }
        }
      }
    };

    processStream();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-grow p-6 overflow-auto">
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg max-w-xs ${
                msg.role === 'user' ? 'bg-blue-500 text-white self-end' : 'bg-gray-300 text-black self-start'
              }`}>
              {msg.content}
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-6 bg-white border-t border-gray-200">
        <div className="flex rounded-lg border border-gray-300">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-grow px-4 py-2 bg-transparent focus:outline-none"
            placeholder="Type your message..."
          />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-r-lg">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
