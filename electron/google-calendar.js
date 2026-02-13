const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'typecal.config.json';

function getConfigPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function getAlternateConfigPaths(app) {
  const userDataPath = app.getPath('userData');
  const parentDir = path.dirname(userDataPath);
  const candidates = ['TypeCal', 'text-calculator']
    .map((name) => path.join(parentDir, name, CONFIG_FILENAME))
    .filter((candidate) => candidate !== getConfigPath(app));
  return candidates;
}

function readConfig(app) {
  const merged = {};
  try {
    for (const candidate of [...getAlternateConfigPaths(app), getConfigPath(app)]) {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      Object.assign(merged, JSON.parse(fs.readFileSync(candidate, 'utf-8')));
    }
  } catch (error) {
    console.error('Failed to read config', error);
  }
  return merged;
}

function writeConfig(app, partial) {
  const current = readConfig(app);
  const next = { ...current, ...partial };
  fs.writeFileSync(getConfigPath(app), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

async function requestText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Calendar fetch error (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Calendar source did not return ICS data.');
  }
  return text;
}

function decodeBase64Url(value) {
  const normalized = (value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = normalized + (padding ? '='.repeat(4 - padding) : '');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function buildGoogleIcsUrl(calendarId) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

function resolveCalendarSourceUrls(input) {
  const source = (input || '').trim();
  if (!source) {
    return [];
  }

  if (source.toLowerCase().startsWith('webcal://')) {
    return [`https://${source.slice('webcal://'.length)}`];
  }

  if (source.toLowerCase().endsWith('.ics')) {
    return [source];
  }

  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    return [source];
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes('calendar.google.com')) {
    return [source];
  }

  const candidates = [];
  const cidParam = parsed.searchParams.get('cid');
  if (cidParam) {
    const decodedCid = decodeURIComponent(cidParam);
    candidates.push(buildGoogleIcsUrl(decodedCid));
    try {
      const asEmail = decodeBase64Url(decodedCid).trim();
      if (asEmail && asEmail.includes('@')) {
        candidates.push(buildGoogleIcsUrl(asEmail));
      }
    } catch {
      // Keep raw cid candidate if base64 decoding fails.
    }
  }

  const srcParam = parsed.searchParams.get('src');
  if (srcParam) {
    candidates.push(buildGoogleIcsUrl(decodeURIComponent(srcParam)));
  }

  return candidates.length > 0 ? [...new Set(candidates)] : [source];
}

function normalizeCalendarSources(config) {
  if (Array.isArray(config.calendarIcsUrls)) {
    const deduped = [];
    for (const item of config.calendarIcsUrls) {
      const value = String(item || '').trim();
      if (!value || deduped.includes(value)) {
        continue;
      }
      deduped.push(value);
    }
    return deduped;
  }
  if (typeof config.calendarIcsUrl === 'string' && config.calendarIcsUrl.trim()) {
    return [config.calendarIcsUrl.trim()];
  }
  return [];
}

function unescapeIcsText(value) {
  return (value || '')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';');
}

function unfoldIcsLines(raw) {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const unfolded = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseIcsDateValue(raw) {
  const value = (raw || '').trim();
  if (!value) {
    return null;
  }
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return { date: new Date(year, month, day), isAllDay: true };
  }

  // Supports:
  // - YYYYMMDDTHHMM
  // - YYYYMMDDTHHMMSS
  // - YYYYMMDDTHHMMSS.fffffff
  // with optional Z or +/-HHMM offsets
  const m = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(?:\.(\d+))?(Z|[+\-]\d{4})?$/
  );
  if (m) {
    const [, y, mo, d, h, mi, s = '00', frac = '', zone = ''] = m;
    const ms = Math.floor(Number(`0.${frac || '0'}`) * 1000);

    if (zone === 'Z') {
      return {
        date: new Date(
          Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms)
        ),
        isAllDay: false,
      };
    }

    if (/^[+\-]\d{4}$/.test(zone)) {
      const sign = zone[0] === '-' ? -1 : 1;
      const offsetHours = Number(zone.slice(1, 3));
      const offsetMinutes = Number(zone.slice(3, 5));
      const offsetTotalMinutes = sign * (offsetHours * 60 + offsetMinutes);
      const utcMillis =
        Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms) -
        offsetTotalMinutes * 60_000;
      return { date: new Date(utcMillis), isAllDay: false };
    }

    return {
      date: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms),
      isAllDay: false,
    };
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }
  return { date: fallback, isAllDay: false };
}

function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function parseRRule(raw) {
  const rule = {};
  for (const part of String(raw || '').split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 1) {
      continue;
    }
    const key = part.slice(0, eqIdx).trim().toUpperCase();
    const value = part.slice(eqIdx + 1).trim();
    if (key) {
      rule[key] = value;
    }
  }
  return rule;
}

function getWeekdayToken(date) {
  const tokens = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return tokens[date.getDay()];
}

function parseByDayToken(token) {
  const m = String(token || '').trim().toUpperCase().match(/^([+\-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
  if (!m) {
    return null;
  }
  return { ordinal: m[1] ? Number(m[1]) : null, day: m[2] };
}

function isNthWeekdayOfMonth(date, ordinal, weekdayToken) {
  if (!ordinal) {
    return getWeekdayToken(date) === weekdayToken;
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const targetDay = date.getDate();
  const weekday = date.getDay();
  const tokenWeekday = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(weekdayToken);
  if (weekday !== tokenWeekday) {
    return false;
  }

  if (ordinal > 0) {
    let count = 0;
    for (let d = 1; d <= targetDay; d += 1) {
      const probe = new Date(year, month, d);
      if (probe.getDay() === tokenWeekday) {
        count += 1;
      }
    }
    return count === ordinal;
  }

  let countFromEnd = 0;
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let d = lastDay; d >= targetDay; d -= 1) {
    const probe = new Date(year, month, d);
    if (probe.getDay() === tokenWeekday) {
      countFromEnd += 1;
    }
  }
  return countFromEnd === Math.abs(ordinal);
}

function buildRecurringOccurrenceStart(targetDay, templateStart, allDay) {
  if (allDay) {
    return new Date(targetDay);
  }
  return new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    templateStart.getHours(),
    templateStart.getMinutes(),
    templateStart.getSeconds(),
    templateStart.getMilliseconds()
  );
}

function isExcludedByExDate(exdates, candidateStart, allDay) {
  for (const ex of exdates) {
    if (allDay) {
      if (startOfDay(ex).getTime() === startOfDay(candidateStart).getTime()) {
        return true;
      }
      continue;
    }
    if (Math.abs(ex.getTime() - candidateStart.getTime()) < 60_000) {
      return true;
    }
  }
  return false;
}

function parseExDates(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => parseIcsDateValue(part))
    .filter((info) => info?.date)
    .map((info) => info.date);
}

function occursOnTargetDay(rule, dtstart, targetDay) {
  const freq = String(rule.FREQ || '').toUpperCase();
  if (!freq) {
    return false;
  }
  const interval = Math.max(1, Number(rule.INTERVAL || 1));
  const startDay = startOfDay(dtstart);
  if (targetDay.getTime() < startDay.getTime()) {
    return false;
  }

  const byDayTokens = String(rule.BYDAY || '')
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
  const byMonthDays = String(rule.BYMONTHDAY || '')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n !== 0);

  if (freq === 'DAILY') {
    const diffDays = Math.floor((targetDay.getTime() - startDay.getTime()) / 86_400_000);
    if (diffDays % interval !== 0) {
      return false;
    }
    if (byDayTokens.length > 0) {
      const current = getWeekdayToken(targetDay);
      return byDayTokens.some((token) => parseByDayToken(token)?.day === current);
    }
    return true;
  }

  if (freq === 'WEEKLY') {
    const diffDays = Math.floor((targetDay.getTime() - startDay.getTime()) / 86_400_000);
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks % interval !== 0) {
      return false;
    }
    const current = getWeekdayToken(targetDay);
    const allowedDays =
      byDayTokens.length > 0
        ? byDayTokens.map((token) => parseByDayToken(token)?.day).filter(Boolean)
        : [getWeekdayToken(dtstart)];
    return allowedDays.includes(current);
  }

  if (freq === 'MONTHLY') {
    const monthDiff =
      targetDay.getFullYear() * 12 +
      targetDay.getMonth() -
      (startDay.getFullYear() * 12 + startDay.getMonth());
    if (monthDiff < 0 || monthDiff % interval !== 0) {
      return false;
    }

    if (byMonthDays.length > 0) {
      const day = targetDay.getDate();
      const monthLastDay = new Date(targetDay.getFullYear(), targetDay.getMonth() + 1, 0).getDate();
      return byMonthDays.some((value) => (value > 0 ? value === day : monthLastDay + value + 1 === day));
    }

    if (byDayTokens.length > 0) {
      return byDayTokens.some((token) => {
        const parsed = parseByDayToken(token);
        if (!parsed) {
          return false;
        }
        return isNthWeekdayOfMonth(targetDay, parsed.ordinal, parsed.day);
      });
    }

    return targetDay.getDate() === dtstart.getDate();
  }

  return false;
}

function mapIcsEventsToToday(icsText, calendarId = 'ics') {
  const lines = unfoldIcsLines(icsText);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let calendarName = 'Calendar';
  const events = [];
  let current = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (current) {
        const startInfo = parseIcsDateValue(current.dtstart);
        const endInfo = parseIcsDateValue(current.dtend);
        if (startInfo?.date) {
          const initialStart = startInfo.date;
          let initialEnd = endInfo?.date || initialStart;
          const allDay = Boolean(startInfo.isAllDay);

          if (allDay && !current.dtend) {
            initialEnd = new Date(initialStart);
            initialEnd.setDate(initialEnd.getDate() + 1);
          } else if (!allDay && initialEnd.getTime() <= initialStart.getTime()) {
            initialEnd = new Date(initialStart);
            initialEnd.setMinutes(initialEnd.getMinutes() + 30);
          }

          const eventDurationMs = Math.max(60_000, initialEnd.getTime() - initialStart.getTime());
          const recurrenceRule = parseRRule(current.rrule);
          const exdates = parseExDates(current.exdate);
          let occurrenceStart = initialStart;
          let occurrenceEnd = initialEnd;

          if (recurrenceRule.FREQ && !current.recurrenceId) {
            if (!occursOnTargetDay(recurrenceRule, initialStart, todayStart)) {
              current = null;
              continue;
            }

            occurrenceStart = buildRecurringOccurrenceStart(todayStart, initialStart, allDay);
            occurrenceEnd = new Date(occurrenceStart.getTime() + eventDurationMs);

            if (isExcludedByExDate(exdates, occurrenceStart, allDay)) {
              current = null;
              continue;
            }
          }

          if (recurrenceRule.UNTIL) {
            const untilInfo = parseIcsDateValue(recurrenceRule.UNTIL);
            if (untilInfo?.date && occurrenceStart.getTime() > untilInfo.date.getTime()) {
              current = null;
              continue;
            }
          }

          const overlapsToday = occurrenceEnd > todayStart && occurrenceStart < todayEnd;
          if (overlapsToday) {
            events.push({
              id: current.uid || `${occurrenceStart.getTime()}-${events.length}`,
              title: unescapeIcsText(current.summary || '(No title)'),
              calendarId,
              calendarName,
              start: occurrenceStart.toISOString(),
              end: occurrenceEnd.toISOString(),
              isAllDay: allDay,
            });
          }
        }
      }
      current = null;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) {
      continue;
    }

    const rawKey = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = rawKey.split(';')[0].toUpperCase();

    if (key === 'X-WR-CALNAME' && value) {
      calendarName = unescapeIcsText(value);
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === 'UID') {
      current.uid = value.trim();
    } else if (key === 'SUMMARY') {
      current.summary = value.trim();
    } else if (key === 'DTSTART') {
      current.dtstart = value.trim();
    } else if (key === 'DTEND') {
      current.dtend = value.trim();
    } else if (key === 'RRULE') {
      current.rrule = value.trim();
    } else if (key === 'EXDATE') {
      current.exdate = current.exdate ? `${current.exdate},${value.trim()}` : value.trim();
    } else if (key === 'RECURRENCE-ID') {
      current.recurrenceId = value.trim();
    }
  }

  events.sort((a, b) => (Date.parse(a.start) || 0) - (Date.parse(b.start) || 0));
  return events;
}

async function fetchTodayEvents(app) {
  const config = readConfig(app);
  const sources = normalizeCalendarSources(config);
  if (sources.length === 0) {
    throw new Error('Missing calendar ICS URL. Add at least one ICS URL in Calendar settings.');
  }

  const allEvents = [];
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const urls = resolveCalendarSourceUrls(source);
    let sourceError;
    let sourceEvents = null;
    for (const url of urls) {
      try {
        const text = await requestText(url);
        sourceEvents = mapIcsEventsToToday(text, `ics-${i + 1}`);
        break;
      } catch (error) {
        sourceError = error;
      }
    }

    if (!sourceEvents) {
      throw new Error(
        `ICS URL #${i + 1} failed. ${sourceError instanceof Error ? sourceError.message : String(sourceError || '')}`
      );
    }

    allEvents.push(...sourceEvents);
  }

  allEvents.sort((a, b) => (Date.parse(a.start) || 0) - (Date.parse(b.start) || 0));
  return allEvents;
}

function registerGoogleCalendarIpc(app, ipcMain) {
  ipcMain.handle('googleCalendar:getConfig', () => {
    const config = readConfig(app);
    const sources = normalizeCalendarSources(config);
    return {
      calendarIcsUrl: sources[0] || '',
      calendarIcsUrls: sources,
    };
  });

  ipcMain.handle('googleCalendar:setConfig', (event, partial) => {
    const incomingList = Array.isArray(partial?.calendarIcsUrls)
      ? normalizeCalendarSources({ calendarIcsUrls: partial.calendarIcsUrls })
      : [];
    const fallbackSingle =
      typeof partial?.calendarIcsUrl === 'string' && partial.calendarIcsUrl.trim()
        ? [partial.calendarIcsUrl.trim()]
        : [];
    const nextSources = incomingList.length > 0 ? incomingList : fallbackSingle;

    const next = writeConfig(app, {
      calendarIcsUrls: nextSources,
      calendarIcsUrl: nextSources[0] || '',
    });
    const normalizedNextSources = normalizeCalendarSources(next);

    return {
      calendarIcsUrl: normalizedNextSources[0] || '',
      calendarIcsUrls: normalizedNextSources,
    };
  });

  ipcMain.handle('googleCalendar:getTodayEvents', async () => fetchTodayEvents(app));
}

module.exports = {
  registerGoogleCalendarIpc,
};
