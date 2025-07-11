import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPage } from '@/lib/playwright';

const navigate = tool(
  async ({ url }: { url: string }) => {
    const page = await getPage();
    await page.goto(url);
    return `Navigated to ${url}`;
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL.',
    schema: z.object({
      url: z.string().describe('The URL to navigate to.'),
    }),
  }
);

const click = tool(
  async ({ selector }: { selector: string }) => {
    const page = await getPage();
    await page.click(selector);
    return `Clicked on ${selector}`;
  },
  {
    name: 'click',
    description: 'Click on an element.',
    schema: z.object({
      selector: z.string().describe('The CSS selector of the element to click.'),
    }),
  }
);

const fill = tool(
  async ({ selector, value }: { selector: string; value: string }) => {
    const page = await getPage();
    await page.fill(selector, value);
    return `Filled ${selector} with ${value}`;
  },
  {
    name: 'fill',
    description: 'Fill an input field.',
    schema: z.object({
      selector: z.string().describe('The CSS selector of the input field.'),
      value: z.string().describe('The value to fill.'),
    }),
  }
);

const read = tool(
  async ({ selector }: { selector: string }) => {
    const page = await getPage();
    const text = await page.textContent(selector);
    return text;
  },
  {
    name: 'read',
    description: 'Read the text content of an element.',
    schema: z.object({
      selector: z.string().describe('The CSS selector of the element to read.'),
    }),
  }
);

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE,
  },
  modelName: process.env.MODEL_NAME,
});

const agent = createReactAgent({
  llm: model,
  tools: [navigate, click, fill, read],
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    const result = await agent.invoke({
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const lastMessage = result.messages[result.messages.length - 1];

    return NextResponse.json({ message: lastMessage.content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}