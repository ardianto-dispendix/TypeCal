const fs = require('fs');
const path = require('path');

const NOTION_VERSION = '2022-06-28';
const DEFAULT_NOTION_TASKS_DB_ID = '2f814c6293768041aae0fd1f4bc027db';
const CONFIG_FILENAME = 'typecal.config.json';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getConfigPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readConfig(app) {
  try {
    const configPath = getConfigPath(app);
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read config', error);
    return {};
  }
}

function writeConfig(app, partial) {
  const current = readConfig(app);
  const next = { ...current, ...partial };
  const configPath = getConfigPath(app);
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

async function notionRequest(pathname, body, apiKey) {
  if (typeof fetch === 'function') {
    const response = await fetch(`https://api.notion.com${pathname}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion API error (${response.status}): ${text}`);
    }

    return response.json();
  }

  const https = require('https');
  const data = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.notion.com',
        path: pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION,
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => (raw += chunk));
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(new Error(`Notion API error (${response.statusCode}): ${raw}`));
          }
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function fetchTodayOpenTasks(app) {
  const config = readConfig(app);
  const apiKey = process.env.NOTION_API_KEY || config.notionApiKey;
  if (!apiKey) {
    throw new Error('Missing NOTION_API_KEY');
  }

  const databaseId = process.env.NOTION_TASKS_DB_ID || config.notionTasksDbId || DEFAULT_NOTION_TASKS_DB_ID;
  const today = formatLocalDate(new Date());
  const query = {
    filter: {
      and: [
        {
          property: 'Status',
          status: { equals: 'open' },
        },
        {
          property: 'Due',
          date: { equals: today },
        }
      ],
    }
  };

  const data = await notionRequest(`/v1/databases/${databaseId}/query`, query, apiKey);

  return (data.results || []).map((page) => {
    const props = page.properties || {};
    const titleParts = props.task?.title || [];
    const title = titleParts.map((part) => part.plain_text).join('') || 'Untitled';
    const due = props.Due?.date?.start || '';
    const status = props.Status?.status?.name || '';
    let project = '';
    if (props.Projects?.select?.name) {
      project = props.Projects.select.name;
    } else if (Array.isArray(props.Projects?.multi_select)) {
      project = props.Projects.multi_select.map((item) => item.name).join(', ');
    }

    return {
      id: page.id,
      title,
      due,
      status,
      project,
    };
  });
}

function registerNotionIpc(app, ipcMain) {
  ipcMain.handle('notion:getConfig', () => {
    const config = readConfig(app);
    return {
      notionApiKey: config.notionApiKey ? 'set' : '',
      notionTasksDbId: config.notionTasksDbId || '',
    };
  });
  ipcMain.handle('notion:setConfig', (event, partial) => {
    const allowed = {
      notionApiKey: typeof partial?.notionApiKey === 'string' ? partial.notionApiKey.trim() : undefined,
      notionTasksDbId: typeof partial?.notionTasksDbId === 'string' ? partial.notionTasksDbId.trim() : undefined,
    };
    const sanitized = {};
    if (allowed.notionApiKey) sanitized.notionApiKey = allowed.notionApiKey;
    if (allowed.notionTasksDbId) sanitized.notionTasksDbId = allowed.notionTasksDbId;
    const next = writeConfig(app, sanitized);
    return {
      notionApiKey: next.notionApiKey ? 'set' : '',
      notionTasksDbId: next.notionTasksDbId || '',
    };
  });
  ipcMain.handle('notion:getTodayOpenTasks', async () => {
    return fetchTodayOpenTasks(app);
  });
}

module.exports = {
  registerNotionIpc,
};
