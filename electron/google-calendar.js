const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'typecal.config.json';

function getConfigPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readConfig(app) {
  try {
    const configPath = getConfigPath(app);
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error('Failed to read config', error);
    return {};
  }
}

function writeConfig(app, partial) {
  const current = readConfig(app);
  const next = { ...current, ...partial };
  fs.writeFileSync(getConfigPath(app), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function readJsonFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} file: ${filePath || '(empty path)'}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function pickFirstExistingPath(paths, fallback) {
  for (const filePath of paths) {
    if (filePath && fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return fallback;
}

function getCredentialPaths(app) {
  const config = readConfig(app);
  const defaultCredentialsPath = path.join(app.getPath('userData'), 'credential.json');
  const defaultTokenPath = path.join(app.getPath('userData'), 'token.json');
  return {
    credentialsPath: pickFirstExistingPath(
      [
        process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH,
        config.googleCredentialsPath,
        defaultCredentialsPath,
        path.join(process.cwd(), 'credential.json'),
      ],
      config.googleCredentialsPath || defaultCredentialsPath
    ),
    tokenPath: pickFirstExistingPath(
      [
        process.env.GOOGLE_CALENDAR_TOKEN_PATH,
        config.googleTokenPath,
        defaultTokenPath,
        path.join(process.cwd(), 'token.json'),
      ],
      config.googleTokenPath || defaultTokenPath
    ),
  };
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google API error (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function getAccessToken(app) {
  const { credentialsPath, tokenPath } = getCredentialPaths(app);
  const credentials = readJsonFile(credentialsPath, 'Google credentials');
  const token = readJsonFile(tokenPath, 'Google token');
  const oauth = credentials.installed || credentials.web;

  if (!oauth?.client_id || !oauth?.client_secret) {
    throw new Error('Invalid Google credentials file: missing client_id/client_secret');
  }

  const now = Date.now();
  if (token.access_token && token.expiry_date && token.expiry_date > now + 60_000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error('Google token file has no refresh_token');
  }

  const refreshed = await refreshAccessToken(oauth.client_id, oauth.client_secret, token.refresh_token);
  if (!refreshed.access_token) {
    throw new Error('Failed to refresh Google access token');
  }

  const nextToken = {
    ...token,
    access_token: refreshed.access_token,
    token_type: refreshed.token_type || token.token_type || 'Bearer',
    scope: refreshed.scope || token.scope || '',
    expiry_date: now + Number(refreshed.expires_in || 3600) * 1000,
  };

  try {
    fs.writeFileSync(tokenPath, JSON.stringify(nextToken, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist refreshed Google token', error);
  }

  return nextToken.access_token;
}

async function fetchTodayEvents(app) {
  const token = await getAccessToken(app);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const calendarList = await requestJson(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const calendars = (calendarList.items || []).filter((calendar) => !calendar.deleted);
  const eventsByCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      try {
        const params = new URLSearchParams({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          showDeleted: 'false',
          maxResults: '250',
        });
        const events = await requestJson(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        return (events.items || []).map((event) => ({
          id: event.id,
          title: event.summary || '(No title)',
          calendarId: calendar.id,
          calendarName: calendar.summary || 'Calendar',
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || '',
          isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
        }));
      } catch (error) {
        console.error(`Failed to fetch events for calendar ${calendar.id}`, error);
        return [];
      }
    })
  );

  const allEvents = eventsByCalendar.flat();
  allEvents.sort((a, b) => {
    const aTime = Date.parse(a.start) || 0;
    const bTime = Date.parse(b.start) || 0;
    return aTime - bTime;
  });

  return allEvents;
}

function registerGoogleCalendarIpc(app, ipcMain) {
  ipcMain.handle('googleCalendar:getConfig', () => {
    const config = readConfig(app);
    return {
      googleCredentialsPath: config.googleCredentialsPath || '',
      googleTokenPath: config.googleTokenPath || '',
    };
  });

  ipcMain.handle('googleCalendar:setConfig', (event, partial) => {
    const next = writeConfig(app, {
      googleCredentialsPath:
        typeof partial?.googleCredentialsPath === 'string' ? partial.googleCredentialsPath.trim() : undefined,
      googleTokenPath: typeof partial?.googleTokenPath === 'string' ? partial.googleTokenPath.trim() : undefined,
    });
    return {
      googleCredentialsPath: next.googleCredentialsPath || '',
      googleTokenPath: next.googleTokenPath || '',
    };
  });

  ipcMain.handle('googleCalendar:getTodayEvents', async () => fetchTodayEvents(app));
}

module.exports = {
  registerGoogleCalendarIpc,
};
