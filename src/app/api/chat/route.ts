import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPage } from '@/lib/playwright';
import path from 'path';
import { Serialized } from '@langchain/core/load/serializable';
import { BaseMessage } from '@langchain/core/messages';

const navigate = tool(
  async ({ url }: { url: string }) => {
    console.log(`[Tool Call] navigate: Navigating to ${url}`);
    const page = await getPage();
    await page.goto(url);
    const response = `Navigated to ${url}`;
    console.log(`[Tool Result] navigate: ${response}`);
    return response;
  },
  {
    name: 'navigate',
    description: 'Navigates to a specific URL in the web browser.',
    schema: z.object({
      url: z.string().describe('The fully qualified URL to navigate to (e.g., https://www.google.com).'),
    }),
  }
);

const click = tool(
  async ({ selector }: { selector: string }) => {
    console.log(`[Tool Call] click: Clicking on ${selector}`);
    const page = await getPage();
    await page.click(selector);
    const response = `Clicked on ${selector}`;
    console.log(`[Tool Result] click: ${response}`);
    return response;
  },
  {
    name: 'click',
    description: 'Clicks on a specific element on the current web page, such as a button or a link.',
    schema: z.object({
      selector: z.string().describe('The CSS selector to identify the element to click (e.g., `#submit-button`, `.product-link`).'),
    }),
  }
);

const fill = tool(
  async ({ selector, value }: { selector: string; value: string }) => {
    console.log(`[Tool Call] fill: Filling ${selector} with '${value}'`);
    const page = await getPage();
    await page.fill(selector, value);
    const response = `Filled ${selector} with ${value}`;
    console.log(`[Tool Result] fill: ${response}`);
    return response;
  },
  {
    name: 'fill',
    description: 'Fills a form field on the current web page with a specified value.',
    schema: z.object({
      selector: z.string().describe('The CSS selector for the input field to fill (e.g., `input[name="username"]`).'),
      value: z.string().describe('The text to enter into the field.'),
    }),
  }
);

const screenshot = tool(
  async ({ selector }: { selector?: string }) => {
    console.log(`[Tool Call] screenshot: Taking a screenshot of ${selector || 'the full page'}`);
    const page = await getPage();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filePath = path.join(process.cwd(), 'public', filename);

    if (selector) {
      const element = await page.waitForSelector(selector);
      await element.screenshot({ path: filePath });
    } else {
      await page.screenshot({ path: filePath, fullPage: true });
    }

    const publicPath = `/${filename}`;
    const response = `Screenshot saved to ${publicPath}`;
    console.log(`[Tool Result] screenshot: ${response}`);
    return response;
  },
  {
    name: 'screenshot',
    description: 'Takes a screenshot of the current page. Can capture a specific element if a selector is provided, otherwise captures the full page.',
    schema: z.object({
      selector: z.string().optional().describe('The CSS selector of the element to capture. If omitted, the entire page will be captured.'),
    }),
  }
);

const read = tool(
  async ({ selector }: { selector: string }) => {
    console.log(`[Tool Call] read: Reading text from ${selector}`);
    const page = await getPage();
    const text = await page.textContent(selector);
    console.log(`[Tool Result] read: Found text - "${text}"`);
    return text;
  },
  {
    name: 'read',
    description: 'Reads the text content from a specific element on the current web page.',
    schema: z.object({
      selector: z.string().describe('The CSS selector of the element to read text from (e.g., `h1`, `.article-body`).'),
    }),
  }
);

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE,
  },
  modelName: process.env.MODEL_NAME,
  streaming: true,
});

const systemPrompt = `You are a web browsing assistant. Your primary purpose is to use the provided tools to navigate and interact with web pages to answer user questions and perform tasks.

You should break down complex tasks into a series of smaller, logical steps. For each step, think about which tool is most appropriate.

- Use the 'navigate' tool to go to a specific webpage.
- Use the 'click' tool to interact with buttons, links, or other clickable elements.
- Use the 'fill' tool to enter text into form fields like search bars or login forms.
- Use the 'read' tool to extract text content from elements on the page.
- Use the 'screenshot' tool to take a picture of the current browser view. This is useful for visual confirmation or debugging.

Always analyze the result of a tool call (the 'Observation') to determine the next action. If you have gathered enough information, provide the final answer. If not, continue using the tools until you can answer the user's question.`;

const agent = createReactAgent({
  llm: model,
  tools: [navigate, click, fill, read, screenshot],
  prompt: systemPrompt,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        const agentMessages = messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));

        const result = await agent.invoke(
          { messages: agentMessages as BaseMessage[] },
          {
            callbacks: [
              {
                handleLLMNewToken(token: string) {
                  send({ type: 'token', value: token });
                },
                handleToolStart(tool: Serialized, input: string) {
                  send({ type: 'tool-start', tool: tool.name, input });
                },
                handleToolEnd(output: string) {
                  send({ type: 'tool-end', output });
                },
              },
            ],
          }
        );
        const lastMessage = result.messages[result.messages.length - 1];
        send({ type: 'final', result: lastMessage.content });
      } catch (e: any) {
        console.error('[API Error]', e);
        send({ type: 'error', error: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
  } catch (e: any) {
    console.error('[API] Error in POST handler:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}